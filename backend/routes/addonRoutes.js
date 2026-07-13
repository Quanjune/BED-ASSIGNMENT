// routes/addonRoutes.js
// Public route: anyone can view a product's options (no login needed to browse).
// Mounted at /api/products in app.js  ->  GET /api/products/:productId/addons
const express = require("express");
const router = express.Router();
const controller = require("../controllers/addonController");

router.get("/:productId/addons", controller.getProductAddons);

module.exports = router;
