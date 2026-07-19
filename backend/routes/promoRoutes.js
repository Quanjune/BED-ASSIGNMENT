// routes/promoRoutes.js
// ROUTES: maps HTTP method + path -> controller function. Mounted under
// /api/promos in app.js. Self-contained: no cart routes live here.
const express = require("express");
const router = express.Router();
const promoController = require("../controllers/promoController");
const { validatePromo } = require("../middlewares/promoValidation");

// IMPORTANT: /validate/:code is registered BEFORE /:id. Express matches
// routes top-to-bottom, so if /:id came first, a request to
// /api/promos/validate/SAVE5 would never reach this handler.
router.get("/validate/:code", promoController.validatePromoCode); // GET /api/promos/validate/SAVE5 (read-only check)

router.get("/", promoController.getAllPromos);                          // GET    /api/promos
router.get("/:id", promoController.getPromoById);                       // GET    /api/promos/3
router.post("/", validatePromo, promoController.createPromo);           // POST   /api/promos
router.put("/:id", validatePromo, promoController.updatePromo);         // PUT    /api/promos/3
router.delete("/:id", promoController.deletePromo);                     // DELETE /api/promos/3

module.exports = router;