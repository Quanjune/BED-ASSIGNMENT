// models/orderModel.js
// MODEL layer: turns a user's cart into an order (checkout) and reads order history.
// All money is calculated HERE on the server from real DB prices - the client
// never sends totals, so it cannot fake a cheaper order. The same is true of
// promo codes: the client sends only the CODE, never the discount amount.
const sql = require("mssql");
const dbConfig = require("../config/dbConfig");
const cartModel = require("./cartModel");
const promoModel = require("./promoModel");   // Timely's promo feature - reused, not duplicated

// ---- Business rules (single source of truth) ----
const DELIVERY_FEE   = 5.00;   // fixed delivery fee
const MIN_ORDER      = 12.00;  // minimum spend for delivery
const TAKEAWAY_FEE   = 0.00;   // takeaway has no fee

// Work out the fees for a given subtotal + fulfillment type, minus any promo.
// Exported so the controller (and tests) can reuse the exact same rules.
//
// `promo` is a row from Timely's PromoCodes table, or null/undefined.
// `discountBase` is the slice of the subtotal the promo is actually allowed
// to discount: the whole cart for a platform-wide code, or just one stall's
// lines for a stall-owned code (see resolvePromo). Defaults to the full
// subtotal so existing callers that never pass it (e.g. order history,
// which recalculates fees without re-applying a promo) are unaffected.
function calculateFees(subtotal, fulfillment, promo, discountBase = subtotal) {
  let deliveryFee = 0;
  let minOrderFee = 0;

  if (fulfillment === "delivery") {
    deliveryFee = DELIVERY_FEE;
    // If the cart is under the minimum, charge the shortfall.
    // e.g. $5 cart -> min order fee of $7 to reach $12.
    // Based on the pre-discount subtotal, so a promo code can never be used
    // to dodge the delivery minimum.
    if (subtotal < MIN_ORDER) {
      minOrderFee = MIN_ORDER - subtotal;
    }
  }

  // Promo discount applies to the FOOD subtotal of the stall it belongs to
  // only, never to delivery fees or to a different stall's items in the
  // same cart.
  let discount = 0;
  if (promo) {
    const value = Number(promo.discountValue);
    discount = promo.discountType === "percent" ? (discountBase * value) / 100 : value;
    if (discount > discountBase) discount = discountBase;   // a $5 code on a $3 stall subtotal takes off $3, not $5
  }

  const total =
    subtotal + deliveryFee + minOrderFee
    + (fulfillment === "takeaway" ? TAKEAWAY_FEE : 0)
    - discount;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    minOrderFee: Number(minOrderFee.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number(Math.max(0, total).toFixed(2)),
    minOrder: MIN_ORDER,
    promoCode: promo ? promo.code : null
  };
}

// ---- Subtotal of just the cart lines that belong to one stall ----
// Stall-owned promo codes (PromoCodes.stallId) must only discount that
// stall's food - not a separate stall's items sitting in the same cart.
// Cart rows don't carry stallId, so look it up from the product ids.
// The id list is parameterised (@p0, @p1, ...) - never string-concatenated.
async function stallSubtotal(items, stallId) {
  const ids = items.map(i => i.productId).filter(id => id != null);
  if (ids.length === 0) return 0;

  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  request.input("stallId", sql.Int, stallId);
  const placeholders = ids.map((id, i) => {
    request.input(`p${i}`, sql.Int, id);
    return `@p${i}`;
  }).join(", ");

  const result = await request.query(
    `SELECT productId FROM Products
     WHERE stallId = @stallId AND productId IN (${placeholders})`
  );
  const stallProductIds = new Set(result.recordset.map(r => r.productId));
  return items
    .filter(i => stallProductIds.has(i.productId))
    .reduce((sum, i) => sum + Number(i.lineTotal), 0);
}

