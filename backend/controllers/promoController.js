// controllers/promoController.js
// CONTROLLER layer: takes the HTTP request, calls the model, decides the
// status code + JSON to send back. No SQL in here, no cart logic anywhere.
const promoModel = require("../models/promoModel");

async function getAllPromos(req, res) {
  try {
    const promos = await promoModel.getAllPromos();
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
    res.json(promo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve promo code" });
  }
}

async function createPromo(req, res) {
  try {
    // body already validated + cleaned by promoValidation middleware
    const newId = await promoModel.createPromo(req.body);
    res.status(201).json({ message: "Promo code created", promoId: newId });
  } catch (error) {
    // 2627/2601 = SQL Server "unique constraint violated" -> duplicate code
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ error: "A promo with this code already exists" });
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
// READ-ONLY check — the one endpoint the cart feature will call.
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
    const value = Number(promo.discountValue);
    const discountText = promo.discountType === "percent" ? `${value}% off` : `$${value} off`;
    res.json({
      valid: true,
      discountType: promo.discountType,
      discountValue: value,
      message: `${promo.code} applied: ${discountText}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to validate promo code" });
  }
}

module.exports = {
  getAllPromos,
  getPromoById,
  createPromo,
  updatePromo,
  deletePromo,
  validatePromoCode,
};