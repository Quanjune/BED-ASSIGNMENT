// models/feedbackModel.js
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// GET all — newest first. JOINs FoodStalls + HawkerCenters so the front-end
// can show "Lor Mee 178 · Tiong Bahru Market" instead of a bare stallId.
async function getAllFeedback() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .query(`SELECT f.feedbackId, f.stallId, f.userId, f.rating, f.comment, f.createdAt,
                     s.name AS stallName, s.centerId, c.name AS centerName
              FROM Feedback f
              INNER JOIN FoodStalls s ON f.stallId = s.stallId
              INNER JOIN HawkerCenters c ON s.centerId = c.centerId
              ORDER BY f.createdAt DESC`);
    return result.recordset;            // recordset = the array of rows
  } finally {
    if (connection) await connection.close();   // always close, even on error
  }
}

// GET one — by its id (same JOIN so edit mode can pre-select centre + stall).
async function getFeedbackById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)         // parameterised input (safe from injection)
      .query(`SELECT f.feedbackId, f.stallId, f.userId, f.rating, f.comment, f.createdAt,
                     s.name AS stallName, s.centerId, c.name AS centerName
              FROM Feedback f
              INNER JOIN FoodStalls s ON f.stallId = s.stallId
              INNER JOIN HawkerCenters c ON s.centerId = c.centerId
              WHERE f.feedbackId = @id`);
    return result.recordset[0];         // first row, or undefined
  } finally {
    if (connection) await connection.close();
  }
}

// POST — insert a new row, return the new id
async function createFeedback(data) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("stallId", sql.Int, data.stallId)
      .input("userId", sql.NVarChar, data.userId)
      .input("rating", sql.Int, data.rating)
      .input("comment", sql.NVarChar, data.comment)
      .query(`INSERT INTO Feedback (stallId, userId, rating, comment)
              VALUES (@stallId, @userId, @rating, @comment);
              SELECT SCOPE_IDENTITY() AS feedbackId;`); // grabs the auto id
    return result.recordset[0].feedbackId;
  } finally {
    if (connection) await connection.close();
  }
}

// PUT — update rating + comment. Returns rows changed (0 = id not found).
async function updateFeedback(id, data) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)
      .input("rating", sql.Int, data.rating)
      .input("comment", sql.NVarChar, data.comment)
      .query(`UPDATE Feedback
              SET rating = @rating, comment = @comment
              WHERE feedbackId = @id`);
    return result.rowsAffected[0];      // how many rows the query touched
  } finally {
    if (connection) await connection.close();
  }
}

// DELETE — remove a row. Returns rows deleted (0 = id not found).
async function deleteFeedback(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Feedback WHERE feedbackId = @id");
    return result.rowsAffected[0];
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = {
  getAllFeedback,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  deleteFeedback,
};