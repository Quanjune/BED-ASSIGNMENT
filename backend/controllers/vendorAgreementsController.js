// vendorAgreementsController.js  (Kishore - Vendor Management, Sprint 2)
const model = require("../models/vendorAgreementsModel");

async function getAllAgreements(req, res) {
  try { res.status(200).json(await model.getAll()); }
  catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

async function getAgreementsByStall(req, res) {
  try { res.status(200).json(await model.getByStall(req.params.stallId)); }
  catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

async function getAgreement(req, res) {
  try {
    const a = await model.getById(req.params.id);
    if (!a) return res.status(404).json({ error: "Agreement not found" });
    res.status(200).json(a);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

async function addAgreement(req, res) {
  try {
    if (!(await model.stallExists(req.body.stallId)))
      return res.status(404).json({ error: "Stall not found" });
    res.status(201).json(await model.create(req.body));
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

async function editAgreement(req, res) {
  try {
    const updated = await model.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Agreement not found" });
    res.status(200).json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal Server Error" }); }
}

module.exports = {
  getAllAgreements, getAgreementsByStall, getAgreement, addAgreement, editAgreement
};