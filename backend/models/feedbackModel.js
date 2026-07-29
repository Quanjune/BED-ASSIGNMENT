// models/feedbackModel.js
// MODEL layer: the only file that talks to the Feedback table.
//
// ABOUT userId: the column is NVARCHAR and now stores the numeric userId
// taken from the JWT (e.g. "3"). Older seeded rows hold free text such as
// "user123". Every read below LEFT JOINs Users through TRY_CAST so we can
// show a real name when the id matches a real account, and fall back to the
// raw stored value when it doesn't - which keeps the sample rows readable.
// TRY_CAST returns NULL instead of throwing when the text isn't a number,
// so "user123" simply finds no match rather than blowing up the query.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// Shared column list + joins so every read returns the same shape.
const SELECT_COLUMNS = `
        f.feedbackId, f.stallId, f.userId, f.rating, f.comment, f.createdAt,
        f.vendorReply, f.vendorRepliedAt,
        COALESCE(u.name, f.userId) AS userName,
        s.name AS stallName, s.centerId, c.name AS centerName`;

const FROM_JOINS = `
      FROM Feedback f
      INNER JOIN FoodStalls s    ON f.stallId = s.stallId
      INNER JOIN HawkerCenters c ON s.centerId = c.centerId
      LEFT  JOIN Users u         ON TRY_CAST(f.userId AS INT) = u.userId`;

// GET all - newest first.
async function getAllFeedback() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .query(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS} ORDER BY f.createdAt DESC`);
    return result.recordset;            // recordset = the array of rows
  } finally {
    if (connection) await connection.close();   // always close, even on error
  }
}

// GET the reviews for ONE stall - powers the stall review page and the
// vendor's read-only Reviews panel.
async function getFeedbackByStall(stallId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("stallId", sql.Int, stallId)
      .query(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS}
              WHERE f.stallId = @stallId
              ORDER BY f.createdAt DESC`);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// GET the average rating + review count for EVERY stall, in one query.
// The stalls listing calls this once and merges it into the cards, instead
// of firing one request per stall.
// ROUND(...,1) keeps it to one decimal so the UI can print "4.5" directly.
async function getStallRatings() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .query(`SELECT stallId,
                     ROUND(AVG(CAST(rating AS FLOAT)), 1) AS avgRating,
                     COUNT(*) AS reviewCount
              FROM Feedback
              GROUP BY stallId`);
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// GET one - by its id (same JOINs so edit mode can pre-select centre + stall).
async function getFeedbackById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)         // parameterised input (safe from injection)
      .query(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE f.feedbackId = @id`);
    return result.recordset[0];         // first row, or undefined
  } finally {
    if (connection) await connection.close();
  }
}

// POST - insert a new row, return the new id.
// data.userId is set by the CONTROLLER from the JWT, never from the body.
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

// PUT - update rating + comment. Returns rows changed (0 = id not found).
// The stall and the author can never change on an edit.
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

// PUT (vendor) - save or clear the stall's public reply to a review.
// Only the reply columns are touched: the customer's rating and comment are
// never modified here, which is what keeps a review the customer's own words.
// Passing an empty reply clears it and blanks the timestamp.
async function updateVendorReply(id, reply) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const hasReply = Boolean(reply && reply.trim());
    const result = await connection.request()
      .input("id", sql.Int, id)
      .input("reply", sql.NVarChar, hasReply ? reply.trim() : null)
      .query(`UPDATE Feedback
              SET vendorReply = @reply,
                  vendorRepliedAt = ${hasReply ? "GETDATE()" : "NULL"}
              WHERE feedbackId = @id`);
    return result.rowsAffected[0];
  } finally {
    if (connection) await connection.close();
  }
}

// DELETE - remove a row. Returns rows deleted (0 = id not found).
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
  getFeedbackByStall,
  getStallRatings,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  updateVendorReply,
  deleteFeedback,
};