// routes/productRoutes.js
// ROUTES (Week 3 table: HTTP method -> CRUD). Mounted under /api in app.js.
const express = require("express");
const router = express.Router();
const controller = require("../controllers/productController");
const { validateProduct } = require("../middlewares/productValidation");

// URL-parameter validation: rejects /api/products/abc with a 400 instead of
// letting NaN reach the database and coming back as a misleading 404.
const { validateIdParam } = require("../middlewares/idValidation");

// Authentication + role-based authorization (Aswin's auth middleware, Week 11).
// verifyToken   -> rejects the request (401) if there is no valid JWT.
// authorizeRoles-> rejects the request (403) if the user's role isn't allowed.
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");

// ============================================================
// PUBLIC ROUTES (READ)
// Anyone can browse the menu without logging in — a customer
// should be able to look at stalls and dishes before signing up.
// ============================================================

// ----- Hawker centres -----
router.get("/centers", controller.getAllCenters);                       // list all centres
router.get("/centers/:id", validateIdParam("id"), controller.getCenterById);
router.get("/centers/:centerId/stalls", validateIdParam("centerId"), controller.getStallsByCenter);

// ----- Stalls -----
router.get("/stalls/:id", validateIdParam("id"), controller.getStallById);
router.get("/stalls/:stallId/products", validateIdParam("stallId"), controller.getProductsByStall);

// ----- Products -----
router.get("/products/:id", validateIdParam("id"), controller.getProductById);

// ============================================================
// PROTECTED ROUTES (CREATE / UPDATE / DELETE)
// Only a logged-in vendor or admin may change the menu.
// Middleware runs left to right:
//   verifyToken -> authorizeRoles -> validateIdParam -> validateProduct -> controller
// If any of them fails it responds early and the controller never runs.
// Auth is checked FIRST so an anonymous request gets 401 and never reveals
// whether a given product id exists.
// ============================================================

router.post(
  "/products",
  verifyToken,
  authorizeRoles("vendor", "admin"),
  validateProduct,
  controller.createProduct
);

router.put(
  "/products/:id",
  verifyToken,
  authorizeRoles("vendor", "admin"),
  validateIdParam("id"),
  validateProduct,
  controller.updateProduct
);

router.delete(
  "/products/:id",
  verifyToken,
  authorizeRoles("vendor", "admin"),
  validateIdParam("id"),
  controller.deleteProduct
);

module.exports = router;