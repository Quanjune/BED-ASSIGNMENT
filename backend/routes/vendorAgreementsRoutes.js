// vendorAgreementsRoutes.js  (Kishore - Vendor Management, Sprint 2)
// Mounted in app.js at "/api/vendors/agreements" (your own lane).
const express = require("express");
const router = express.Router();
const c = require("../controllers/vendorAgreementsController");
const validate = require("../middlewares/validate");
const { createAgreement, updateAgreement } = require("../validators/vendorAgreementsValidator");

router.get("/", c.getAllAgreements);                     // GET  /api/vendors/agreements
router.get("/stall/:stallId", c.getAgreementsByStall);   // GET  /api/vendors/agreements/stall/1
router.get("/:id", c.getAgreement);                      // GET  /api/vendors/agreements/5
router.post("/", validate(createAgreement), c.addAgreement);    // POST /api/vendors/agreements
router.put("/:id", validate(updateAgreement), c.editAgreement); // PUT  /api/vendors/agreements/5

module.exports = router;