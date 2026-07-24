// routes/productRoutes.js
// ROUTES (Week 3 table: HTTP method -> CRUD). Mounted under /api in app.js.
const express = require("express");
const router = express.Router();
const controller = require("../controllers/productController");
const { validateProduct } = require("../middlewares/productValidation");

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
router.get("/centers/:id", controller.getCenterById);                   // one centre
router.get("/centers/:centerId/stalls", controller.getStallsByCenter);  // stalls in a centre

// ----- Stalls -----
router.get("/stalls/:id", controller.getStallById);                     // one stall
router.get("/stalls/:stallId/products", controller.getProductsByStall); // products in a stall

// ----- Products -----
router.get("/products/:id", controller.getProductById);                 // one product

// ============================================================
// PROTECTED ROUTES (CREATE / UPDATE / DELETE)
// Only a logged-in vendor or admin may change the menu.
// Middleware runs left to right:
//   verifyToken -> authorizeRoles -> validateProduct -> controller
// If any of them fails it responds early and the controller never runs.
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
  validateProduct,
  controller.updateProduct
);

router.delete(
  "/products/:id",
  verifyToken,
  authorizeRoles("vendor", "admin"),
  controller.deleteProduct
);

module.exports = router;