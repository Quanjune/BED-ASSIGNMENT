// vendorController.js  (Kishore - Vendor Management)
// Every handler uses req.stallId (resolved from the login token by the
// vendorAuth middleware) - clients never say which stall they are.
const model = require("../models/vendorModel");

// GET /api/vendors/menu -> the logged-in vendor's own menu
async function getMyItems(req, res) {
  try {
    res.status(200).json(await model.getByStall(req.stallId));
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

// GET /api/vendors/menu/:id
async function getItem(req, res) {
  try {
    const item = await model.getByIdForStall(req.params.id, req.stallId);
    // "not yours" and "doesn't exist" both come back 404 on purpose -
    // we don't reveal whether another stall's item id exists.
    if (!item) return res.status(404).json({ error: "Menu item not found" });
    res.status(200).json(item);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

// POST /api/vendors/menu
async function addItem(req, res) {
  try {
    res.status(201).json(await model.create(req.stallId, req.body));
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

// PUT /api/vendors/menu/:id
async function editItem(req, res) {
  try {
    const updated = await model.update(req.params.id, req.stallId, req.body);
    if (!updated) return res.status(404).json({ error: "Menu item not found" });
    res.status(200).json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

// DELETE /api/vendors/menu/:id
async function deleteItem(req, res) {
  try {
    const deleted = await model.remove(req.params.id, req.stallId);
    if (!deleted) return res.status(404).json({ error: "Menu item not found" });
    res.status(200).json({ message: "Menu item deleted", productId: deleted.productId });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

module.exports = { getMyItems, getItem, addItem, editItem, deleteItem };
