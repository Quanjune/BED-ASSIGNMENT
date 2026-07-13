// models/cartModel.js
// MODEL layer (Week 4 MVC): all database access for the shopping cart.
// One CartItems row = one product line a logged-in user has added.
// Every variable is bound with request.input(...) = parameterized queries (Week 4).
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");

// ---------- READ ----------
// Return every cart line for one user, joined to Products so the
// front-end gets the name / image without a second request.
async function getCartByUser(userId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("userId", sql.NVarChar, String(userId));
  const result = await request.query(
    "SELECT c.cartItemId, c.userId, c.productId, c.quantity, c.unitPrice, " +
    "       p.name AS productName, p.imagePath, " +
    "       (c.quantity * c.unitPrice) AS lineTotal " +
    "FROM CartItems c " +
    "JOIN Products p ON p.productId = c.productId " +
    "WHERE c.userId = @userId " +
    "ORDER BY c.cartItemId"
  );
  return result.recordset;
}

// Find one specific cart line (used to check ownership before update/delete).
async function getCartItemById(cartItemId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("cartItemId", sql.Int, cartItemId);
  const result = await request.query(
    "SELECT cartItemId, userId, productId, quantity, unitPrice " +
    "FROM CartItems WHERE cartItemId = @cartItemId"
  );
  return result.recordset[0];
}

// Helper: does this user already have this product in their cart?
async function findExistingLine(userId, productId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("userId", sql.NVarChar, String(userId));
  request.input("productId", sql.Int, productId);
  const result = await request.query(
    "SELECT cartItemId, quantity FROM CartItems " +
    "WHERE userId = @userId AND productId = @productId"
  );
  return result.recordset[0];
}

// ---------- CREATE / ADD ----------
// Add a product to the cart. If it's already there, bump the quantity
// instead of creating a duplicate row. unitPrice is read from Products
// server-side so the client can't send a fake price.
async function addToCart(userId, productId, quantity) {
  const pool = await sql.connect(dbConfig);

  // Look up the real price from the product (never trust a client price).
  const priceReq = pool.request();
  priceReq.input("productId", sql.Int, productId);
  const priceResult = await priceReq.query(
    "SELECT productId, basePrice FROM Products WHERE productId = @productId"
  );
  const product = priceResult.recordset[0];
  if (!product) return { notFound: true }; // product doesn't exist

  const existing = await findExistingLine(userId, productId);

  if (existing) {
    // Already in cart -> increase quantity on the existing line.
    const updReq = pool.request();
    updReq.input("cartItemId", sql.Int, existing.cartItemId);
    updReq.input("quantity", sql.Int, existing.quantity + quantity);
    await updReq.query(
      "UPDATE CartItems SET quantity = @quantity WHERE cartItemId = @cartItemId"
    );
    return getCartItemById(existing.cartItemId);
  }

  // New line.
  const insReq = pool.request();
  insReq.input("userId", sql.NVarChar, String(userId));
  insReq.input("productId", sql.Int, productId);
  insReq.input("quantity", sql.Int, quantity);
  insReq.input("unitPrice", sql.Decimal(10, 2), product.basePrice);
  const insResult = await insReq.query(
    "INSERT INTO CartItems (userId, productId, quantity, unitPrice) " +
    "VALUES (@userId, @productId, @quantity, @unitPrice); " +
    "SELECT SCOPE_IDENTITY() AS cartItemId;"
  );
  return getCartItemById(insResult.recordset[0].cartItemId);
}

// ---------- UPDATE ----------
// Set the quantity of one cart line to an exact number.
async function updateQuantity(cartItemId, quantity) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("cartItemId", sql.Int, cartItemId);
  request.input("quantity", sql.Int, quantity);
  await request.query(
    "UPDATE CartItems SET quantity = @quantity WHERE cartItemId = @cartItemId"
  );
  return getCartItemById(cartItemId);
}

// ---------- DELETE ----------
// Remove one cart line.
async function removeCartItem(cartItemId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("cartItemId", sql.Int, cartItemId);
  const result = await request.query(
    "DELETE FROM CartItems WHERE cartItemId = @cartItemId"
  );
  return result.rowsAffected[0];
}

// Empty the whole cart for one user (e.g. after checkout).
async function clearCart(userId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("userId", sql.NVarChar, String(userId));
  const result = await request.query(
    "DELETE FROM CartItems WHERE userId = @userId"
  );
  return result.rowsAffected[0];
}

module.exports = {
  getCartByUser,
  getCartItemById,
  addToCart,
  updateQuantity,
  removeCartItem,
  clearCart
};
