// middlewares/promoValidation.js
// Validation MIDDLEWARE (Week 4): runs after routing, before the controller.
// On bad input it short-circuits with 400 and the controller never runs.
// On good input it also CLEANS the body (trim, uppercase, number coercion)
// so the controller and model can trust what they receive.

function validatePromo(req, res, next) {
  const { code, discountType, discountValue, expiryDate, usageLimit, isActive } = req.body;

  // code: required, 3-50 chars, letters/numbers only (e.g. SAVE5)
  if (!code || typeof code !== "string" || code.trim().length < 3 || code.trim().length > 50) {
    return res.status(400).json({ message: "code is required and must be 3-50 characters.", field: "code" });
  }
  if (!/^[A-Za-z0-9]+$/.test(code.trim())) {
    return res.status(400).json({ message: "code may only contain letters and numbers.", field: "code" });
  }

  // discountType: must be exactly 'percent' or 'fixed' (same values the DB CHECK allows)
  if (discountType !== "percent" && discountType !== "fixed") {
    return res.status(400).json({ message: "discountType must be 'percent' or 'fixed'.", field: "discountType" });
  }

  // discountValue: positive number; a percentage can't exceed 100
  const value = parseFloat(discountValue);
  if (discountValue === undefined || isNaN(value) || value <= 0) {
    return res.status(400).json({ message: "discountValue is required and must be a positive number.", field: "discountValue" });
  }
  if (discountType === "percent" && value > 100) {
    return res.status(400).json({ message: "a percent discount cannot exceed 100.", field: "discountValue" });
  }

  // expiryDate: must parse to a real date (e.g. '2026-12-31')
  if (!expiryDate || isNaN(Date.parse(expiryDate))) {
    return res.status(400).json({ message: "expiryDate is required and must be a valid date (YYYY-MM-DD).", field: "expiryDate" });
  }

  // usageLimit: whole number, at least 1
  const limit = parseInt(usageLimit);
  if (usageLimit === undefined || isNaN(limit) || limit < 1) {
    return res.status(400).json({ message: "usageLimit is required and must be a whole number of at least 1.", field: "usageLimit" });
  }

  // isActive: optional; accepts true/false/1/0; defaults to true when omitted
  if (isActive !== undefined && typeof isActive !== "boolean" && isActive !== 1 && isActive !== 0) {
    return res.status(400).json({ message: "isActive must be true or false.", field: "isActive" });
  }

  // Write the cleaned, normalised values back so downstream code trusts them.
  req.body.code = code.trim().toUpperCase();   // 'save5 ' -> 'SAVE5' (codes stored uppercase)
  req.body.discountValue = value;
  req.body.usageLimit = limit;
  req.body.isActive = isActive === undefined ? true : Boolean(isActive);

  next();
}

module.exports = { validatePromo };