// models/complaintModel.js
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// GET all — newest first, with stall + centre names for display.
async function getAllComplaints() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .query(`SELECT co.complaintId, co.stallId, co.userId, co.category, co.description,
                     co.status, co.createdAt,
                     s.name AS stallName, s.centerId, c.name AS centerName
              FROM Complaints co
              INNER JOIN FoodStalls s ON co.stallId = s.stallId
              INNER JOIN HawkerCenters c ON s.centerId = c.centerId
              ORDER BY co.createdAt DESC`);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// GET one — by its id.
async function getComplaintById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)
      .query(`SELECT co.complaintId, co.stallId, co.userId, co.category, co.description,
                     co.status, co.createdAt,
                     s.name AS stallName, s.centerId, c.name AS centerName
              FROM Complaints co
              INNER JOIN FoodStalls s ON co.stallId = s.stallId
              INNER JOIN HawkerCenters c ON s.centerId = c.centerId
              WHERE co.complaintId = @id`);
    return result.recordset[0];
  } finally {
    if (connection) await connection.close();
  }
}

// POST — insert a new complaint, return the new id.
async function createComplaint(data) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("stallId", sql.Int, data.stallId)
      .input("userId", sql.NVarChar, data.userId)
      .input("category", sql.NVarChar, data.category)
      .input("description", sql.NVarChar, data.description)
      .query(`INSERT INTO Complaints (stallId, userId, category, description)
              VALUES (@stallId, @userId, @category, @description);
              SELECT SCOPE_IDENTITY() AS complaintId;`);
    return result.recordset[0].complaintId;
  } finally {
    if (connection) await connection.close();
  }
}

// PUT — update the status (e.g. 'Open' -> 'Resolved').
async function updateComplaintStatus(id, status) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)
      .input("status", sql.NVarChar, status)
      .query("UPDATE Complaints SET status = @status WHERE complaintId = @id");
    return result.rowsAffected[0];
  } finally {
    if (connection) await connection.close();
  }
}

// DELETE — remove a complaint.
async function deleteComplaint(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Complaints WHERE complaintId = @id");
    return result.rowsAffected[0];
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = {
  getAllComplaints,
  getComplaintById,
  createComplaint,
  updateComplaintStatus,
  deleteComplaint,
};