// vendorStallController.js  (Kishore - Vendor Management)
// Returns the logged-in vendor's own stall (for the dashboard header).
const model = require("../models/vendorStallModel");

async function getMyStall(req, res) {
  try {
    const stall = await model.getStallProfile(req.stallId); // set by vendorAuth
    if (!stall) return res.status(404).json({ error: "Stall not found" });
    res.status(200).json(stall);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { getMyStall };
