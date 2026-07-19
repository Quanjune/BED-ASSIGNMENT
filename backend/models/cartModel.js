// models/cartModel.js
// MODEL layer (Week 4 MVC): all database access for the shopping cart.
// One CartItems row = one product line a logged-in user has added.
// Every variable is bound with request.input(...) = parameterized queries (Week 4).
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");
const addonModel = require("./addonModel");

// ---------- READ ----------
// Return every cart line for one user, joined to Products, PLUS the chosen
// addons for each line so the cart can show "Chicken Rice (Roasted, Extra Chicken)".
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
  const items = result.recordset;

  // Attach chosen addons to each line (one extra query, then group in JS).
  if (items.length > 0) {
    const addonReq = pool.request();
    addonReq.input("userId", sql.NVarChar, String(userId));
    const addonRes = await addonReq.query(
      "SELECT a.cartItemId, a.label, a.priceAtAdd " +
      "FROM CartItemAddons a " +
      "JOIN CartItems c ON c.cartItemId = a.cartItemId " +
      "WHERE c.userId = @userId " +
      "ORDER BY a.cartItemAddonId"
    );
    const byLine = {};
    for (const row of addonRes.recordset) {
      (byLine[row.cartItemId] = byLine[row.cartItemId] || []).push({
        label: row.label,
        price: Number(row.priceAtAdd)
      });
    }
    for (const item of items) item.addons = byLine[item.cartItemId] || [];
  }

  return items;
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

// Helper: does this user already have this product in their cart WITH NO addons?
// (Lines that have addons are always kept separate, since two identical
//  products with different options are genuinely different cart lines.)
async function findPlainLine(userId, productId) {
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("userId", sql.NVarChar, String(userId));
  request.input("productId", sql.Int, productId);
  const result = await request.query(
    "SELECT c.cartItemId, c.quantity FROM CartItems c " +
    "WHERE c.userId = @userId AND c.productId = @productId " +
    "AND NOT EXISTS (SELECT 1 FROM CartItemAddons a WHERE a.cartItemId = c.cartItemId)"
  );
  return result.recordset[0];
}

// ---------- CREATE / ADD ----------
// Add a product to the cart with optional chosen addon optionIds.
// - unitPrice is computed server-side: basePrice + sum of chosen addon prices.
//   (The client sends only optionIds, never prices — no faking.)
// - If there are NO addons and the same plain product is already in the cart,
//   we bump quantity. If there ARE addons, we always add a new line.
async function addToCart(userId, productId, quantity, optionIds) {
  const pool = await sql.connect(dbConfig);

  // 1. Real base price from Products.
  const priceReq = pool.request();
  priceReq.input("productId", sql.Int, productId);
  const priceResult = await priceReq.query(
    "SELECT productId, basePrice FROM Products WHERE productId = @productId"
  );
  const product = priceResult.recordset[0];
  if (!product) return { notFound: true };

  // 2. Look up chosen options server-side; validate they belong to THIS product.
  const chosen = await addonModel.getOptionsByIds(optionIds || []);
  for (const opt of chosen) {
    if (opt.productId !== productId) {
      return { invalidOption: true }; // an option that isn't for this product
    }
  }
  const addonsTotal = chosen.reduce((sum, o) => sum + Number(o.price), 0);
  const unitPrice = Number(product.basePrice) + addonsTotal;

  // 3. No addons + identical plain line already present -> bump quantity.
  if (chosen.length === 0) {
    const existing = await findPlainLine(userId, productId);
    if (existing) {
      const updReq = pool.request();
      updReq.input("cartItemId", sql.Int, existing.cartItemId);
      updReq.input("quantity", sql.Int, existing.quantity + quantity);
      await updReq.query(
        "UPDATE CartItems SET quantity = @quantity WHERE cartItemId = @cartItemId"
      );
      return getCartItemById(existing.cartItemId);
    }
  }

  // 4. Insert a new cart line.
  const insReq = pool.request();
  insReq.input("userId", sql.NVarChar, String(userId));
  insReq.input("productId", sql.Int, productId);
  insReq.input("quantity", sql.Int, quantity);
  insReq.input("unitPrice", sql.Decimal(10, 2), unitPrice);
  const insResult = await insReq.query(
    "INSERT INTO CartItems (userId, productId, quantity, unitPrice) " +
    "VALUES (@userId, @productId, @quantity, @unitPrice); " +
    "SELECT SCOPE_IDENTITY() AS cartItemId;"
  );
  const cartItemId = insResult.recordset[0].cartItemId;

  // 5. Save each chosen addon (label + price frozen at add-time).
  for (const opt of chosen) {
    const aReq = pool.request();
    aReq.input("cartItemId", sql.Int, cartItemId);
    aReq.input("optionId", sql.Int, opt.optionId);
    aReq.input("label", sql.NVarChar, opt.label);
    aReq.input("priceAtAdd", sql.Decimal(10, 2), opt.price);
    await aReq.query(
      "INSERT INTO CartItemAddons (cartItemId, optionId, label, priceAtAdd) " +
      "VALUES (@cartItemId, @optionId, @label, @priceAtAdd)"
    );
  }

  return getCartItemById(cartItemId);
}

// ---------- UPDATE ----------
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
// Remove one cart line (and its addons first, to satisfy the foreign key).
async function removeCartItem(cartItemId) {
  const pool = await sql.connect(dbConfig);

  const delAddons = pool.request();
  delAddons.input("cartItemId", sql.Int, cartItemId);
  await delAddons.query("DELETE FROM CartItemAddons WHERE cartItemId = @cartItemId");

  const request = pool.request();
  request.input("cartItemId", sql.Int, cartItemId);
  const result = await request.query(
    "DELETE FROM CartItems WHERE cartItemId = @cartItemId"
  );
  return result.rowsAffected[0];
}

// Empty the whole cart for one user (addons first, then the lines).
async function clearCart(userId) {
  const pool = await sql.connect(dbConfig);

  const delAddons = pool.request();
  delAddons.input("userId", sql.NVarChar, String(userId));
  await delAddons.query(
    "DELETE a FROM CartItemAddons a " +
    "JOIN CartItems c ON c.cartItemId = a.cartItemId " +
    "WHERE c.userId = @userId"
  );

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