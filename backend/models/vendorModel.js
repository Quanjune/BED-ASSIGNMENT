// vendorModel.js  (Kishore - Vendor Management)
// Reads/writes the shared Products table. A "menu item" = a Product
// belonging to a FoodStall. Same table QJ uses - one source of truth.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

let poolPromise;
function getPool() {
  if (!poolPromise) poolPromise = new sql.ConnectionPool(dbConfig).connect();
  return poolPromise;
}

async function getAll() {
  const pool = await getPool();
  const r = await pool.request().query("SELECT * FROM Products");
  return r.recordset;
}

async function getByStall(stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, stallId)
    .query("SELECT * FROM Products WHERE stallId = @stallId");
  return r.recordset;
}

async function getById(productId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("productId", sql.Int, productId)
    .query("SELECT * FROM Products WHERE productId = @productId");
  return r.recordset[0];
}

async function stallExists(stallId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, stallId)
    .query("SELECT stallId FROM FoodStalls WHERE stallId = @stallId");
  return r.recordset.length > 0;
}

async function create(p) {
  const pool = await getPool();
  const r = await pool.request()
    .input("stallId", sql.Int, p.stallId)
    .input("name", sql.NVarChar, p.name)
    .input("description", sql.NVarChar, p.description || null)
    .input("imagePath", sql.NVarChar, p.imagePath || null)
    .input("basePrice", sql.Decimal(10, 2), p.basePrice)
    .query(`INSERT INTO Products (stallId, name, description, imagePath, basePrice)
            OUTPUT INSERTED.*
            VALUES (@stallId, @name, @description, @imagePath, @basePrice)`);
  return r.recordset[0];
}

async function update(productId, p) {
  const pool = await getPool();
  const r = await pool.request()
    .input("productId", sql.Int, productId)
    .input("name", sql.NVarChar, p.name)
    .input("description", sql.NVarChar, p.description || null)
    .input("imagePath", sql.NVarChar, p.imagePath || null)
    .input("basePrice", sql.Decimal(10, 2), p.basePrice)
    .query(`UPDATE Products
            SET name=@name, description=@description, imagePath=@imagePath, basePrice=@basePrice
            OUTPUT INSERTED.*
            WHERE productId=@productId`);
  return r.recordset[0];
}

async function remove(productId) {
  const pool = await getPool();
  const r = await pool.request()
    .input("productId", sql.Int, productId)
    .query("DELETE FROM Products OUTPUT DELETED.productId WHERE productId=@productId");
  return r.recordset[0];
}

module.exports = { getAll, getByStall, getById, stallExists, create, update, remove };
