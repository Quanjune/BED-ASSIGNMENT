const inspectionModel = require("../models/inspectionModel");

// Returns an error string, or null if the data is valid.
function validateInspectionInput(data) {
  if (!data.stallId || isNaN(data.stallId)) {
    return "stallId is required and must be a number.";
  }
  if (!data.officerName || typeof data.officerName !== "string" || !data.officerName.trim()) {
    return "officerName is required.";
  }
  if (!data.inspectionDate || isNaN(Date.parse(data.inspectionDate))) {
    return "inspectionDate is required and must be a valid date (YYYY-MM-DD).";
  }
  if (data.score === undefined || isNaN(data.score) || data.score < 0 || data.score > 100) {
    return "score is required and must be a number between 0 and 100.";
  }
  return null;
}
 
// GET 
async function getAllInspections(req, res) {
  try {
    const { stallId } = req.query;
 
    if (stallId && isNaN(stallId)) {
      return res.status(400).json({ message: "stallId query parameter must be a number." });
    }
 
    const inspections = await inspectionModel.getAllInspections(stallId);
    res.status(200).json(inspections);
  } catch (err) {
    console.error("getAllInspections error:", err);
    res.status(500).json({ message: "Failed to retrieve inspections." });
  }
}
 
// GET 
async function getInspectionById(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Inspection id must be a number." });
    }
 
    const inspection = await inspectionModel.getInspectionById(id);
    if (!inspection) {
      return res.status(404).json({ message: `Inspection ${id} not found.` });
    }
 
    res.status(200).json(inspection);
  } catch (err) {
    console.error("getInspectionById error:", err);
    res.status(500).json({ message: "Failed to retrieve inspection." });
  }
}
 
// POST
async function createInspection(req, res) {
  try {
    const validationError = validateInspectionInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
 
    const stallOk = await inspectionModel.stallExists(req.body.stallId);
    if (!stallOk) {
      return res.status(400).json({ message: `Stall ${req.body.stallId} does not exist.` });
    }
 
    const newInspection = await inspectionModel.createInspection(req.body);
    res.status(201).json(newInspection);
  } catch (err) {
    console.error("createInspection error:", err);
    res.status(500).json({ message: "Failed to create inspection." });
  }
}
 
// PUT 
async function updateInspection(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Inspection id must be a number." });
    }
 
    const validationError = validateInspectionInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
 
    const stallOk = await inspectionModel.stallExists(req.body.stallId);
    if (!stallOk) {
      return res.status(400).json({ message: `Stall ${req.body.stallId} does not exist.` });
    }
 
    const updated = await inspectionModel.updateInspection(id, req.body);
    if (!updated) {
      return res.status(404).json({ message: `Inspection ${id} not found.` });
    }
 
    res.status(200).json(updated);
  } catch (err) {
    console.error("updateInspection error:", err);
    res.status(500).json({ message: "Failed to update inspection." });
  }
}
 
// DELETE 
async function deleteInspection(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Inspection id must be a number." });
    }
 
    const deleted = await inspectionModel.deleteInspection(id);
    if (!deleted) {
      return res.status(404).json({ message: `Inspection ${id} not found.` });
    }
 
    res.status(200).json({ message: `Inspection ${id} deleted.`, deleted });
  } catch (err) {
    console.error("deleteInspection error:", err);
    res.status(500).json({ message: "Failed to delete inspection." });
  }
}
 
module.exports = {
  getAllInspections,
  getInspectionById,
  createInspection,
  updateInspection,
  deleteInspection,
};
 