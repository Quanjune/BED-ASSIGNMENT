// controllers/productController.js
// CONTROLLER layer (Week 4 MVC): handles requests, calls the model, returns JSON.
// try...catch on every action; logs server-side, sends a clean error (Week 4).
const productModel = require("../models/productModel");

// ---------- CENTRES ----------
async function getAllCenters(req, res) {
  try {
    res.status(200).json(await productModel.getAllCenters());
  } catch (err) {
    console.error("getAllCenters:", err);
    res.status(500).json({ message: "Error retrieving hawker centres." });
  }
}

async function getCenterById(req, res) {
  try {
    const center = await productModel.getCenterById(parseInt(req.params.id));
    if (!center) return res.status(404).json({ message: "Hawker centre not found." });
    res.status(200).json(center);
  } catch (err) {
    console.error("getCenterById:", err);
    res.status(500).json({ message: "Error retrieving hawker centre." });
  }
}

// ---------- STALLS ----------
async function getStallsByCenter(req, res) {
  try {
    res.status(200).json(await productModel.getStallsByCenter(parseInt(req.params.centerId)));
  } catch (err) {
    console.error("getStallsByCenter:", err);
    res.status(500).json({ message: "Error retrieving stalls." });
  }
}

async function getStallById(req, res) {
  try {
    const stall = await productModel.getStallById(parseInt(req.params.id));
    if (!stall) return res.status(404).json({ message: "Stall not found." });
    res.status(200).json(stall);
  } catch (err) {
    console.error("getStallById:", err);
    res.status(500).json({ message: "Error retrieving stall." });
  }
}

// ---------- PRODUCTS ----------
async function getProductsByStall(req, res) {
  try {
    res.status(200).json(await productModel.getProductsByStall(parseInt(req.params.stallId)));
  } catch (err) {
    console.error("getProductsByStall:", err);
    res.status(500).json({ message: "Error retrieving products." });
  }
}

async function getProductById(req, res) {
  try {
    const product = await productModel.getProductById(parseInt(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found." });
    res.status(200).json(product);
  } catch (err) {
    console.error("getProductById:", err);
    res.status(500).json({ message: "Error retrieving product." });
  }
}

async function createProduct(req, res) {
  try {
    res.status(201).json(await productModel.createProduct(req.body));
  } catch (err) {
    console.error("createProduct:", err);
    res.status(500).json({ message: "Error creating product." });
  }
}

async function updateProduct(req, res) {
  try {
    const id = parseInt(req.params.id);
    const existing = await productModel.getProductById(id);
    if (!existing) return res.status(404).json({ message: "Product not found." });
    res.status(200).json(await productModel.updateProduct(id, req.body));
  } catch (err) {
    console.error("updateProduct:", err);
    res.status(500).json({ message: "Error updating product." });
  }
}

async function deleteProduct(req, res) {
  try {
    const rows = await productModel.deleteProduct(parseInt(req.params.id));
    if (rows === 0) return res.status(404).json({ message: "Product not found." });
    res.status(200).json({ message: "Product deleted." });
  } catch (err) {
    console.error("deleteProduct:", err);
    res.status(500).json({ message: "Error deleting product." });
  }
}

module.exports = {
  getAllCenters, getCenterById,
  getStallsByCenter, getStallById,
  getProductsByStall, getProductById,
  createProduct, updateProduct, deleteProduct
};
