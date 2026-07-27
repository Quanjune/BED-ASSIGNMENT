// middlewares/promoAuth.js  (Timely - Promotions)
// Auth chain for the promo-management routes.
//
// Promo codes are now OWNED BY A STALL (PromoCodes.stallId):
//   * a vendor may only see / create / edit / delete codes for their own stall
//   * an admin sees everything and may also manage platform-wide codes
//     (the rows where stallId IS NULL)
//
// This middleware reuses Aswin's verifyToken/authorizeRoles and Kishore's
// stall lookup, then attaches req.stallId ONLY for vendors. The controller
// reads req.stallId to decide scope: a value means "vendor, restrict to this
// stall", undefined means "admin, no restriction".
//
// Note we cannot reuse Kishore's requireVendor here because that one rejects
// admins - promo management has to allow both roles.
const { verifyToken, authorizeRoles } = require("./authMiddleware"); // Aswin's
const stallModel = require("../models/vendorStallModel");            // Kishore's

async function attachStallForVendor(req, res, next) {
  try {
    // Admins are deliberately left unscoped: req.stallId stays undefined.
    if (req.user.role !== "vendor") return next();

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

// Use as: router.post("/", requirePromoManager, ...)
// 1) valid token?  2) vendor or admin?  3) which stall (vendors only)?
const requirePromoManager = [verifyToken, authorizeRoles("vendor", "admin"), attachStallForVendor];

module.exports = { requirePromoManager, attachStallForVendor };