// inspectionModel.js  (Kaden - NEA inspections)
// All SQL for the Inspections table lives here. Controllers never write SQL;
// they call these functions. Every value is passed with .input() so the query
// is parameterised - that is what stops SQL injection.
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


// ------------------------------------------------------------
// One SELECT list used by every read, so the shape of an inspection object
// is identical no matter which endpoint returned it.
//
// The officer's NAME comes from a JOIN on Users rather than being stored on
// the row. If an officer's name is ever corrected in Users, every inspection
// they ever filed shows the corrected name - no stale copies.
// ------------------------------------------------------------
const SELECT_INSPECTION = `
  SELECT i.inspectionId,
         i.stallId,
         f.name        AS stallName,
         c.name        AS centerName,
         i.officerId,
         u.name        AS officerName,
         i.scheduledDate,
         i.status,
         i.completedDate,
         i.score,
         i.remarks,
         i.followUpOf,
         i.createdAt
  FROM Inspections i
  JOIN FoodStalls    f ON f.stallId  = i.stallId
  JOIN HawkerCenters c ON c.centerId = f.centerId
  JOIN Users         u ON u.userId   = i.officerId
`;

// ------------------------------------------------------------
// Helpers used by the controllers before they write anything
// ------------------------------------------------------------

// Does this stall actually exist? Checked before insert/update so the user
// gets a readable message instead of a raw foreign key error.
async function stallExists(stallId) {
  const result = await (await db())
    .input("stallId", sql.Int, stallId)
    .query("SELECT stallId FROM FoodStalls WHERE stallId = @stallId");
  return result.recordset.length > 0;
}

// Is this stall already booked for a visit on this day?
// Only 'Scheduled' rows count - a cancelled or completed visit on the same
// date is history and must not block a new booking. excludeId lets the edit
// screen ignore the row currently being edited.
async function hasOpenSlot(stallId, scheduledDate, excludeId = null) {
  const result = await (await db())
    .input("stallId", sql.Int, stallId)
    .input("scheduledDate", sql.Date, scheduledDate)
    .input("excludeId", sql.Int, excludeId)
    .query(`
      SELECT inspectionId
      FROM Inspections
      WHERE stallId = @stallId
        AND scheduledDate = @scheduledDate
        AND status = 'Scheduled'
        AND (@excludeId IS NULL OR inspectionId <> @excludeId)
    `);
  return result.recordset.length > 0;
}

// ------------------------------------------------------------
// READ
// ------------------------------------------------------------

// Public list with optional filters. Built up piece by piece so an absent
// filter simply adds nothing to the WHERE clause.
async function getAllInspections(filters = {}) {
  const request = (await db());
  let query = SELECT_INSPECTION + " WHERE 1 = 1";

  if (filters.stallId) {
    query += " AND i.stallId = @stallId";
    request.input("stallId", sql.Int, filters.stallId);
  }
  if (filters.status) {
    query += " AND i.status = @status";
    request.input("status", sql.NVarChar, filters.status);
  }
  if (filters.officerId) {
    query += " AND i.officerId = @officerId";
    request.input("officerId", sql.Int, filters.officerId);
  }

  query += " ORDER BY i.scheduledDate DESC";

  const result = await request.query(query);
  return result.recordset;
}

async function getInspectionById(inspectionId) {
  const result = await (await db())
    .input("inspectionId", sql.Int, inspectionId)
    .query(SELECT_INSPECTION + " WHERE i.inspectionId = @inspectionId");
  return result.recordset[0]; // undefined when the id does not exist
}

// The logged-in officer's own open worklist: everything still 'Scheduled',
// soonest first, so the page can split it into overdue / today / upcoming.
async function getOpenByOfficer(officerId) {
  const result = await (await db())
    .input("officerId", sql.Int, officerId)
    .query(SELECT_INSPECTION + `
      WHERE i.officerId = @officerId
        AND i.status = 'Scheduled'
      ORDER BY i.scheduledDate ASC
    `);
  return result.recordset;
}

// Everything this officer has already carried out - the "what have I done"
// half of the worklist page.
async function getCompletedByOfficer(officerId) {
  const result = await (await db())
    .input("officerId", sql.Int, officerId)
    .query(SELECT_INSPECTION + `
      WHERE i.officerId = @officerId
        AND i.status = 'Completed'
      ORDER BY i.completedDate DESC
    `);
  return result.recordset;
}

