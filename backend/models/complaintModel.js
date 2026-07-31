// models/complaintModel.js
// MODEL layer: the only file that talks to the Complaints table.
//
// ABOUT userId: the column is NVARCHAR and now stores the numeric userId from
// the JWT (e.g. "3"). Older seeded rows hold free text such as "user456".
// The LEFT JOIN through TRY_CAST shows a real name when the id matches an
// account and falls back to the stored value when it doesn't, so the sample
// rows still read sensibly. TRY_CAST returns NULL rather than throwing when
// the text isn't numeric.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

const SELECT_COLUMNS = `
        co.complaintId, co.stallId, co.userId, co.category, co.description,
        co.status, co.createdAt,
        COALESCE(u.name, co.userId) AS userName,
        s.name AS stallName, s.centerId, c.name AS centerName`;

const FROM_JOINS = `
      FROM Complaints co
      INNER JOIN FoodStalls s    ON co.stallId = s.stallId
      INNER JOIN HawkerCenters c ON s.centerId = c.centerId
      LEFT  JOIN Users u         ON TRY_CAST(co.userId AS INT) = u.userId`;

// GET all - newest first, with stall + centre names for display.
async function getAllComplaints() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .query(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS} ORDER BY co.createdAt DESC`);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// GET the complaints filed against ONE stall - powers the vendor's panel.
async function getComplaintsByStall(stallId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("stallId", sql.Int, stallId)
      .query(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS}
              WHERE co.stallId = @stallId
              ORDER BY co.createdAt DESC`);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// GET one - by its id.
async function getComplaintById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)
      .query(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE co.complaintId = @id`);
    return result.recordset[0];
  } finally {
    if (connection) await connection.close();
  }
}

// POST - insert a new complaint, return the new id.
// data.userId is set by the CONTROLLER from the JWT, never from the body.
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

// PUT - update the status (e.g. 'Open' -> 'Resolved').
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

// DELETE - remove a complaint.
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
  getComplaintsByStall,
  getComplaintById,
  createComplaint,
  updateComplaintStatus,
  deleteComplaint,
};