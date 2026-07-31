// middlewares/orderValidation.js
// Validation for checkout: only known payment methods / fulfillment types allowed.
//
// This is an allow-list, not a block-list. Anything not on the list is rejected,
// so a client cannot invent a payment method like "free" and have it stored.
const PAYMENT_METHODS = ["cash", "paynow", "visa", "mastercard"];
const FULFILLMENT = ["takeaway", "delivery"];
const MAX_PROMO_LENGTH = 30; // PromoCodes.code is NVARCHAR(30)

function validateCheckout(req, res, next) {
  const { paymentMethod, fulfillment, promoCode } = req.body;

  // --- paymentMethod: required, must be on the allow-list ---
  if (!paymentMethod || typeof paymentMethod !== "string" || !PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({
      message: "paymentMethod is required and must be one of: " + PAYMENT_METHODS.join(", "),
      field: "paymentMethod"
    });
  }

  // --- fulfillment: required, must be on the allow-list ---
  if (!fulfillment || typeof fulfillment !== "string" || !FULFILLMENT.includes(fulfillment)) {
    return res.status(400).json({
      message: "fulfillment is required and must be one of: " + FULFILLMENT.join(", "),
      field: "fulfillment"
    });
  }

  // --- promoCode: optional. If sent it must be text of a sensible length. ---
  // Whether the code actually EXISTS is not decided here - that is a database
  // question, so orderModel.resolvePromo handles it. This middleware only
  // rejects things that could never be a code at all, e.g. an object or a
  // 5,000-character string. Note the client never sends a discount amount:
  // only the code. The server looks up what it is worth.
  if (promoCode !== undefined && promoCode !== null && promoCode !== "") {
    if (typeof promoCode !== "string") {
      return res.status(400).json({
        message: "promoCode must be text.",
        field: "promoCode"
      });
    }
    if (promoCode.trim().length > MAX_PROMO_LENGTH) {
      return res.status(400).json({
        message: `promoCode cannot be longer than ${MAX_PROMO_LENGTH} characters.`,
        field: "promoCode"
      });
    }
  }

  next();
}

module.exports = { validateCheckout, PAYMENT_METHODS, FULFILLMENT };