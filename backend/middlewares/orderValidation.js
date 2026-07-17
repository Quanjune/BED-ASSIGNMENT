// middlewares/orderValidation.js
// Validation for checkout: only known payment methods / fulfillment types allowed.
const PAYMENT_METHODS = ["cash", "paynow", "visa", "mastercard"];
const FULFILLMENT = ["takeaway", "delivery"];

function validateCheckout(req, res, next) {
  const { paymentMethod, fulfillment } = req.body;

  if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({
      message: "paymentMethod is required and must be one of: " + PAYMENT_METHODS.join(", "),
      field: "paymentMethod"
    });
  }
  if (!fulfillment || !FULFILLMENT.includes(fulfillment)) {
    return res.status(400).json({
      message: "fulfillment is required and must be one of: " + FULFILLMENT.join(", "),
      field: "fulfillment"
    });
  }
  next();
}

module.exports = { validateCheckout };
