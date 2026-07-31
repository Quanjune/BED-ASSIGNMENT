// middlewares/idValidation.js
// Validation MIDDLEWARE (Week 4) for URL parameters.
//
// WHY THIS EXISTS
// Every route with an :id in the URL used to do parseInt(req.params.id) straight
// inside the controller. If someone requests /api/products/abc, parseInt gives
// NaN, mssql quietly turns NaN into NULL, and the query matches nothing - so the
// user gets "Product not found." (404) for what is really a malformed request.
// A 404 says "that thing doesn't exist"; the honest answer is 400 "that isn't an
// id at all". Checking it here also means the controller can trust req.params.
//
// USAGE (in a routes file):
//   const { validateIdParam } = require("../middlewares/idValidation");
//   router.get("/products/:id", validateIdParam("id"), controller.getProductById);

// Returns a middleware that checks one named URL parameter is a positive whole
// number. Written as a factory (a function that returns a function) so the same
// code works for :id, :centerId, :cartItemId and so on.
function validateIdParam(paramName) {
  return function (req, res, next) {
    const raw = req.params[paramName];
    const value = Number(raw);

    // Number("") is 0 and Number("5abc") is NaN, so test the string form too:
    // only digits, no sign, no decimal point.
    if (!/^\d+$/.test(String(raw)) || !Number.isInteger(value) || value < 1) {
      return res.status(400).json({
        message: `${paramName} must be a positive whole number.`,
        field: paramName
      });
    }

    next();
  };
}

module.exports = { validateIdParam };