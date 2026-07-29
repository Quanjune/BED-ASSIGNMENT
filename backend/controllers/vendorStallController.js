// vendorStallController.js  (Kishore - Vendor Management)
// Returns the logged-in vendor's own stall (for the dashboard header).
const model = require("../models/vendorStallModel");

async function getMyStall(req, res) {
  try {
    const stall = await model.getStallProfile(req.stallId); // set by vendorAuth
    if (!stall) return res.status(404).json({ error: "Stall not found" });
    res.status(200).json(stall);
  } catch (err) {
    console.error("ERROR:", err);
    console.error("MESSAGE:", err.message);
    console.error("CODE:", err.code);
    console.error("ORIGINAL:", err.originalError);

    res.status(500).json({ error: "Internal Server Error" });
}
}

module.exports = { getMyStall };


async function getMyStall(req, res) {
  try {
    console.log("Fetching profile for stall:", req.stallId);

    const stall = await model.getStallProfile(req.stallId);

    console.log("Returned:", stall);

    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    res.status(200).json(stall);
  } catch (err) {
    console.error("ERROR:", err);
    console.error("MESSAGE:", err.message);
    console.error("CODE:", err.code);
    console.error("ORIGINAL:", err.originalError);

    res.status(500).json({ error: "Internal Server Error" });
}
}