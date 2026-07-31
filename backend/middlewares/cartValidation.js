// middlewares/cartValidation.js
// Validation MIDDLEWARE (Week 4): runs after routing, before the controller.
// On bad input it short-circuits with 400 and the controller never runs.
//
// Every check sends back BOTH a human message and the `field` that failed, so
// the front-end can highlight the right input instead of showing a generic
// "something went wrong".

// Quantity limits. MAX exists because CartItems.quantity is an INT and because
// nobody orders 50,000 plates of chicken rice - an absurd number is far more
// likely to be a typo or someone poking the API than a real order.
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

// Used by POST /api/cart  (adding a product to the cart).
function validateAddToCart(req, res, next) {
  const { productId, quantity, optionIds } = req.body;

  // --- productId: required, must be a positive whole number ---
  if (productId === undefined || productId === null || !/^\d+$/.test(String(productId))) {
    return res.status(400).json({
      message: "productId is required and must be a positive whole number.",
      field: "productId"
    });
  }

  // --- quantity: optional (defaults to 1), but if sent it must be sane ---
  if (quantity !== undefined) {
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < MIN_QUANTITY || q > MAX_QUANTITY) {
      return res.status(400).json({
        message: `quantity must be a whole number between ${MIN_QUANTITY} and ${MAX_QUANTITY}.`,
        field: "quantity"
      });
    }
  }

  // --- optionIds: optional array of addon option ids, e.g. [3, 7] ---
  // Previously anything that wasn't an array was silently ignored, so a typo
  // like optionIds: "3" meant the customer's choices vanished with no warning.
  // Failing loudly is better than losing their order silently.
  if (optionIds !== undefined) {
    if (!Array.isArray(optionIds)) {
      return res.status(400).json({
        message: "optionIds must be an array of option ids, e.g. [3, 7].",
        field: "optionIds"
      });
    }
    if (optionIds.length > 20) {
      return res.status(400).json({
        message: "optionIds cannot contain more than 20 options.",
        field: "optionIds"
      });
    }
    for (const id of optionIds) {
      if (!/^\d+$/.test(String(id))) {
        return res.status(400).json({
          message: "Every value in optionIds must be a positive whole number.",
          field: "optionIds"
        });
      }
    }
    // Duplicate ids would charge for the same addon twice.
    if (new Set(optionIds.map(Number)).size !== optionIds.length) {
      return res.status(400).json({
        message: "optionIds cannot contain the same option twice.",
        field: "optionIds"
      });
    }
  }

  next();
}

// Used by PUT /api/cart/:cartItemId  (changing a line's quantity).
function validateUpdateQuantity(req, res, next) {
  const { quantity } = req.body;

  if (quantity === undefined || quantity === null) {
    return res.status(400).json({
      message: "quantity is required.",
      field: "quantity"
    });
  }

  const q = Number(quantity);
  if (!Number.isInteger(q) || q < MIN_QUANTITY || q > MAX_QUANTITY) {
    return res.status(400).json({
      message: `quantity must be a whole number between ${MIN_QUANTITY} and ${MAX_QUANTITY}.`,
      field: "quantity"
    });
  }

  next();
}

module.exports = { validateAddToCart, validateUpdateQuantity, MIN_QUANTITY, MAX_QUANTITY };