const inspectionModel = require("../models/inspectionModel");
const hygieneGradeModel = require("../models/hygieneGradeModel");
 
const VALID_STATUSES = ["Scheduled", "Completed", "Cancelled"];
 

function scoreToGrade(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}
 
function validateScheduleInput(data) {
  if (!data.stallId || isNaN(data.stallId)) {
    return "stallId is required and must be a number.";
  }
  if (!data.officerName || typeof data.officerName !== "string" || !data.officerName.trim()) {
    return "officerName is required.";
  }
  if (!data.scheduledDate || isNaN(Date.parse(data.scheduledDate))) {
    return "scheduledDate is required and must be a valid date (YYYY-MM-DD).";
  }
  return null;
}
 
// GET 
async function getAllInspections(req, res) {
  try {
    const { stallId, status } = req.query;
 
    if (stallId && isNaN(stallId)) {
      return res.status(400).json({ message: "stallId query parameter must be a number." });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }
 
    const inspections = await inspectionModel.getAllInspections({ stallId, status });
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
 
// POST /api/inspections — schedule a new inspection
async function createInspection(req, res) {
  try {
    const validationError = validateScheduleInput(req.body);
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
    res.status(500).json({ message: "Failed to schedule inspection." });
  }
}
 
// PUT  — edit schedule details (stall/officer/date/status)
async function updateInspection(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Inspection id must be a number." });
    }
 
    const validationError = validateScheduleInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }
 
    const stallOk = await inspectionModel.stallExists(req.body.stallId);
    if (!stallOk) {
      return res.status(400).json({ message: `Stall ${req.body.stallId} does not exist.` });
    }
 
    const updated = await inspectionModel.updateInspection(id, {
      ...req.body,
      status: req.body.status || "Scheduled",
    });
    if (!updated) {
      return res.status(404).json({ message: `Inspection ${id} not found.` });
    }
 
    res.status(200).json(updated);
  } catch (err) {
    console.error("updateInspection error:", err);
    res.status(500).json({ message: "Failed to update inspection." });
  }
}
 
// PUT — record score + remarks, auto-issue a hygiene grade
async function completeInspection(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Inspection id must be a number." });
    }
 
    const { score, remarks, completedDate } = req.body;
    if (score === undefined || isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({ message: "score is required and must be a number between 0 and 100." });
    }
 
    const existing = await inspectionModel.getInspectionById(id);
    if (!existing) {
      return res.status(404).json({ message: `Inspection ${id} not found.` });
    }
    if (existing.status === "Completed") {
      return res.status(400).json({
        message: `Inspection ${id} is already completed. Edit the hygiene grade directly if a correction is needed.`,
      });
    }
 
    const finalCompletedDate = completedDate && !isNaN(Date.parse(completedDate))
      ? completedDate
      : new Date().toISOString().slice(0, 10);
 
    const completed = await inspectionModel.completeInspection(id, {
      completedDate: finalCompletedDate,
      score,
      remarks,
    });
 
    // Auto-issue a hygiene grade valid for one year from the completion date.
    const grade = scoreToGrade(score);
    const validFrom = finalCompletedDate;
    const validTo = new Date(finalCompletedDate);
    validTo.setFullYear(validTo.getFullYear() + 1);
 
    const issuedGrade = await hygieneGradeModel.createGrade({
      stallId: completed.stallId,
      inspectionId: completed.inspectionId,
      grade,
      validFrom,
      validTo: validTo.toISOString().slice(0, 10),
    });
 
    res.status(200).json({ inspection: completed, hygieneGrade: issuedGrade });
  } catch (err) {
    console.error("completeInspection error:", err);
    res.status(500).json({ message: "Failed to complete inspection." });
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
  completeInspection,
  deleteInspection,
};