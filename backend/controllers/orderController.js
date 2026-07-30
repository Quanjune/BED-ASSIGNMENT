// controllers/orderController.js
// CONTROLLER: checkout (cart -> order) and order history for the logged-in user.
const orderModel = require("../models/orderModel");
const cartModel = require("../models/cartModel");
const userModel = require("../models/userModel");

// Card payments need a saved card on the user's profile.
const CARD_METHODS = ["visa", "mastercard"];

// GET /api/orders/quote?fulfillment=delivery&promoCode=SAVE5
// Returns the fee breakdown for the CURRENT cart without placing an order.
// The cart page calls this so the fees shown always match the server's rules.
// If the promo code is bad, the quote still returns - it just comes back with
// promoError set and no discount, so the page can show why.
async function getQuote(req, res) {
  try {
    const fulfillment = req.query.fulfillment === "delivery" ? "delivery" : "takeaway";
    const items = await cartModel.getCartByUser(req.user.userId);
    const subtotal = items.reduce((sum, i) => sum + Number(i.lineTotal), 0);

    const { promo, error } = await orderModel.resolvePromo(req.query.promoCode, items);

    res.status(200).json({
      ...orderModel.calculateFees(subtotal, fulfillment, promo),
      promoError: error || null
    });
  } catch (err) {
    console.error("getQuote:", err);
    res.status(500).json({ message: "Error calculating totals." });
  }
}

// POST /api/orders  { paymentMethod, fulfillment, promoCode? }
// Places the order. All money is recalculated server-side.
async function checkout(req, res) {
  try {
    const { paymentMethod, fulfillment, promoCode } = req.body;

    // Card payments require a saved card. Checked HERE as well as in the
    // browser, because a client-side check alone can be bypassed by anyone
    // calling the API directly.
    if (CARD_METHODS.includes(paymentMethod)) {
      const user = await userModel.findUserById(req.user.userId);
      if (!user || !user.cardLast4) {
        return res.status(400).json({
          code: "NO_CARD",
          message: "No saved card on your profile. Add a card before paying by card."
        });
      }
    }

    const result = await orderModel.checkout(
      req.user.userId, paymentMethod, fulfillment, promoCode
    );

    if (result && result.emptyCart) {
      return res.status(400).json({ message: "Your cart is empty." });
    }
    // Bad promo code is a user error (400), not a server failure (500).
    if (result && result.promoError) {
      return res.status(400).json({ code: "BAD_PROMO", message: result.promoError });
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