// Booked, the date has passed, and still nobody has recorded a result.
// officerId is optional: leave it out for a whole-agency view.
async function getOverdue(officerId = null) {
  const result = await (await db())
    .input("officerId", sql.Int, officerId)
    .query(SELECT_INSPECTION + `
      WHERE i.status = 'Scheduled'
        AND i.scheduledDate < CAST(GETDATE() AS DATE)
        AND (@officerId IS NULL OR i.officerId = @officerId)
      ORDER BY i.scheduledDate ASC
    `);
  return result.recordset;
}

// Every stall on the platform with the state an officer needs in order to
// decide who to visit next: when it was last inspected, what grade it holds
// and whether a visit is already booked.
//
// OUTER APPLY runs a small "TOP 1" query per stall. It is the SQL Server way
// of saying "the most recent one", and unlike a JOIN it still returns the
// stall when there is nothing to find - which is exactly the case we care
// about most here (never inspected).
async function getStallsDue() {
  const result = await (await db()).query(`
    SELECT f.stallId,
           f.name  AS stallName,
           c.name  AS centerName,
           lastVisit.completedDate AS lastInspected,
           lastVisit.score         AS lastScore,
           lastGrade.grade         AS currentGrade,
           lastGrade.validTo       AS gradeValidTo,
           openVisit.inspectionId  AS openInspectionId,
           openVisit.scheduledDate AS openScheduledDate,
           DATEDIFF(DAY, lastVisit.completedDate, CAST(GETDATE() AS DATE)) AS daysSinceLastVisit,
           DATEDIFF(DAY, CAST(GETDATE() AS DATE), lastGrade.validTo)       AS daysUntilGradeExpires
    FROM FoodStalls f
    JOIN HawkerCenters c ON c.centerId = f.centerId
    OUTER APPLY (
      SELECT TOP 1 i.completedDate, i.score
      FROM Inspections i
      WHERE i.stallId = f.stallId AND i.status = 'Completed'
      ORDER BY i.completedDate DESC
    ) AS lastVisit
    OUTER APPLY (
      SELECT TOP 1 g.grade, g.validTo
      FROM HygieneGrades g
      WHERE g.stallId = f.stallId
      ORDER BY g.validFrom DESC
    ) AS lastGrade
    OUTER APPLY (
      SELECT TOP 1 i.inspectionId, i.scheduledDate
      FROM Inspections i
      WHERE i.stallId = f.stallId AND i.status = 'Scheduled'
      ORDER BY i.scheduledDate ASC
    ) AS openVisit
    -- Stalls that have never been inspected sort to the very top, then the
    -- ones whose grade runs out soonest.
    ORDER BY CASE WHEN lastVisit.completedDate IS NULL THEN 0 ELSE 1 END,
             lastGrade.validTo ASC,
             f.stallId ASC
  `);
  return result.recordset;
}

// ------------------------------------------------------------
// CREATE
// ------------------------------------------------------------
// officerId is supplied by the controller from the JWT, never from the body.
// followUpOf is only set when the back end books a re-inspection itself.
async function createInspection(data) {
  const result = await (await db())
    .input("stallId", sql.Int, data.stallId)
    .input("officerId", sql.Int, data.officerId)
    .input("scheduledDate", sql.Date, data.scheduledDate)
    .input("followUpOf", sql.Int, data.followUpOf || null)
    .query(`
      INSERT INTO Inspections (stallId, officerId, scheduledDate, status, followUpOf)
      OUTPUT INSERTED.inspectionId
      VALUES (@stallId, @officerId, @scheduledDate, 'Scheduled', @followUpOf)
    `);

  // Re-read through the shared SELECT so the caller gets the same object
  // shape (with stallName and officerName) as every other endpoint.
  return getInspectionById(result.recordset[0].inspectionId);
}

// ------------------------------------------------------------
// UPDATE - move or cancel a booked visit
// ------------------------------------------------------------
// The officer is not updatable: an inspection stays attached to whoever
// booked it.
async function updateInspection(inspectionId, data) {
  const result = await (await db())
    .input("inspectionId", sql.Int, inspectionId)
    .input("stallId", sql.Int, data.stallId)
    .input("scheduledDate", sql.Date, data.scheduledDate)
    .input("status", sql.NVarChar, data.status)
    .query(`
      UPDATE Inspections
      SET stallId       = @stallId,
          scheduledDate = @scheduledDate,
          status        = @status
      OUTPUT INSERTED.inspectionId
      WHERE inspectionId = @inspectionId
    `);

  if (!result.recordset[0]) return undefined; // id did not exist
  return getInspectionById(inspectionId);
}

