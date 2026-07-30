// controllers/promoController.js
// CONTROLLER layer: takes the HTTP request, calls the model, decides the
// status code + JSON to send back. No SQL in here, no cart logic anywhere.
//
// OWNERSHIP RULE (new): codes belong to a stall.
//   req.stallId is set by promoAuth ONLY for vendors.
//     - vendor  -> req.stallId is a number  -> may only touch that stall's codes
//     - admin   -> req.stallId is undefined -> may touch everything
// Every write re-reads the row from the DB and checks it before changing it,
// so a vendor cannot edit another stall's code by guessing its id.
const promoModel = require("../models/promoModel");

// Shared guard. Returns true when the caller is allowed to touch this promo.
function canManage(req, promo) {
  if (req.user.role === "admin") return true;         // admin: anything
  // Sitewide codes are gone; a NULL here could only be a legacy leftover, and
  // a vendor must never be able to edit one.
  if (promo.stallId === null) return false;
  return promo.stallId === req.stallId;               // vendor: only their own stall
}

// GET /api/promos
// Vendor sees only their stall's codes; admin sees all of them.
async function getAllPromos(req, res) {
  try {
    const promos = await promoModel.getAllPromos(req.stallId);
    res.json(promos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve promo codes" });
  }
}

// GET /api/promos/active  (PUBLIC)
// The customer-facing list: only codes that are usable right now.
async function getActivePromos(req, res) {
  try {
    const promos = await promoModel.getActivePromos();
    res.json(promos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve promo codes" });
  }
}

async function getPromoById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid promo id" });
    }
    const promo = await promoModel.getPromoById(id);
    if (!promo) {
      return res.status(404).json({ error: "Promo code not found" });
    }
    if (!canManage(req, promo)) {
      return res.status(403).json({ error: "That promo code belongs to another stall." });
    }
    res.json(promo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve promo code" });
  }
}

async function createPromo(req, res) {
  try {
    // body already validated + cleaned by promoValidation middleware.
    // Every code belongs to a stall - sitewide (NULL-stall) codes no longer
    // exist. A vendor's code is stamped with their own stall from the token;
    // an admin must name which stall the code is for. Neither can create a
    // code with no stall.
    let stallId;
    if (req.user.role === "vendor") {
      stallId = req.stallId;
    } else {
      // admin: a stall is required (no sitewide codes any more)
      if (req.body.stallId === undefined || req.body.stallId === null || req.body.stallId === "") {
        return res.status(400).json({ message: "stallId is required - codes must belong to a stall.", field: "stallId" });
      }
      stallId = parseInt(req.body.stallId);
      if (isNaN(stallId)) {
        return res.status(400).json({ message: "stallId must be a number.", field: "stallId" });
      }
    }

    const newId = await promoModel.createPromo({ ...req.body, stallId });
    res.status(201).json({ message: "Promo code created", promoId: newId });
  } catch (error) {
    // 2627/2601 = SQL Server "unique constraint violated" -> duplicate code
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ error: "A promo with this code already exists" });
    }
    // 547 = FK violation -> stallId that doesn't exist
    if (error.number === 547) {
      return res.status(400).json({ error: "That stall does not exist" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to create promo code" });
  }
}

async function updatePromo(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid promo id" });
    }

    // Read it first so we can check who owns it before writing.
    const existing = await promoModel.getPromoById(id);
    if (!existing) {
      return res.status(404).json({ error: "Promo code not found" });
    }
    if (!canManage(req, existing)) {
      return res.status(403).json({ error: "That promo code belongs to another stall." });
    }

    const rowsChanged = await promoModel.updatePromo(id, req.body);
    if (rowsChanged === 0) {
      return res.status(404).json({ error: "Promo code not found" });
    }
    res.json({ message: "Promo code updated" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ error: "A promo with this code already exists" });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to update promo code" });
  }
}

async function deletePromo(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid promo id" });
    }

    const existing = await promoModel.getPromoById(id);
    if (!existing) {
      return res.status(404).json({ error: "Promo code not found" });
    }
    if (!canManage(req, existing)) {
      return res.status(403).json({ error: "That promo code belongs to another stall." });
    }

    const rowsDeleted = await promoModel.deletePromo(id);
    if (rowsDeleted === 0) {
      return res.status(404).json({ error: "Promo code not found" });
    }
    res.json({ message: "Promo code deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete promo code" });
  }
}

// GET /api/promos/validate/:code
// READ-ONLY check - the one endpoint the cart feature will call.
// It answers "is this code usable, and what discount does it give?" and
// nothing more. It never touches CartItems, never applies a discount,
// and never increments timesUsed. Response shape is a fixed contract:
//   { valid, discountType, discountValue, message }   <- names must not change
// Every outcome returns 200, because the CHECK itself succeeded; the
// caller just reads the `valid` field to know the result.
async function validatePromoCode(req, res) {
  try {
    const promo = await promoModel.getPromoByCode(req.params.code);

    // Rule 1: the code must exist
    if (!promo) {
      return res.json({ valid: false, message: "Invalid promo code" });
    }

    // Rule 2: it must be switched on
    if (!promo.isActive) {
      return res.json({ valid: false, message: "Code is inactive" });
    }

    // Rule 3: it must not be expired.
    // expiryDate is a DATE, so the code stays valid through the END of that
    // day: compare dates at midnight, and only fail when expiry < today.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(promo.expiryDate) < today) {
      return res.json({ valid: false, message: "Code expired" });
    }

    // Rule 4: it must have redemptions left
    if (promo.timesUsed >= promo.usageLimit) {
      return res.json({ valid: false, message: "Code usage limit reached" });
    }

    // All rules passed -> return the discount details (contract shape).
    // Number() turns the DECIMAL 5.00 into 5, so the message reads "$5 off".
    // stallId/stallName are ADDED fields, not replacements - the cart can
    // ignore them, or use them to check the code suits what's in the basket.
    const value = Number(promo.discountValue);
    const discountText = promo.discountType === "percent" ? `${value}% off` : `$${value} off`;
    res.json({
      valid: true,
      discountType: promo.discountType,
      discountValue: value,
      stallId: promo.stallId,                       // null = works on any stall
      stallName: promo.stallName || null,
      message: `${promo.code} applied: ${discountText}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to validate promo code" });
  }
}

module.exports = {
  getAllPromos,
  getActivePromos,
  getPromoById,
  createPromo,
  updatePromo,
  deletePromo,
  validatePromoCode,
};