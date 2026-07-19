// vendorRoutes.js  (Kishore - Vendor Management)
// Mounted in app.js at "/api/vendors/menu".
// Every route below requires: valid JWT -> role 'vendor' -> owns a stall.
// The stallId is resolved from the token, so there is NO stall id in the
// URL or body - a vendor can only ever manage their own menu.
const express = require("express");
const router = express.Router();
const c = require("../controllers/vendorController");
const validate = require("../middlewares/validate");
const { requireVendor } = require("../middlewares/vendorAuth");
const { createMenuItem, updateMenuItem } = require("../validators/vendorValidator");

router.use(requireVendor); // protects everything in this file

router.get("/", c.getMyItems);                              // GET    /api/vendors/menu
router.get("/:id", c.getItem);                              // GET    /api/vendors/menu/5
router.post("/", validate(createMenuItem), c.addItem);      // POST   /api/vendors/menu
router.put("/:id", validate(updateMenuItem), c.editItem);   // PUT    /api/vendors/menu/5
router.delete("/:id", c.deleteItem);                        // DELETE /api/vendors/menu/5

module.exports = router;
