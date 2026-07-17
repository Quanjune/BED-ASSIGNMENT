// models/promoModel.js
// MODEL layer: the ONLY file that talks to the PromoCodes table.
// Self-contained feature — never reads or writes CartItems / cart data.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// GET all — returns every promo code (newest first)
async function getAllPromos() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .query("SELECT * FROM PromoCodes ORDER BY promoId DESC");
    return result.recordset;            // recordset = the array of rows
  } finally {
    if (connection) await connection.close();   // always close, even on error
  }
}

// GET one — by its id. Returns undefined if no match.
async function getPromoById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)         // parameterised input (safe from injection)
      .query("SELECT * FROM PromoCodes WHERE promoId = @id");
    return result.recordset[0];         // first row, or undefined
  } finally {
    if (connection) await connection.close();
  }
}

// GET one — by its code string (used by the validate endpoint).
// READ-ONLY: it looks the code up and nothing else.
async function getPromoByCode(code) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("code", sql.NVarChar, code.trim().toUpperCase()) // normalise: 'save5' finds 'SAVE5'
      .query("SELECT * FROM PromoCodes WHERE code = @code");
    return result.recordset[0];
  } finally {
    if (connection) await connection.close();
  }
}

// POST — insert a new code, return the new id.
// timesUsed is NOT accepted from the client: it always starts at 0 (DB default).
async function createPromo(data) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("code", sql.NVarChar, data.code)
      .input("discountType", sql.NVarChar, data.discountType)
      .input("discountValue", sql.Decimal(6, 2), data.discountValue)
      .input("expiryDate", sql.Date, data.expiryDate)
      .input("usageLimit", sql.Int, data.usageLimit)
      .input("isActive", sql.Bit, data.isActive)
      .query(`INSERT INTO PromoCodes (code, discountType, discountValue, expiryDate, usageLimit, isActive)
              VALUES (@code, @discountType, @discountValue, @expiryDate, @usageLimit, @isActive);
              SELECT SCOPE_IDENTITY() AS promoId;`); // grabs the auto id
    return result.recordset[0].promoId;
  } finally {
    if (connection) await connection.close();
  }
}

// PUT — full update of a code's settings. Returns rows changed (0 = id not found).
// timesUsed is deliberately NOT updatable here — it's a system counter, not a setting.
async function updatePromo(id, data) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)
      .input("code", sql.NVarChar, data.code)
      .input("discountType", sql.NVarChar, data.discountType)
      .input("discountValue", sql.Decimal(6, 2), data.discountValue)
      .input("expiryDate", sql.Date, data.expiryDate)
      .input("usageLimit", sql.Int, data.usageLimit)
      .input("isActive", sql.Bit, data.isActive)
      .query(`UPDATE PromoCodes
              SET code = @code, discountType = @discountType, discountValue = @discountValue,
                  expiryDate = @expiryDate, usageLimit = @usageLimit, isActive = @isActive
              WHERE promoId = @id`);
    return result.rowsAffected[0];      // how many rows the query touched
  } finally {
    if (connection) await connection.close();
  }
}

// DELETE — remove a code entirely. Returns rows deleted (0 = id not found).
// (To merely switch a code off instead, PUT it with isActive: false.)
async function deletePromo(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM PromoCodes WHERE promoId = @id");
    return result.rowsAffected[0];
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = {
  getAllPromos,
  getPromoById,
  getPromoByCode,
  createPromo,
  updatePromo,
  deletePromo,
};