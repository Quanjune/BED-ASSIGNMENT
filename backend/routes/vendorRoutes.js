// vendorRoutes.js  (Kishore - Vendor Management)
// Mounted in app.js at "/api/vendors/menu" (your own lane, separate from QJ's /api/products).
const express = require("express");
const router = express.Router();
const c = require("../controllers/vendorController");
const validate = require("../middlewares/validate");
const { createMenuItem, updateMenuItem } = require("../validators/vendorValidator");

router.get("/", c.getAllItems);                       // GET    /api/vendors/menu
router.get("/stall/:stallId", c.getItemsByStall);     // GET    /api/vendors/menu/stall/1
router.get("/:id", c.getItem);                        // GET    /api/vendors/menu/5
router.post("/", validate(createMenuItem), c.addItem);      // POST   /api/vendors/menu
router.put("/:id", validate(updateMenuItem), c.editItem);   // PUT    /api/vendors/menu/5
router.delete("/:id", c.deleteItem);                  // DELETE /api/vendors/menu/5

module.exports = router;
