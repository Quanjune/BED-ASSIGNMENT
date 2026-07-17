// routes/orderRoutes.js
// Mounted at /api/orders in app.js. Orders belong to a user, so all routes
// require a valid login token (verifyToken sets req.user.userId).
const express = require("express");
const router = express.Router();
const controller = require("../controllers/orderController");
const { validateCheckout } = require("../middlewares/orderValidation");
const { verifyToken } = require("../middlewares/authMiddleware");

router.get("/quote", verifyToken, controller.getQuote);          // fee preview for current cart
router.post("/", verifyToken, validateCheckout, controller.checkout); // place order (checkout)
router.get("/", verifyToken, controller.getMyOrders);            // order history

module.exports = router;
