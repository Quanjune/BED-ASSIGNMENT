// adminController.js  (Aswin - Admin analytics)
// Thin controllers - each calls one aggregation query and returns JSON.
// All error handling funnels a 500 with a clear message.
const adminModel = require("../models/adminModel");

async function getSummary(req, res) {
  try {
    return res.status(200).json(await adminModel.getSummary());
  } catch (err) {
    console.error("Admin summary error:", err);
    return res.status(500).json({ message: "Failed to load summary." });
  }
}

async function getComplaintsByCentre(req, res) {
  try {
    return res.status(200).json(await adminModel.getComplaintsByCentre());
  } catch (err) {
    console.error("Complaints-by-centre error:", err);
    return res.status(500).json({ message: "Failed to load complaints by centre." });
  }
}

async function getComplaintsByCategory(req, res) {
  try {
    return res.status(200).json(await adminModel.getComplaintsByCategory());
  } catch (err) {
    console.error("Complaints-by-category error:", err);
    return res.status(500).json({ message: "Failed to load complaints by category." });
  }
}

async function getComplaintsByMonth(req, res) {
  try {
    return res.status(200).json(await adminModel.getComplaintsByMonth());
  } catch (err) {
    console.error("Complaints-by-month error:", err);
    return res.status(500).json({ message: "Failed to load complaints by month." });
  }
}

async function getTopStalls(req, res) {
  try {
    return res.status(200).json(await adminModel.getTopStalls());
  } catch (err) {
    console.error("Top-stalls error:", err);
    return res.status(500).json({ message: "Failed to load top stalls." });
  }
}

async function getAgreementsSummary(req, res) {
  try {
    return res.status(200).json(await adminModel.getAgreementsSummary());
  } catch (err) {
    console.error("Agreements-summary error:", err);
    return res.status(500).json({ message: "Failed to load agreements summary." });
  }
}

module.exports = {
  getSummary,
  getComplaintsByCentre,
  getComplaintsByCategory,
  getComplaintsByMonth,
  getTopStalls,
  getAgreementsSummary
};
