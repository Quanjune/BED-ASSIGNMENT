// vendorModel.js  (Kishore - Vendor Management)
// Reads/writes the shared Products table (same one QJ's customer pages
// read - one source of truth). Every function takes the stallId that the
// vendorAuth middleware resolved from the login token, so a stall owner
// can only see and change THEIR OWN menu.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

let poolPromise;
function getPool() {
  if (!poolPromise) poolPromise = new sql.ConnectionPool(dbConfig).connect();
  return poolPromise;
}

// All menu items for one stall.
async function getByStall(stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, stallId)
    .query("SELECT * FROM Products WHERE stallId = @stallId ORDER BY productId DESC");
  return r.recordset;
}

// One item - only if it belongs to this stall (ownership check).
async function getByIdForStall(productId, stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("productId", sql.Int, productId)
    .input("stallId", sql.Int, stallId)
    .query("SELECT * FROM Products WHERE productId = @productId AND stallId = @stallId");
  return r.recordset[0];
}

// Insert - stallId comes from the verified token, NOT from the request body.
async function create(stallId, p) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, stallId)
    .input("name", sql.NVarChar, p.name)
    .input("description", sql.NVarChar, p.description || null)
    .input("imagePath", sql.NVarChar, p.imagePath || null)
    .input("basePrice", sql.Decimal(10, 2), p.basePrice)
    .query(`INSERT INTO Products (stallId, name, description, imagePath, basePrice)
            OUTPUT INSERTED.*
            VALUES (@stallId, @name, @description, @imagePath, @basePrice)`);
  return r.recordset[0];
}

// Update - WHERE clause includes stallId, so editing someone else's item
// simply matches 0 rows (controller turns that into a 404).
async function update(productId, stallId, p) {
  const pool = await getPool();
  const r = await pool.request()
    .input("productId", sql.Int, productId)
    .input("stallId", sql.Int, stallId)
    .input("name", sql.NVarChar, p.name)
    .input("description", sql.NVarChar, p.description || null)
    .input("imagePath", sql.NVarChar, p.imagePath || null)
    .input("basePrice", sql.Decimal(10, 2), p.basePrice)
    .query(`UPDATE Products
            SET name=@name, description=@description, imagePath=@imagePath, basePrice=@basePrice
            OUTPUT INSERTED.*
            WHERE productId=@productId AND stallId=@stallId`);
  return r.recordset[0];
}

// Delete - same ownership rule as update.
async function remove(productId, stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("productId", sql.Int, productId)
    .input("stallId", sql.Int, stallId)
    .query(`DELETE FROM Products
            OUTPUT DELETED.productId
            WHERE productId=@productId AND stallId=@stallId`);
  return r.recordset[0];
}

module.exports = { getByStall, getByIdForStall, create, update, remove };
