// controllers/orderController.js
// CONTROLLER: checkout (cart -> order) and order history for the logged-in user.
const orderModel = require("../models/orderModel");
const cartModel = require("../models/cartModel");

// GET /api/orders/quote?fulfillment=delivery
// Returns the fee breakdown for the CURRENT cart without placing an order.
// The cart page calls this so the fees shown always match the server's rules.
async function getQuote(req, res) {
  try {
    const fulfillment = req.query.fulfillment === "delivery" ? "delivery" : "takeaway";
    const items = await cartModel.getCartByUser(req.user.userId);
    const subtotal = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);
    res.status(200).json(orderModel.calculateFees(subtotal, fulfillment));
  } catch (err) {
    console.error("getQuote:", err);
    res.status(500).json({ message: "Error calculating totals." });
  }
}

// POST /api/orders  { paymentMethod, fulfillment }
// Places the order. All money is recalculated server-side.
async function checkout(req, res) {
  try {
    const { paymentMethod, fulfillment } = req.body;
    const result = await orderModel.checkout(req.user.userId, paymentMethod, fulfillment);

    if (result && result.emptyCart) {
      return res.status(400).json({ message: "Your cart is empty." });
    }
    res.status(201).json(result);
  } catch (err) {
    console.error("checkout:", err);
    res.status(500).json({ message: "Payment could not be completed." });
  }
}

// GET /api/orders  -> this user's past orders
async function getMyOrders(req, res) {
  try {
    res.status(200).json(await orderModel.getOrdersByUser(req.user.userId));
  } catch (err) {
    console.error("getMyOrders:", err);
    res.status(500).json({ message: "Error retrieving orders." });
  }
}

module.exports = { getQuote, checkout, getMyOrders };