// ---- Promo code rules ----
// Looks the code up through Timely's model, then applies the same four rules
// their /api/promos/validate endpoint uses, plus a stall-ownership check.
// Returns { promo, discountBase } on success or { error: "..." } on failure.
// `discountBase` is how much of the cart the code is allowed to discount:
// the full subtotal for a platform-wide code, or just that stall's lines
// for a stall-owned code - see calculateFees.
async function resolvePromo(code, items) {
  if (!code || !String(code).trim()) return { promo: null, discountBase: 0 };

  const promo = await promoModel.getPromoByCode(String(code).trim());

  if (!promo)                                return { error: "Invalid promo code." };
  if (!promo.isActive)                       return { error: "That code is no longer active." };

  // expiryDate is a DATE, so the code stays valid through the END of that day.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(promo.expiryDate) < today)    return { error: "That code has expired." };
  if (promo.timesUsed >= promo.usageLimit)   return { error: "That code has reached its usage limit." };

  // stallId null = platform-wide code, discounts the whole cart. Otherwise
  // the cart must contain something from that stall, and only that stall's
  // lines count toward the discount.
  let discountBase;
  if (promo.stallId != null) {
    discountBase = await stallSubtotal(items, promo.stallId);
    if (discountBase <= 0) {
      return { error: `That code only applies to ${promo.stallName || "its own stall"}.` };
    }
  } else {
    discountBase = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
  }

  return { promo, discountBase };
}

// ---- CHECKOUT: cart -> order ----
// Reads the user's cart server-side, computes fees, writes Orders + OrderItems,
// bumps the promo code's usage counter, then clears the cart.
//
// Every write runs inside a TRANSACTION. A transaction groups statements so
// they either ALL succeed or ALL get undone. Without one, a crash halfway
// through could leave an order with no items in it, a cart that never emptied
// after being paid for, or a promo code counted as used on an order that
// never actually existed.
//   begin()    - open the transaction
//   commit()   - make every change permanent
//   rollback() - undo everything since begin()
async function checkout(userId, paymentMethod, fulfillment, promoCode) {
  const items = await cartModel.getCartByUser(userId);
  if (!items || items.length === 0) return { emptyCart: true };

  // Validate the promo BEFORE opening the transaction - a bad code is a
  // user error, not a database failure, so it shouldn't need a rollback.
  const { promo, error, discountBase } = await resolvePromo(promoCode, items);
  if (error) return { promoError: error };

  // Subtotal from the REAL stored prices, not anything the client sent.
  const subtotal = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
  const fees = calculateFees(subtotal, fulfillment, promo, discountBase);

  // All items in one cart come from the same centre, so take it from line 1.
  // centerId is nullable in the schema, so `?? null` keeps the insert safe.
  const centerId = items[0].centerId ?? null;

  const pool = await sql.connect(dbConfig);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Create the order header.
    // Requests are built from the TRANSACTION, not the pool, so they take part
    // in it. A request built from the pool would commit on its own immediately.
    const orderReq = new sql.Request(transaction);
    orderReq.input("userId", sql.NVarChar, String(userId));
    orderReq.input("centerId", sql.Int, centerId);
    orderReq.input("subtotal", sql.Decimal(10, 2), fees.subtotal);
    orderReq.input("total", sql.Decimal(10, 2), fees.total);
    orderReq.input("paymentMethod", sql.NVarChar, paymentMethod);
    orderReq.input("fulfillment", sql.NVarChar, fulfillment);
    orderReq.input("promoCode", sql.NVarChar, promo ? promo.code : null);
    orderReq.input("discount", sql.Decimal(10, 2), fees.discount);
    const orderRes = await orderReq.query(
      "INSERT INTO Orders (userId, centerId, subtotal, total, paymentMethod, fulfillment, status, promoCode, discount) " +
      "VALUES (@userId, @centerId, @subtotal, @total, @paymentMethod, @fulfillment, 'paid', @promoCode, @discount); " +
      "SELECT SCOPE_IDENTITY() AS orderId;"
    );
    const orderId = orderRes.recordset[0].orderId;

    // 2. Copy each cart line into OrderItems (name + addons so history reads well).
    for (const item of items) {
      const addonText = item.addons && item.addons.length
        ? " (" + item.addons.map(a => a.label).join(", ") + ")"
        : "";
      const itemReq = new sql.Request(transaction);
      itemReq.input("orderId", sql.Int, orderId);
      itemReq.input("productName", sql.NVarChar, (item.productName + addonText).slice(0, 100));
      itemReq.input("quantity", sql.Int, item.quantity);
      itemReq.input("itemTotal", sql.Decimal(10, 2), Number(item.lineTotal));
      itemReq.input("productId", sql.Int, item.productId);
      await itemReq.query(
        "INSERT INTO OrderItems (orderId, productName, quantity, itemTotal, productId, stallId) " +
        "VALUES (@orderId, @productName, @quantity, @itemTotal, @productId, " +
        "        (SELECT stallId FROM Products WHERE productId = @productId))"
      );
    }

    // 3. Count the promo code as redeemed.
    // The `AND timesUsed < usageLimit` guard means two people checking out at
    // the same moment can never push the counter past its limit.
    if (promo) {
      const promoReq = new sql.Request(transaction);
      promoReq.input("promoId", sql.Int, promo.promoId);
      const used = await promoReq.query(
        "UPDATE PromoCodes SET timesUsed = timesUsed + 1 " +
        "WHERE promoId = @promoId AND timesUsed < usageLimit"
      );
      if (used.rowsAffected[0] === 0) {
        // Someone else took the last redemption between validation and here.
        await transaction.rollback();
        return { promoError: "That code has just reached its usage limit." };
      }
    }

    // 4. Empty the cart now the order exists.
    // Done inline (not via cartModel.clearCart) because that helper builds its
    // request from the pool, which would sit OUTSIDE this transaction.
    const delAddons = new sql.Request(transaction);
    delAddons.input("userId", sql.NVarChar, String(userId));
    await delAddons.query(
      "DELETE a FROM CartItemAddons a " +
      "JOIN CartItems c ON c.cartItemId = a.cartItemId " +
      "WHERE c.userId = @userId"
    );

    const delItems = new sql.Request(transaction);
    delItems.input("userId", sql.NVarChar, String(userId));
    await delItems.query("DELETE FROM CartItems WHERE userId = @userId");

    // Everything worked - make it permanent.
    await transaction.commit();

    return { orderId, ...fees, paymentMethod, fulfillment, status: "paid" };
  } catch (err) {
    // Something failed - undo all of the above so the DB is left untouched.
    await transaction.rollback();
    throw err; // let the controller turn this into a 500 response
  }
}

