// models/productModel.js
// MODEL layer (Week 4 MVC): all database access for the Product Page flow
// (hawker centres -> stalls -> products -> one product).
// Every variable is bound with request.input(...) = parameterized queries (Week 4).
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// ---------- HAWKER CENTRES ----------
async function getAllCenters() {
  const pool = await sql.connect(dbConfig);
  const result = await pool.request().query(
    "SELECT centerId, name, description, location, imagePath FROM HawkerCenters"
  );
  return result.recordset;
}

async function getCenterById(centerId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("centerId", sql.Int, centerId);
  const result = await request.query(
    "SELECT centerId, name, description, location, imagePath " +
    "FROM HawkerCenters WHERE centerId = @centerId"
  );
  return result.recordset[0];
}

// ---------- FOOD STALLS ----------
async function getStallsByCenter(centerId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("centerId", sql.Int, centerId);
  const result = await request.query(
    "SELECT stallId, centerId, name, imagePath " +
    "FROM FoodStalls WHERE centerId = @centerId"
  );
  return result.recordset;
}

async function getStallById(stallId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("stallId", sql.Int, stallId);
  const result = await request.query(
    "SELECT stallId, centerId, name, imagePath FROM FoodStalls WHERE stallId = @stallId"
  );
  return result.recordset[0];
}

// ---------- PRODUCTS ----------
async function getProductsByStall(stallId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("stallId", sql.Int, stallId);
  const result = await request.query(
    "SELECT productId, stallId, name, description, imagePath, basePrice, likes " +
    "FROM Products WHERE stallId = @stallId"
  );
  return result.recordset;
}

async function getProductById(productId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("productId", sql.Int, productId);
  const result = await request.query(
    "SELECT productId, stallId, name, description, imagePath, basePrice, likes " +
    "FROM Products WHERE productId = @productId"
  );
  return result.recordset[0];
}

async function createProduct(data) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("stallId", sql.Int, data.stallId);
  request.input("name", sql.NVarChar, data.name);
  request.input("description", sql.NVarChar, data.description || null);
  request.input("imagePath", sql.NVarChar, data.imagePath || null);
  request.input("basePrice", sql.Decimal(10, 2), data.basePrice);
  const result = await request.query(
    "INSERT INTO Products (stallId, name, description, imagePath, basePrice) " +
    "VALUES (@stallId, @name, @description, @imagePath, @basePrice); " +
    "SELECT SCOPE_IDENTITY() AS productId;"
  );
  return getProductById(result.recordset[0].productId);
}

async function updateProduct(productId, data) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("productId", sql.Int, productId);
  request.input("name", sql.NVarChar, data.name);
  request.input("description", sql.NVarChar, data.description || null);
  request.input("imagePath", sql.NVarChar, data.imagePath || null);
  request.input("basePrice", sql.Decimal(10, 2), data.basePrice);
  await request.query(
    "UPDATE Products SET name = @name, description = @description, " +
    "imagePath = @imagePath, basePrice = @basePrice WHERE productId = @productId"
  );
  return getProductById(productId);
}

async function deleteProduct(productId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("productId", sql.Int, productId);
  const result = await request.query(
    "DELETE FROM Products WHERE productId = @productId"
  );
  return result.rowsAffected[0];
}

module.exports = {
  getAllCenters, getCenterById,
  getStallsByCenter, getStallById,
  getProductsByStall, getProductById,
  createProduct, updateProduct, deleteProduct
};
