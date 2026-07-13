// routes/cartRoutes.js
// ROUTES (Week 3 table: HTTP method -> CRUD). Mounted under /api/cart in app.js.
const express = require("express");
const router = express.Router();
const controller = require("../controllers/cartController");
const { validateAddToCart, validateUpdateQuantity } = require("../middlewares/cartValidation");

// Authentication (Aswin's auth middleware, Week 11).
// The cart belongs to a specific logged-in user, so EVERY cart route
// requires a valid token. verifyToken sets req.user = { userId, role }.
const { verifyToken } = require("../middlewares/authMiddleware");

// All cart routes are private: you must be logged in to have a cart.
// Middleware runs left to right: verifyToken -> (validation) -> controller.
// If verifyToken fails it responds 401/403 and the controller never runs.

router.get("/", verifyToken, controller.getMyCart); // view my cart

router.post(
  "/",
  verifyToken,
  validateAddToCart,
  controller.addToCart // add a product (or bump quantity)
);

router.put(
  "/:cartItemId",
  verifyToken,
  validateUpdateQuantity,
  controller.updateQuantity // change a line's quantity
);

router.delete("/:cartItemId", verifyToken, controller.removeCartItem); // remove one line
router.delete("/", verifyToken, controller.clearCart); // empty the whole cart

module.exports = router;
