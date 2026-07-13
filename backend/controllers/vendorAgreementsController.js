// vendorAgreementsController.js  (Kishore - Vendor Management, Sprint 2 rework)
// Agreements & licences for the LOGGED-IN vendor's stall only.
const model = require("../models/vendorAgreementsModel");

// GET /api/vendors/agreements -> all documents for my stall
async function getMyAgreements(req, res) {
  try {
    res.status(200).json(await model.getByStall(req.stallId));
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

// GET /api/vendors/agreements/:id
async function getAgreement(req, res) {
  try {
    const a = await model.getByIdForStall(req.params.id, req.stallId);
    if (!a) return res.status(404).json({ error: "Agreement not found" });
    res.status(200).json(a);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

// POST /api/vendors/agreements
async function addAgreement(req, res) {
  try {
    res.status(201).json(await model.create(req.stallId, req.body));
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

// PUT /api/vendors/agreements/:id
async function editAgreement(req, res) {
  try {
    const updated = await model.update(req.params.id, req.stallId, req.body);
    if (!updated) return res.status(404).json({ error: "Agreement not found" });
    res.status(200).json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

// DELETE /api/vendors/agreements/:id
async function deleteAgreement(req, res) {
  try {
    const deleted = await model.remove(req.params.id, req.stallId);
    if (!deleted) return res.status(404).json({ error: "Agreement not found" });
    res.status(200).json({ message: "Agreement deleted", agreementId: deleted.agreementId });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

module.exports = { getMyAgreements, getAgreement, addAgreement, editAgreement, deleteAgreement };
