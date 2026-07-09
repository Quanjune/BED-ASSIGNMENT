const sql = require("mssql");
 
// Helper: check a stallId actually exists before we insert/update against it.
async function stallExists(stallId) {
  const result = await sql.request()
    .input("stallId", sql.Int, stallId)
    .query("SELECT stallId FROM FoodStalls WHERE stallId = @stallId");
  return result.recordset.length > 0;
}
 
// READ (all)
async function getAllInspections(stallId) {
  const request = sql.request();
  let query = `
    SELECT i.inspectionId, i.stallId, f.name AS stallName, i.officerName,
           i.inspectionDate, i.score, i.remarks, i.createdAt
    FROM Inspections i
    JOIN FoodStalls f ON f.stallId = i.stallId
  `;
 
  if (stallId) {
    query += " WHERE i.stallId = @stallId";
    request.input("stallId", sql.Int, stallId);
  }
 
  query += " ORDER BY i.inspectionDate DESC";
 
  const result = await request.query(query);
  return result.recordset;
}
 
// READ (one)
async function getInspectionById(inspectionId) {
  const result = await sql.request()
    .input("inspectionId", sql.Int, inspectionId)
    .query(`
      SELECT i.inspectionId, i.stallId, f.name AS stallName, i.officerName,
             i.inspectionDate, i.score, i.remarks, i.createdAt
      FROM Inspections i
      JOIN FoodStalls f ON f.stallId = i.stallId
      WHERE i.inspectionId = @inspectionId
    `);
  return result.recordset[0]; 
}
 
// CREATE
async function createInspection(data) {
  const result = await sql.request()
    .input("stallId", sql.Int, data.stallId)
    .input("officerName", sql.NVarChar, data.officerName)
    .input("inspectionDate", sql.Date, data.inspectionDate)
    .input("score", sql.Int, data.score)
    .input("remarks", sql.NVarChar, data.remarks || null)
    .query(`
      INSERT INTO Inspections (stallId, officerName, inspectionDate, score, remarks)
      OUTPUT INSERTED.*
      VALUES (@stallId, @officerName, @inspectionDate, @score, @remarks)
    `);
  return result.recordset[0];
}
 
// UPDATE
async function updateInspection(inspectionId, data) {
  const result = await sql.request()
    .input("inspectionId", sql.Int, inspectionId)
    .input("stallId", sql.Int, data.stallId)
    .input("officerName", sql.NVarChar, data.officerName)
    .input("inspectionDate", sql.Date, data.inspectionDate)
    .input("score", sql.Int, data.score)
    .input("remarks", sql.NVarChar, data.remarks || null)
    .query(`
      UPDATE Inspections
      SET stallId = @stallId,
          officerName = @officerName,
          inspectionDate = @inspectionDate,
          score = @score,
          remarks = @remarks
      OUTPUT INSERTED.*
      WHERE inspectionId = @inspectionId
    `);
  return result.recordset[0]; 
}
 
// DELETE
async function deleteInspection(inspectionId) {
  const result = await sql.request()
    .input("inspectionId", sql.Int, inspectionId)
    .query("DELETE FROM Inspections OUTPUT DELETED.* WHERE inspectionId = @inspectionId");
  return result.recordset[0]; 
}
 
module.exports = {
  stallExists,
  getAllInspections,
  getInspectionById,
  createInspection,
  updateInspection,
  deleteInspection,
};