const sql = require("mssql");
 
async function stallExists(stallId) {
  const result = await sql.request()
    .input("stallId", sql.Int, stallId)
    .query("SELECT stallId FROM FoodStalls WHERE stallId = @stallId");
  return result.recordset.length > 0;
}
 
async function inspectionExists(inspectionId) {
  const result = await sql.request()
    .input("inspectionId", sql.Int, inspectionId)
    .query("SELECT inspectionId FROM Inspections WHERE inspectionId = @inspectionId");
  return result.recordset.length > 0;
}
 
// READ 
async function getAllGrades(stallId) {
  const request = sql.request();
  let query = `
    SELECT g.gradeId, g.stallId, f.name AS stallName, g.inspectionId,
           g.grade, g.validFrom, g.validTo, g.createdAt
    FROM HygieneGrades g
    JOIN FoodStalls f ON f.stallId = g.stallId
  `;
 
  if (stallId) {
    query += " WHERE g.stallId = @stallId";
    request.input("stallId", sql.Int, stallId);
  }
 
  query += " ORDER BY g.validFrom DESC";
 
  const result = await request.query(query);
  return result.recordset;
}
 
// READ 
async function getGradeById(gradeId) {
  const result = await sql.request()
    .input("gradeId", sql.Int, gradeId)
    .query(`
      SELECT g.gradeId, g.stallId, f.name AS stallName, g.inspectionId,
             g.grade, g.validFrom, g.validTo, g.createdAt
      FROM HygieneGrades g
      JOIN FoodStalls f ON f.stallId = g.stallId
      WHERE g.gradeId = @gradeId
    `);
  return result.recordset[0];
}
 
// CREATE 
async function createGrade(data) {
  const result = await sql.request()
    .input("stallId", sql.Int, data.stallId)
    .input("inspectionId", sql.Int, data.inspectionId || null)
    .input("grade", sql.Char(1), data.grade)
    .input("validFrom", sql.Date, data.validFrom)
    .input("validTo", sql.Date, data.validTo)
    .query(`
      INSERT INTO HygieneGrades (stallId, inspectionId, grade, validFrom, validTo)
      OUTPUT INSERTED.*
      VALUES (@stallId, @inspectionId, @grade, @validFrom, @validTo)
    `);
  return result.recordset[0];
}
 
// UPDATE
async function updateGrade(gradeId, data) {
  const result = await sql.request()
    .input("gradeId", sql.Int, gradeId)
    .input("stallId", sql.Int, data.stallId)
    .input("inspectionId", sql.Int, data.inspectionId || null)
    .input("grade", sql.Char(1), data.grade)
    .input("validFrom", sql.Date, data.validFrom)
    .input("validTo", sql.Date, data.validTo)
    .query(`
      UPDATE HygieneGrades
      SET stallId = @stallId,
          inspectionId = @inspectionId,
          grade = @grade,
          validFrom = @validFrom,
          validTo = @validTo
      OUTPUT INSERTED.*
      WHERE gradeId = @gradeId
    `);
  return result.recordset[0]; 
}
 
// DELETE
async function deleteGrade(gradeId) {
  const result = await sql.request()
    .input("gradeId", sql.Int, gradeId)
    .query("DELETE FROM HygieneGrades OUTPUT DELETED.* WHERE gradeId = @gradeId");
  return result.recordset[0];
}
 
module.exports = {
  stallExists,
  inspectionExists,
  getAllGrades,
  getGradeById,
  createGrade,
  updateGrade,
  deleteGrade,
};
 