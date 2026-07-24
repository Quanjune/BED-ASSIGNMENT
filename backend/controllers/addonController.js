// controllers/addonController.js
// CONTROLLER: serves a product's addon options to the front-end.
const addonModel = require("../models/addonModel");

// GET /api/products/:productId/addons
async function getProductAddons(req, res) {
  try {
    const productId = parseInt(req.params.productId);
    if (isNaN(productId)) {
      return res.status(400).json({ message: "Invalid productId." });
    }
    const groups = await addonModel.getAddonsByProduct(productId);
    res.status(200).json(groups); // [] if this product has no addons
  } catch (err) {
    console.error("getProductAddons:", err);
    res.status(500).json({ message: "Error retrieving product options." });
  }
}

module.exports = { getProductAddons };
