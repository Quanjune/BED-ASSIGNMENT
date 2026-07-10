// routes/productRoutes.js
// ROUTES (Week 3 table: HTTP method -> CRUD). Mounted under /api in app.js.
const express = require("express");
const router = express.Router();
const controller = require("../controllers/productController");
const { validateProduct } = require("../middlewares/productValidation");

// ----- Hawker centres (READ) -----
router.get("/centers", controller.getAllCenters);                 // list all centres
router.get("/centers/:id", controller.getCenterById);             // one centre
router.get("/centers/:centerId/stalls", controller.getStallsByCenter); // stalls in a centre

// ----- Stalls (READ) -----
router.get("/stalls/:id", controller.getStallById);               // one stall
router.get("/stalls/:stallId/products", controller.getProductsByStall); // products in a stall

// ----- Products (full CRUD) -----
router.get("/products/:id", controller.getProductById);           // one product
router.post("/products", validateProduct, controller.createProduct);   // create
router.put("/products/:id", validateProduct, controller.updateProduct); // update
router.delete("/products/:id", controller.deleteProduct);         // delete

module.exports = router;
