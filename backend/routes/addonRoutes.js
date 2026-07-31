// routes/addonRoutes.js
// Public route: anyone can view a product's options (no login needed to browse).
// This deliberately has NO verifyToken — it is read-only menu information, the
// same as GET /api/products/:id. Making it private would stop a guest from
// seeing "Steamed or Roasted?" before deciding to sign up.
// Mounted at /api/products in app.js  ->  GET /api/products/:productId/addons
const express = require("express");
const router = express.Router();
const controller = require("../controllers/addonController");
const { validateIdParam } = require("../middlewares/idValidation");

router.get("/:productId/addons", validateIdParam("productId"), controller.getProductAddons);

module.exports = router;