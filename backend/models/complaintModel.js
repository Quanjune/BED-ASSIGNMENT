// models/complaintModel.js
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

async function getAllComplaints() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .query("SELECT * FROM Complaints ORDER BY createdAt DESC");
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

async function getComplaintById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM Complaints WHERE complaintId = @id");
    return result.recordset[0];
  } finally {
    if (connection) await connection.close();
  }
}

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

// A nice real-world PUT: changing status from 'Open' to 'Resolved'
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