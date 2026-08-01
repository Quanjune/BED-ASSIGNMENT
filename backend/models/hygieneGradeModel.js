// hygieneGradeModel.js  (Kaden - hygiene grading)
// All SQL for the HygieneGrades table. Every row is kept forever, so a stall
// builds up a grade history rather than having one value overwritten - that
// history is what the tracking screens are built on.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// ------------------------------------------------------------
// WHY THIS HELPER EXISTS  (read before changing it)
// ------------------------------------------------------------
// `(await db())` uses mssql's GLOBAL connection. That works right up
// until something else closes it - and several models in this project do
// exactly that:
//
//     connection = await sql.connect(dbConfig);   // this IS the global one
//     ...
//     finally { await connection.close(); }       // ...and this kills it
//
// userModel.js does it on every login, and feedback/complaint/promo/admin
// do it on every call. So the moment anyone logs in, the global connection
// is gone and any later `(await db())` throws
//     "No connection is specified for that request."
//
// Asking sql.connect() for the pool each time fixes it: mssql hands back the
// existing pool if it is open, and quietly re-opens it if somebody closed it.
// This is the same pattern productModel.js and cartModel.js use, which is why
// the browse pages kept working while these ones did not.
async function db() {
  const pool = await sql.connect(dbConfig);
  return pool.request();
}


// Shared SELECT list so a grade object looks the same from every endpoint.
// isCurrent is worked out in SQL rather than in JavaScript so the front end
// does not have to know the rule.
const SELECT_GRADE = `
  SELECT g.gradeId,
         g.stallId,
         f.name  AS stallName,
         c.name  AS centerName,
         g.inspectionId,
         i.score AS inspectionScore,
         g.grade,
         g.validFrom,
         g.validTo,
         g.createdAt,
         CASE WHEN CAST(GETDATE() AS DATE) BETWEEN g.validFrom AND g.validTo
              THEN 1 ELSE 0 END AS isCurrent,
         DATEDIFF(DAY, CAST(GETDATE() AS DATE), g.validTo) AS daysUntilExpiry
  FROM HygieneGrades g
  JOIN FoodStalls    f ON f.stallId  = g.stallId
  JOIN HawkerCenters c ON c.centerId = f.centerId
  LEFT JOIN Inspections i ON i.inspectionId = g.inspectionId
`;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
async function stallExists(stallId) {
  const result = await (await db())
    .input("stallId", sql.Int, stallId)
    .query("SELECT stallId FROM FoodStalls WHERE stallId = @stallId");
  return result.recordset.length > 0;
}

async function inspectionExists(inspectionId) {
  const result = await (await db())
    .input("inspectionId", sql.Int, inspectionId)
    .query("SELECT inspectionId FROM Inspections WHERE inspectionId = @inspectionId");
  return result.recordset.length > 0;
}

// ------------------------------------------------------------
// READ
// ------------------------------------------------------------

// Full register, newest first. Optional ?stallId= narrows it to one stall,
// which is the "historical tracking" view.
async function getAllGrades(stallId) {
  const request = (await db());
  let query = SELECT_GRADE;

  if (stallId) {
    query += " WHERE g.stallId = @stallId";
    request.input("stallId", sql.Int, stallId);
  }

  query += " ORDER BY g.validFrom DESC, g.gradeId DESC";

  const result = await request.query(query);
  return result.recordset;
}

async function getGradeById(gradeId) {
  const result = await (await db())
    .input("gradeId", sql.Int, gradeId)
    .query(SELECT_GRADE + " WHERE g.gradeId = @gradeId");
  return result.recordset[0];
}

