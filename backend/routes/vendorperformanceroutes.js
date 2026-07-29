// vendorPerformanceRoutes.js  (Kishore - Vendor Management, Sprint 3)
// Mounted in app.js at "/api/vendors/performance".
// Same protection as the menu and agreements routes:
//   token -> vendor role -> own stall only.
const express = require("express");
const router = express.Router();
const c = require("../controllers/vendorPerformanceController");
const { requireVendor } = require("../middlewares/vendorAuth");

router.use(requireVendor);

// GET /api/vendors/performance?days=30   (days: 7 | 14 | 30 | 90)
router.get("/", c.getPerformance);

module.exports = router;