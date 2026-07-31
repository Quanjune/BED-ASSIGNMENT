// middlewares/productValidation.js
// Validation MIDDLEWARE (Week 4): runs after routing, before the controller.
// On bad input it short-circuits with 400 and the controller never runs.
//
// The length limits below are NOT arbitrary - they match the column widths in
// database/qj and kishore masterdata.sql:
//   Products.name        NVARCHAR(100)
//   Products.description NVARCHAR(500)
//   Products.imagePath   NVARCHAR(300)
//   Products.basePrice   DECIMAL(10,2)
// Without them, a 200-character name reaches SQL Server, gets rejected as a
// string-truncation error, and the customer sees a meaningless 500. Catching it
// here turns that into a clear 400 that names the field.
const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;
const MAX_IMAGE_PATH = 300;
const MAX_PRICE = 9999.99; // fits DECIMAL(10,2) with room to spare

function validateProduct(req, res, next) {
  const { stallId, name, description, imagePath, basePrice } = req.body;

  // --- stallId: required, positive whole number (it is a foreign key) ---
  if (stallId === undefined || stallId === null || !/^\d+$/.test(String(stallId))) {
    return res.status(400).json({
      message: "stallId is required and must be a positive whole number.",
      field: "stallId"
    });
  }

  // --- name: required, 2..100 characters ---
  if (typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({
      message: "name is required and must be at least 2 characters.",
      field: "name"
    });
  }
  if (name.trim().length > MAX_NAME) {
    return res.status(400).json({
      message: `name cannot be longer than ${MAX_NAME} characters.`,
      field: "name"
    });
  }

  // --- basePrice: required, 0..9999.99 ---
  const price = Number(basePrice);
  if (basePrice === undefined || basePrice === null || basePrice === "" || isNaN(price)) {
    return res.status(400).json({
      message: "basePrice is required and must be a number.",
      field: "basePrice"
    });
  }
  if (price < 0 || price > MAX_PRICE) {
    return res.status(400).json({
      message: `basePrice must be between 0 and ${MAX_PRICE}.`,
      field: "basePrice"
    });
  }

  // --- description: optional, but capped if present ---
  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      return res.status(400).json({
        message: "description must be text.",
        field: "description"
      });
    }
    if (description.length > MAX_DESCRIPTION) {
      return res.status(400).json({
        message: `description cannot be longer than ${MAX_DESCRIPTION} characters.`,
        field: "description"
      });
    }
  }

  // --- imagePath: optional, but capped if present ---
  if (imagePath !== undefined && imagePath !== null) {
    if (typeof imagePath !== "string") {
      return res.status(400).json({
        message: "imagePath must be text.",
        field: "imagePath"
      });
    }
    if (imagePath.length > MAX_IMAGE_PATH) {
      return res.status(400).json({
        message: `imagePath cannot be longer than ${MAX_IMAGE_PATH} characters.`,
        field: "imagePath"
      });
    }
  }

  next();
}

module.exports = { validateProduct };