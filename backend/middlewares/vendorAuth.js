// vendorAuth.js  (Kishore - Vendor Management)
// Glue between Aswin's auth and my vendor lane.
//
// Aswin's verifyToken gives us req.user = { userId, role } from the JWT.
// This middleware looks up WHICH stall that user owns and attaches it as
// req.stallId. Every vendor route reads req.stallId instead of trusting a
// stallId from the URL/body — so a vendor only ever touches their OWN stall.
const { verifyToken, authorizeRoles } = require("./authMiddleware"); // Aswin's
const stallModel = require("../models/vendorStallModel");

async function attachVendorStall(req, res, next) {
  try {
    const stallId = await stallModel.getStallIdForUser(req.user.userId);
    if (!stallId) {
      return res.status(403).json({ error: "This vendor account has no stall assigned yet." });
    }
    req.stallId = stallId;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// 1) valid token?  2) role is vendor?  3) which stall is theirs?
const requireVendor = [verifyToken, authorizeRoles("vendor"), attachVendorStall];

module.exports = { requireVendor, attachVendorStall };