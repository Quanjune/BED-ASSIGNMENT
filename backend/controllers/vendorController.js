// vendorController.js  (Kishore - Vendor Management)
const model = require("../models/vendorModel");

async function getAllItems(req, res) {
  try { res.status(200).json(await model.getAll()); }
  catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

async function getItemsByStall(req, res) {
  try { res.status(200).json(await model.getByStall(req.params.stallId)); }
  catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

async function getItem(req, res) {
  try {
    const item = await model.getById(req.params.id);
    if (!item) return res.status(404).json({ error: "Menu item not found" });
    res.status(200).json(item);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

async function addItem(req, res) {
  try {
    if (!(await model.stallExists(req.body.stallId)))
      return res.status(404).json({ error: "Stall not found" });
    res.status(201).json(await model.create(req.body));
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

async function editItem(req, res) {
  try {
    const updated = await model.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Menu item not found" });
    res.status(200).json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

async function deleteItem(req, res) {
  try {
    const deleted = await model.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Menu item not found" });
    res.status(200).json({ message: "Menu item deleted", productId: deleted.productId });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

module.exports = { getAllItems, getItemsByStall, getItem, addItem, editItem, deleteItem };
