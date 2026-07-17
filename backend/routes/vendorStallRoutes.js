// vendorStallRoutes.js  (Kishore - Vendor Management)
// Mounted in app.js at "/api/vendors/stall".
// One endpoint: "whose stall am I?" - the frontend calls this right after
// login to show "Your stall: Tian Tian Chicken Rice - Maxwell Food Centre".
const express = require("express");
const router = express.Router();
const c = require("../controllers/vendorStallController");
const { requireVendor } = require("../middlewares/vendorAuth");

router.use(requireVendor);

router.get("/", c.getMyStall);   // GET /api/vendors/stall

module.exports = router;