// ---- Order history ----
// Returns each order with its line items attached, newest first.
async function getOrdersByUser(userId) {
  const pool = await sql.connect(dbConfig);

  const orderReq = pool.request();
  orderReq.input("userId", sql.NVarChar, String(userId));
  // LEFT JOIN (not INNER) because orders placed before centerId was recorded
  // have NULL - an inner join would hide them from the history page entirely.
  const orderRes = await orderReq.query(
    "SELECT o.orderId, o.subtotal, o.total, o.paymentMethod, o.fulfillment, " +
    "       o.status, o.createdAt, o.promoCode, o.discount, h.name AS centerName " +
    "FROM Orders o " +
    "LEFT JOIN HawkerCenters h ON h.centerId = o.centerId " +
    "WHERE o.userId = @userId " +
    "ORDER BY o.orderId DESC"
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
    // the same numbers the cart showed at checkout. The discount is read
    // from the order itself, not recalculated, in case the code has since
    // been edited or deleted by the vendor.
    const fees = calculateFees(Number(o.subtotal), o.fulfillment);
    return {
      ...o,
      items,
      discount: Number(o.discount || 0),
      deliveryFee: fees.deliveryFee,
      minOrderFee: fees.minOrderFee
    };
  });
}

module.exports = {
  checkout,
  getOrdersByUser,
  calculateFees,
  resolvePromo,
  DELIVERY_FEE,
  MIN_ORDER
};