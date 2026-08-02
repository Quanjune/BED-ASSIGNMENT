// controllers/weatherController.js  (Quan Jun - customer-facing third-party API)
//
// Request/response side of /api/weather. The model already handles caching,
// timeouts and the outside world being unreliable, so what is left here is
// deciding what each outcome looks like to the front end.
//
// Design note worth defending in the demo:
// "NEA is unreachable" is NOT a 500. Our server is working perfectly - we
// simply have no weather to show. A 500 would make the console look like the
// app is broken and push the front end down an error path for a missing
// nice-to-have. So an unreachable forecast returns 200 with an empty list /
// null, and the page quietly renders without a weather chip.
const weatherModel = require("../models/weatherModel");

// GET /api/weather/centers
// Forecast for every hawker centre, in one request. centers.js calls this once
// for the whole page rather than once per card.
async function getCenterForecasts(req, res) {
  try {
    const forecasts = await weatherModel.getForecastsForCenters();
    res.status(200).json(forecasts);   // [] when NEA is unavailable
  } catch (err) {
    console.error("getCenterForecasts error:", err);
    res.status(500).json({ message: "Could not load weather information. Please try again." });
  }
}

// GET /api/weather/centers/:centerId
// Forecast for one centre. Used by the cart page at checkout.
async function getCenterForecast(req, res) {
  try {
    const centerId = parseInt(req.params.centerId);
    const forecast = await weatherModel.getForecastForCenter(centerId);

    // Two "nothing to show" cases - NEA is down, or this centre has no
    // coordinates in the lookup - deliberately share one response shape so the
    // front end has a single thing to check. Neither is a client mistake, so
    // neither is a 404.
    if (!forecast) return res.status(200).json(null);

    res.status(200).json(forecast);
  } catch (err) {
    console.error("getCenterForecast error:", err);
    res.status(500).json({ message: "Could not load weather information. Please try again." });
  }
}

module.exports = { getCenterForecasts, getCenterForecast };