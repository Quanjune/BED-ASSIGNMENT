// routes/promoRoutes.js
// ROUTES: maps HTTP method + path -> controller function. Mounted under
// /api/promos in app.js. Self-contained: no cart routes live here.
//
// WHO CAN DO WHAT
//   GET  /active         public   - the customer promotions page
//   GET  /validate/:code public   - the read-only check the cart calls
//   GET  /               vendor+admin - vendor sees own stall, admin sees all
//   GET  /:id            vendor+admin - ownership checked in the controller
//   POST / PUT / DELETE  vendor+admin - ownership checked in the controller
//
// Anything that changes data now needs a Bearer token. To test in Postman:
// POST /api/auth/login, copy accessToken, then send
//   Authorization: Bearer <accessToken>
const express = require("express");
const router = express.Router();
const promoController = require("../controllers/promoController");
const { validatePromo } = require("../middlewares/promoValidation");
const { requirePromoManager } = require("../middlewares/promoAuth");

// IMPORTANT: the two fixed paths are registered BEFORE /:id. Express matches
// routes top-to-bottom, so if /:id came first a request to
// /api/promos/active would be read as id="active" and never reach this handler.
router.get("/active", promoController.getActivePromos);           // GET /api/promos/active   (public)
router.get("/validate/:code", promoController.validatePromoCode); // GET /api/promos/validate/SAVE5 (public)

router.get("/", requirePromoManager, promoController.getAllPromos);                        // GET    /api/promos
router.get("/:id", requirePromoManager, promoController.getPromoById);                     // GET    /api/promos/3
router.post("/", requirePromoManager, validatePromo, promoController.createPromo);         // POST   /api/promos
router.put("/:id", requirePromoManager, validatePromo, promoController.updatePromo);       // PUT    /api/promos/3
router.delete("/:id", requirePromoManager, promoController.deletePromo);                   // DELETE /api/promos/3

module.exports = router;