// ------------------------------------------------------------
// COMPLETE - the important one
// ------------------------------------------------------------
// Recording a result does up to three writes:
//   1. mark the inspection Completed and store score + remarks
//   2. issue the hygiene grade those points earned
//   3. if the stall failed, book the re-inspection
//
// They run inside ONE TRANSACTION. Without it, a failure on write 2 would
// leave an inspection marked "Completed" with no grade behind it - the data
// would be lying. With it, either all three land or none of them do.
async function completeInspection(inspectionId, data) {
  const pool = await sql.connect(dbConfig); // same reasoning as db() above
  const transaction = new sql.Transaction(pool);

  await transaction.begin();
  try {
    // 1) the result itself
    await new sql.Request(transaction)
      .input("inspectionId", sql.Int, inspectionId)
      .input("completedDate", sql.Date, data.completedDate)
      .input("score", sql.Int, data.score)
      .input("remarks", sql.NVarChar(500), data.remarks || null)
      .query(`
        UPDATE Inspections
        SET status        = 'Completed',
            completedDate = @completedDate,
            score         = @score,
            remarks       = @remarks
        WHERE inspectionId = @inspectionId
      `);

    // 2) the hygiene grade it earned
    const gradeResult = await new sql.Request(transaction)
      .input("stallId", sql.Int, data.stallId)
      .input("inspectionId", sql.Int, inspectionId)
      .input("grade", sql.Char(1), data.grade)
      .input("validFrom", sql.Date, data.validFrom)
      .input("validTo", sql.Date, data.validTo)
      .query(`
        INSERT INTO HygieneGrades (stallId, inspectionId, grade, validFrom, validTo)
        OUTPUT INSERTED.*
        VALUES (@stallId, @inspectionId, @grade, @validFrom, @validTo)
      `);

    // 3) a failing stall is automatically re-booked
    let followUpId = null;
    if (data.followUpDate) {
      const followUp = await new sql.Request(transaction)
        .input("stallId", sql.Int, data.stallId)
        .input("officerId", sql.Int, data.officerId)
        .input("scheduledDate", sql.Date, data.followUpDate)
        .input("followUpOf", sql.Int, inspectionId)
        .query(`
          INSERT INTO Inspections (stallId, officerId, scheduledDate, status, followUpOf)
          OUTPUT INSERTED.inspectionId
          VALUES (@stallId, @officerId, @scheduledDate, 'Scheduled', @followUpOf)
        `);
      followUpId = followUp.recordset[0].inspectionId;
    }

    await transaction.commit();

    // Read everything back AFTER the commit, outside the transaction.
    return {
      inspection: await getInspectionById(inspectionId),
      hygieneGrade: gradeResult.recordset[0],
      followUp: followUpId ? await getInspectionById(followUpId) : null,
    };
  } catch (err) {
    // Undo every write above, then let the controller turn this into a 500.
    await transaction.rollback();
    throw err;
  }
}

// Is there already an open visit booked on this date? Used when picking a
// date for the automatic re-inspection so it cannot collide with the unique
// index on (stallId, scheduledDate) for open visits.
async function findFreeFollowUpDate(stallId, startDate) {
  const date = new Date(startDate);
  // Try the target day, then the next few days until one is free.
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const iso = date.toISOString().slice(0, 10);
    // eslint-disable-next-line no-await-in-loop
    if (!(await hasOpenSlot(stallId, iso))) return iso;
    date.setDate(date.getDate() + 1);
  }
  return null; // give up rather than loop forever
}

// ------------------------------------------------------------
// DELETE
// ------------------------------------------------------------
// HygieneGrades.inspectionId is ON DELETE SET NULL, so deleting an
// inspection does NOT delete the grade it issued - the stall keeps its
// grade history. Any follow-up pointing back at this row has to be
// unhooked first, otherwise the self-referencing foreign key blocks it.
async function deleteInspection(inspectionId) {
  const request = (await db()).input("inspectionId", sql.Int, inspectionId);

  await request.query(`
    UPDATE Inspections SET followUpOf = NULL WHERE followUpOf = @inspectionId
  `);

  const result = await (await db())
    .input("inspectionId", sql.Int, inspectionId)
    .query("DELETE FROM Inspections OUTPUT DELETED.* WHERE inspectionId = @inspectionId");

  return result.recordset[0]; // undefined when the id did not exist
}

module.exports = {
  stallExists,
  hasOpenSlot,
  getAllInspections,
  getInspectionById,
  getOpenByOfficer,
  getCompletedByOfficer,
  getOverdue,
  getStallsDue,
  createInspection,
  updateInspection,
  completeInspection,
  findFreeFollowUpDate,
  deleteInspection,
};