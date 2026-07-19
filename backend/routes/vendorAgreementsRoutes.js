// vendorAgreementsRoutes.js  (Kishore - Vendor Management, Sprint 2 rework)
// Mounted in app.js at "/api/vendors/agreements".
// Same protection as the menu: token -> vendor role -> own stall only.
const express = require("express");
const router = express.Router();
const c = require("../controllers/vendorAgreementsController");
const validate = require("../middlewares/validate");
const { requireVendor } = require("../middlewares/vendorAuth");
const { createAgreement, updateAgreement } = require("../validators/vendorAgreementsValidator");

router.use(requireVendor);

router.get("/", c.getMyAgreements);                               // GET    /api/vendors/agreements
router.get("/:id", c.getAgreement);                               // GET    /api/vendors/agreements/5
router.post("/", validate(createAgreement), c.addAgreement);      // POST   /api/vendors/agreements
router.put("/:id", validate(updateAgreement), c.editAgreement);   // PUT    /api/vendors/agreements/5
router.delete("/:id", c.deleteAgreement);                         // DELETE /api/vendors/agreements/5

module.exports = router;