// The ONE grade each stall is displaying right now.
//
// Doing this in SQL matters: the old version fetched every grade ever issued
// and worked out the newest per stall in the browser, which meant the page
// got slower every time an inspection was recorded. ROW_NUMBER() numbers each
// stall's grades newest-first and we keep number 1.
async function getCurrentGrades() {
  const result = await (await db()).query(`
    WITH ranked AS (
      SELECT g.*,
             ROW_NUMBER() OVER (PARTITION BY g.stallId
                                ORDER BY g.validFrom DESC, g.gradeId DESC) AS rn
      FROM HygieneGrades g
    )
    SELECT r.gradeId,
           r.stallId,
           f.name  AS stallName,
           c.name  AS centerName,
           r.inspectionId,
           r.grade,
           r.validFrom,
           r.validTo,
           CASE WHEN CAST(GETDATE() AS DATE) BETWEEN r.validFrom AND r.validTo
                THEN 1 ELSE 0 END AS isCurrent,
           DATEDIFF(DAY, CAST(GETDATE() AS DATE), r.validTo) AS daysUntilExpiry
    FROM ranked r
    JOIN FoodStalls    f ON f.stallId  = r.stallId
    JOIN HawkerCenters c ON c.centerId = f.centerId
    WHERE r.rn = 1
    ORDER BY r.grade ASC, f.name ASC
  `);
  return result.recordset;
}

// Current grades that run out within the next N days (or have already run
// out). This is the officer's "what do I need to book next" list.
async function getExpiringGrades(days) {
  const result = await (await db())
    .input("days", sql.Int, days)
    .query(`
      WITH ranked AS (
        SELECT g.*,
               ROW_NUMBER() OVER (PARTITION BY g.stallId
                                  ORDER BY g.validFrom DESC, g.gradeId DESC) AS rn
        FROM HygieneGrades g
      )
      SELECT r.gradeId,
             r.stallId,
             f.name AS stallName,
             c.name AS centerName,
             r.grade,
             r.validFrom,
             r.validTo,
             DATEDIFF(DAY, CAST(GETDATE() AS DATE), r.validTo) AS daysUntilExpiry
      FROM ranked r
      JOIN FoodStalls    f ON f.stallId  = r.stallId
      JOIN HawkerCenters c ON c.centerId = f.centerId
      WHERE r.rn = 1
        AND DATEDIFF(DAY, CAST(GETDATE() AS DATE), r.validTo) <= @days
      ORDER BY r.validTo ASC
    `);
  return result.recordset;
}

// ------------------------------------------------------------
// CREATE / UPDATE / DELETE
// ------------------------------------------------------------
// createGrade is also called from inside the completeInspection transaction
// in inspectionModel.js; this copy is the manual/corrective path used by
// POST /api/hygiene-grades.
async function createGrade(data) {
  const result = await (await db())
    .input("stallId", sql.Int, data.stallId)
    .input("inspectionId", sql.Int, data.inspectionId || null)
    .input("grade", sql.Char(1), data.grade)
    .input("validFrom", sql.Date, data.validFrom)
    .input("validTo", sql.Date, data.validTo)
    .query(`
      INSERT INTO HygieneGrades (stallId, inspectionId, grade, validFrom, validTo)
      OUTPUT INSERTED.gradeId
      VALUES (@stallId, @inspectionId, @grade, @validFrom, @validTo)
    `);

  return getGradeById(result.recordset[0].gradeId);
}

async function updateGrade(gradeId, data) {
  const result = await (await db())
    .input("gradeId", sql.Int, gradeId)
    .input("stallId", sql.Int, data.stallId)
    .input("inspectionId", sql.Int, data.inspectionId || null)
    .input("grade", sql.Char(1), data.grade)
    .input("validFrom", sql.Date, data.validFrom)
    .input("validTo", sql.Date, data.validTo)
    .query(`
      UPDATE HygieneGrades
      SET stallId      = @stallId,
          inspectionId = @inspectionId,
          grade        = @grade,
          validFrom    = @validFrom,
          validTo      = @validTo
      OUTPUT INSERTED.gradeId
      WHERE gradeId = @gradeId
    `);

  if (!result.recordset[0]) return undefined; // id did not exist
  return getGradeById(gradeId);
}

async function deleteGrade(gradeId) {
  const result = await (await db())
    .input("gradeId", sql.Int, gradeId)
    .query("DELETE FROM HygieneGrades OUTPUT DELETED.* WHERE gradeId = @gradeId");
  return result.recordset[0];
}

module.exports = {
  stallExists,
  inspectionExists,
  getAllGrades,
  getGradeById,
  getCurrentGrades,
  getExpiringGrades,
  createGrade,
  updateGrade,
  deleteGrade,
};