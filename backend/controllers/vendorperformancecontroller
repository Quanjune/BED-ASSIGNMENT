// vendorPerformanceController.js  (Kishore - Vendor Management, Sprint 3)
// One read-only endpoint. The stall comes from the token (req.stallId),
// so a vendor can never ask for someone else's numbers by editing a URL.
const model = require("../models/vendorPerformanceModel");

// Only these windows are allowed. Anything else is rejected rather than
// silently coerced, so a typo shows up as a 400 instead of wrong data.
const ALLOWED_DAYS = [7, 14, 30, 90];

async function getPerformance(req, res) {
  try {
    const raw = req.query.days;
    const days = raw === undefined ? 30 : Number(raw);

    if (!Number.isInteger(days) || !ALLOWED_DAYS.includes(days)) {
      return res.status(400).json({
        error: `'days' must be one of ${ALLOWED_DAYS.join(", ")}.`,
      });
    }

    const data = await model.getDashboard(req.stallId, days);

    // A brand new stall is not an error - it gets zeroed sections and a
    // friendly empty state on the page (AC2).
    res.status(200).json(data);
  } catch (err) {
    console.error("getPerformance failed:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { getPerformance };