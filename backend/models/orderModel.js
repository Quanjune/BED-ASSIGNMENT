// models/orderModel.js
// MODEL layer: turns a user's cart into an order (checkout) and reads order history.
// All money is calculated HERE on the server from real DB prices - the client
// never sends totals, so it cannot fake a cheaper order.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");
const cartModel = require("./cartModel");

// ---- Business rules (single source of truth) ----
const DELIVERY_FEE   = 5.00;   // fixed delivery fee
const MIN_ORDER      = 12.00;  // minimum spend for delivery
const TAKEAWAY_FEE   = 0.00;   // takeaway has no fee

// Work out the fees for a given subtotal + fulfillment type.
// Exported so the controller (and tests) can reuse the exact same rules.
function calculateFees(subtotal, fulfillment) {
  let deliveryFee = 0;
  let minOrderFee = 0;

  if (fulfillment === "delivery") {
    deliveryFee = DELIVERY_FEE;
    // If the cart is under the minimum, charge the shortfall.
    // e.g. $5 cart -> min order fee of $7 to reach $12.
    if (subtotal < MIN_ORDER) {
      minOrderFee = MIN_ORDER - subtotal;
    }
  }

  const total = subtotal + deliveryFee + minOrderFee + (fulfillment === "takeaway" ? TAKEAWAY_FEE : 0);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    minOrderFee: Number(minOrderFee.toFixed(2)),
    total: Number(total.toFixed(2)),
    minOrder: MIN_ORDER
  };
}

// ---- CHECKOUT: cart -> order ----
// Reads the user's cart server-side, computes fees, writes Orders + OrderItems,
// then clears the cart. Returns the created order.
async function checkout(userId, paymentMethod, fulfillment) {
  const items = await cartModel.getCartByUser(userId);
  if (!items || items.length === 0) return { emptyCart: true };

  // Subtotal from the REAL stored prices, not anything the client sent.
  const subtotal = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
  const fees = calculateFees(subtotal, fulfillment);

  const pool = await sql.connect(dbConfig);

  // 1. Create the order header.
  const orderReq = pool.request();
  orderReq.input("userId", sql.NVarChar, String(userId));
  orderReq.input("subtotal", sql.Decimal(10, 2), fees.subtotal);
  orderReq.input("total", sql.Decimal(10, 2), fees.total);
  orderReq.input("paymentMethod", sql.NVarChar, paymentMethod);
  orderReq.input("fulfillment", sql.NVarChar, fulfillment);
  const orderRes = await orderReq.query(
    "INSERT INTO Orders (userId, subtotal, total, paymentMethod, fulfillment, status) " +
    "VALUES (@userId, @subtotal, @total, @paymentMethod, @fulfillment, 'paid'); " +
    "SELECT SCOPE_IDENTITY() AS orderId;"
  );
  const orderId = orderRes.recordset[0].orderId;

  // 2. Copy each cart line into OrderItems (name + addons so history reads well).
  for (const item of items) {
    const addonText = item.addons && item.addons.length
      ? " (" + item.addons.map(a => a.label).join(", ") + ")"
      : "";
    const itemReq = pool.request();
    itemReq.input("orderId", sql.Int, orderId);
    itemReq.input("productName", sql.NVarChar, (item.productName + addonText).slice(0, 100));
    itemReq.input("quantity", sql.Int, item.quantity);
    itemReq.input("itemTotal", sql.Decimal(10, 2), Number(item.lineTotal));
    await itemReq.query(
      "INSERT INTO OrderItems (orderId, productName, quantity, itemTotal) " +
      "VALUES (@orderId, @productName, @quantity, @itemTotal)"
    );
  }

  // 3. Empty the cart now the order exists.
  await cartModel.clearCart(userId);

  return { orderId, ...fees, paymentMethod, fulfillment, status: "paid" };
}

// ---- Order history ----
// Returns each order with its line items attached, newest first.
async function getOrdersByUser(userId) {
  const pool = await sql.connect(dbConfig);

  const orderReq = pool.request();
  orderReq.input("userId", sql.NVarChar, String(userId));
  const orderRes = await orderReq.query(
    "SELECT orderId, subtotal, total, paymentMethod, fulfillment, status, createdAt " +
    "FROM Orders WHERE userId = @userId ORDER BY orderId DESC"
  );
  const orders = orderRes.recordset;
  if (orders.length === 0) return [];

  // Fetch all line items for these orders in one query, then group them.
  const itemReq = pool.request();
  itemReq.input("userId", sql.NVarChar, String(userId));
  const itemRes = await itemReq.query(
    "SELECT oi.orderId, oi.productName, oi.quantity, oi.itemTotal " +
    "FROM OrderItems oi " +
    "INNER JOIN Orders o ON o.orderId = oi.orderId " +
    "WHERE o.userId = @userId " +
    "ORDER BY oi.orderItemId"
  );

  return orders.map(o => {
    const items = itemRes.recordset.filter(i => i.orderId === o.orderId);
    // Recompute the fee breakdown from the stored subtotal so history shows
    // the same numbers the cart showed at checkout.
    const fees = calculateFees(Number(o.subtotal), o.fulfillment);
    return {
      ...o,
      items,
      deliveryFee: fees.deliveryFee,
      minOrderFee: fees.minOrderFee
    };
  });
}

module.exports = { checkout, getOrdersByUser, calculateFees, DELIVERY_FEE, MIN_ORDER };
