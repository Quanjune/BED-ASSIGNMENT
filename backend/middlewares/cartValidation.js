// middlewares/cartValidation.js
// Validation MIDDLEWARE (Week 4): runs after routing, before the controller.
// On bad input it short-circuits with 400 and the controller never runs.

// Used by POST /api/cart  (adding a product to the cart).
function validateAddToCart(req, res, next) {
  const { productId, quantity } = req.body;

  if (productId === undefined || isNaN(parseInt(productId))) {
    return res.status(400).json({ message: "productId is required and must be a number.", field: "productId" });
  }
  // quantity is optional on add (defaults to 1), but if sent it must be valid.
  if (quantity !== undefined && (isNaN(parseInt(quantity)) || parseInt(quantity) < 1)) {
    return res.status(400).json({ message: "quantity must be a whole number of at least 1.", field: "quantity" });
  }
  next();
}

// Used by PUT /api/cart/:cartItemId  (changing a line's quantity).
function validateUpdateQuantity(req, res, next) {
  const { quantity } = req.body;

  if (quantity === undefined || isNaN(parseInt(quantity)) || parseInt(quantity) < 1) {
    return res.status(400).json({ message: "quantity is required and must be a whole number of at least 1.", field: "quantity" });
  }
  next();
}

module.exports = { validateAddToCart, validateUpdateQuantity };
