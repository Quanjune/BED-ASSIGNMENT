// middlewares/productValidation.js
// Validation MIDDLEWARE (Week 4): runs after routing, before the controller.
// On bad input it short-circuits with 400 and the controller never runs.

function validateProduct(req, res, next) {
  const { stallId, name, basePrice } = req.body;

  if (stallId === undefined || isNaN(parseInt(stallId))) {
    return res.status(400).json({ message: "stallId is required and must be a number.", field: "stallId" });
  }
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ message: "name must be at least 2 characters.", field: "name" });
  }
  if (basePrice === undefined || isNaN(parseFloat(basePrice)) || parseFloat(basePrice) < 0) {
    return res.status(400).json({ message: "basePrice is required and must be a non-negative number.", field: "basePrice" });
  }
  next();
}

module.exports = { validateProduct };
