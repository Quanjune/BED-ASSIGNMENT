const sql = require('mssql');
const dbConfig = require('../config/dbConfig');

// Find one user by email. Returns undefined if no match.
async function findUserByEmail(email) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input('email', sql.NVarChar, email) // parameterised input to prevent SQL injection
      .query('SELECT userId, name, email, passwordHash, role FROM Users WHERE email = @email');
    return result.recordset[0];
  } finally {
    if (connection) await connection.close();
  }
}

// Insert a new user, return the auto-generated userId.
async function createUser({ name, email, passwordHash, role }) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('passwordHash', sql.NVarChar, passwordHash)
      .input('role', sql.NVarChar, role)
      .query(`INSERT INTO Users (name, email, passwordHash, role)
              VALUES (@name, @email, @passwordHash, @role);
              SELECT SCOPE_IDENTITY() AS userId;`);
    return result.recordset[0].userId;
  } finally {
    if (connection) await connection.close();
  }
}

// Find one user by their id (returns undefined if none)
async function findUserById(userId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input('userId', sql.Int, userId)
      .query('SELECT userId, name, email, role, createdAt, cardLast4 FROM Users WHERE userId = @userId');
    return result.recordset[0];
  } finally {
    if (connection) await connection.close();
  }
}

async function updateUser(userId, { name, email }) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input('userId', sql.Int, userId)
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .query('UPDATE Users SET name = @name, email = @email WHERE userId = @userId');
    return result.rowsAffected[0]; // how many rows changed
  } finally { if (connection) await connection.close(); }
}

async function deleteUser(userId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM Users WHERE userId = @userId');
    return result.rowsAffected[0]; // how many rows deleted
  } finally { if (connection) await connection.close(); }
}

async function getAllUsers() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .query('SELECT userId, name, email, role, createdAt FROM Users ORDER BY userId');
    return result.recordset; // never returns passwordHash
  } finally { if (connection) await connection.close(); }
}

// Save (overwrite) the user's card. Only the last 4 digits are ever stored.
async function saveCard(userId, cardLast4) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input('userId', sql.Int, userId)
      .input('cardLast4', sql.Char(4), cardLast4)
      .query('UPDATE Users SET cardLast4=@cardLast4 WHERE userId=@userId');
    return result.rowsAffected[0];
  } finally { if (connection) await connection.close(); }
}

// Remove the saved card (set the column back to NULL).
async function removeCard(userId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input('userId', sql.Int, userId)
      .query('UPDATE Users SET cardLast4=NULL WHERE userId=@userId');
    return result.rowsAffected[0];
  } finally { if (connection) await connection.close(); }
}

module.exports = { findUserByEmail, createUser, findUserById, updateUser, deleteUser, getAllUsers, saveCard, removeCard };