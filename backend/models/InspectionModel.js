const sql = require("mssql");
 
// Helper: check a stallId actually exists before we insert/update against it.
async function stallExists(stallId) {
  const result = await sql.request()
    .input("stallId", sql.Int, stallId)
    .query("SELECT stallId FROM FoodStalls WHERE stallId = @stallId");
  return result.recordset.length > 0;
}
 
// READ
async function getAllInspections(filters = {}) {
  const request = sql.request();
  let query = `
    SELECT i.inspectionId, i.stallId, f.name AS stallName, i.officerName,
           i.scheduledDate, i.status, i.completedDate, i.score, i.remarks, i.createdAt
    FROM Inspections i
    JOIN FoodStalls f ON f.stallId = i.stallId
    WHERE 1 = 1
  `;
 
  if (filters.stallId) {
    query += " AND i.stallId = @stallId";
    request.input("stallId", sql.Int, filters.stallId);
  }
  if (filters.status) {
    query += " AND i.status = @status";
    request.input("status", sql.NVarChar, filters.status);
  }
 
  query += " ORDER BY i.scheduledDate DESC";
 
  const result = await request.query(query);
  return result.recordset;
}
 
// READ 
async function getInspectionById(inspectionId) {
  const result = await sql.request()
    .input("inspectionId", sql.Int, inspectionId)
    .query(`
      SELECT i.inspectionId, i.stallId, f.name AS stallName, i.officerName,
             i.scheduledDate, i.status, i.completedDate, i.score, i.remarks, i.createdAt
      FROM Inspections i
      JOIN FoodStalls f ON f.stallId = i.stallId
      WHERE i.inspectionId = @inspectionId
    `);
  return result.recordset[0]; 
 
// CREATE 
async function createInspection(data) {
  const result = await sql.request()
    .input("stallId", sql.Int, data.stallId)
    .input("officerName", sql.NVarChar, data.officerName)
    .input("scheduledDate", sql.Date, data.scheduledDate)
    .query(`
      INSERT INTO Inspections (stallId, officerName, scheduledDate, status)
      OUTPUT INSERTED.*
      VALUES (@stallId, @officerName, @scheduledDate, 'Scheduled')
    `);
  return result.recordset[0];
}
 
// UPDATE
async function updateInspection(inspectionId, data) {
  const result = await sql.request()
    .input("inspectionId", sql.Int, inspectionId)
    .input("stallId", sql.Int, data.stallId)
    .input("officerName", sql.NVarChar, data.officerName)
    .input("scheduledDate", sql.Date, data.scheduledDate)
    .input("status", sql.NVarChar, data.status)
    .query(`
      UPDATE Inspections
      SET stallId = @stallId,
          officerName = @officerName,
          scheduledDate = @scheduledDate,
          status = @status
      OUTPUT INSERTED.*
      WHERE inspectionId = @inspectionId
    `);
  return result.recordset[0]; 
}
 
// COMPLETE 
async function completeInspection(inspectionId, { completedDate, score, remarks }) {
  const result = await sql.request()
    .input("inspectionId", sql.Int, inspectionId)
    .input("completedDate", sql.Date, completedDate)
    .input("score", sql.Int, score)
    .input("remarks", sql.NVarChar, remarks || null)
    .query(`
      UPDATE Inspections
      SET status = 'Completed',
          completedDate = @completedDate,
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
  return result.recordset[0]; // undefined if inspectionId didn't exist
}
 
module.exports = {
  stallExists,
  getAllInspections,
  getInspectionById,
  createInspection,
  updateInspection,
  completeInspection,
  deleteInspection,
};}