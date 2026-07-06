const sql = require('mssql');
const dbConfig = require('../config/dbConfig');

// Find one user by email. Returns undefined if no match.
async function findUserByEmail(email) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input('email', sql.NVarChar, email) // parameterised = safe from SQL injection
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

module.exports = { findUserByEmail, createUser };