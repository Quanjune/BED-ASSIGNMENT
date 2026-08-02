// routes/weatherRoutes.js  (Quan Jun - customer-facing third-party API)
//
// WHO CAN DO WHAT
//   GET /centers             public - 2-hour forecast for every hawker centre
//   GET /centers/:centerId   public - 2-hour forecast for one centre
//
// Both are public and read-only. A weather forecast is public information and
// none of it is tied to a user, so a token would only stop guests browsing
// centres from seeing it - the same reasoning behind public hygiene-grade reads.
//
// This is mounted at /api/weather (see app.js). Kaden's weather lives at
// /api/inspections/weather, so the two never collide.
//
// No POST/PUT/DELETE here on purpose: we do not own this data, NEA does. This
// feature READS a third-party API; the CRUD marks come from cart, orders and
// addons.
const express = require("express");
const router = express.Router();
const weatherController = require("../controllers/weatherController");
const { validateIdParam } = require("../middlewares/idValidation");

// Reusing validateIdParam rather than writing a fresh check: a centreId that
// arrives as "abc" is rejected with 400 before the controller runs.
router.get("/centers", weatherController.getCenterForecasts);
router.get("/centers/:centerId", validateIdParam("centerId"), weatherController.getCenterForecast);

module.exports = router;