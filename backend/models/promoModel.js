// models/promoModel.js
// MODEL layer: the ONLY file that talks to the PromoCodes table.
// Self-contained feature - never reads or writes CartItems / cart data.
//
// Codes are owned by a stall (PromoCodes.stallId):
//   stallId = <n>  -> belongs to that stall, managed by that stall's vendor
//   stallId = NULL -> platform-wide, managed by an admin
// Every read below LEFT JOINs FoodStalls so the UI can label a code with the
// stall it belongs to (LEFT, not INNER: an inner join would hide the
// platform-wide rows entirely).
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// The column list shared by the read queries, so the shape never drifts.
const SELECT_COLUMNS = `
        p.promoId, p.stallId, p.code, p.discountType, p.discountValue,
        p.expiryDate, p.usageLimit, p.timesUsed, p.isActive,
        s.name AS stallName, c.name AS centerName`;

const FROM_JOINS = `
      FROM PromoCodes p
      LEFT JOIN FoodStalls s    ON s.stallId  = p.stallId
      LEFT JOIN HawkerCenters c ON c.centerId = s.centerId`;

// GET all - every promo code (newest first).
// stallId argument is OPTIONAL: pass a number to restrict to one stall
// (that is what a vendor gets), pass nothing for the full admin view.
async function getAllPromos(stallId) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const request = connection.request();

    let where = "";
    if (stallId !== undefined && stallId !== null) {
      request.input("stallId", sql.Int, stallId);
      where = " WHERE p.stallId = @stallId";
    }

    const result = await request.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_JOINS}${where} ORDER BY p.promoId DESC`
    );
    return result.recordset;            // recordset = the array of rows
  } finally {
    if (connection) await connection.close();   // always close, even on error
  }
}

// GET the codes a CUSTOMER can actually use right now.
// Public endpoint, so it filters out anything switched off, expired or
// fully redeemed - the same three rules the validate endpoint applies.
async function getActivePromos() {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request().query(
      `SELECT ${SELECT_COLUMNS} ${FROM_JOINS}
       WHERE p.isActive = 1
         AND p.expiryDate >= CAST(GETDATE() AS DATE)
         AND p.timesUsed < p.usageLimit
       ORDER BY CASE WHEN p.stallId IS NULL THEN 0 ELSE 1 END, p.expiryDate ASC`
    );
    return result.recordset;
  } finally {
    if (connection) await connection.close();
  }
}

// GET one - by its id. Returns undefined if no match.
async function getPromoById(id) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("id", sql.Int, id)         // parameterised input (safe from injection)
      .query(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE p.promoId = @id`);
    return result.recordset[0];         // first row, or undefined
  } finally {
    if (connection) await connection.close();
  }
}

// GET one - by its code string (used by the validate endpoint).
// READ-ONLY: it looks the code up and nothing else.
async function getPromoByCode(code) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("code", sql.NVarChar, code.trim().toUpperCase()) // 'save5' finds 'SAVE5'
      .query(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE p.code = @code`);
    return result.recordset[0];
  } finally {
    if (connection) await connection.close();
  }
}

// POST - insert a new code, return the new id.
// timesUsed is NOT accepted from the client: it always starts at 0 (DB default).
// stallId is set by the CONTROLLER from the token, never from the request body,
// so a vendor cannot create a code under someone else's stall.
async function createPromo(data) {
  let connection;
  try {
    connection = await sql.connect(dbConfig);
    const result = await connection.request()
      .input("stallId", sql.Int, data.stallId ?? null)
      .input("code", sql.NVarChar, data.code)
      .input("discountType", sql.NVarChar, data.discountType)
      .input("discountValue", sql.Decimal(6, 2), data.discountValue)
      .input("expiryDate", sql.Date, data.expiryDate)
      .input("usageLimit", sql.Int, data.usageLimit)
      .input("isActive", sql.Bit, data.isActive)
      .query(`INSERT INTO PromoCodes (stallId, code, discountType, discountValue, expiryDate, usageLimit, isActive)
              VALUES (@stallId, @code, @discountType, @discountValue, @expiryDate, @usageLimit, @isActive);
              SELECT SCOPE_IDENTITY() AS promoId;`); // grabs the auto id
    return result.recordset[0].promoId;
  } finally {
    if (connection) await connection.close();
  }
}

// PUT - full update of a code's settings. Returns rows changed (0 = id not found).
// timesUsed is deliberately NOT updatable - it's a system counter, not a setting.
// stallId is NOT updatable either: a code cannot be moved to another stall,
// which removes any way for a vendor to hand a code to (or steal one from) someone else.
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

// DELETE - remove a code entirely. Returns rows deleted (0 = id not found).
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
  getActivePromos,
  getPromoById,
  getPromoByCode,
  createPromo,
  updatePromo,
  deletePromo,
};