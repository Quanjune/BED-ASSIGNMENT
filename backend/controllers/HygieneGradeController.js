const hygieneGradeModel = require("../models/hygieneGradeModel");
 
const VALID_GRADES = ["A", "B", "C", "D"];
 
function validateGradeInput(data) {
  if (!data.stallId || isNaN(data.stallId)) {
    return "stallId is required and must be a number.";
  }
  if (!data.grade || !VALID_GRADES.includes(data.grade.toUpperCase())) {
    return `grade is required and must be one of: ${VALID_GRADES.join(", ")}`;
  }
  if (!data.validFrom || isNaN(Date.parse(data.validFrom))) {
    return "validFrom is required and must be a valid date (YYYY-MM-DD).";
  }
  if (!data.validTo || isNaN(Date.parse(data.validTo))) {
    return "validTo is required and must be a valid date (YYYY-MM-DD).";
  }
  if (new Date(data.validTo) <= new Date(data.validFrom)) {
    return "validTo must be after validFrom.";
  }
  return null;
}
 
// GET 
async function getAllGrades(req, res) {
  try {
    const { stallId } = req.query;
    if (stallId && isNaN(stallId)) {
      return res.status(400).json({ message: "stallId query parameter must be a number." });
    }
 
    const grades = await hygieneGradeModel.getAllGrades(stallId);
    res.status(200).json(grades);
  } catch (err) {
    console.error("getAllGrades error:", err);
    res.status(500).json({ message: "Failed to retrieve hygiene grades." });
  }
}
 
// GET 
async function getGradeById(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Grade id must be a number." });
    }
 
    const grade = await hygieneGradeModel.getGradeById(id);
    if (!grade) {
      return res.status(404).json({ message: `Hygiene grade ${id} not found.` });
    }
 
    res.status(200).json(grade);
  } catch (err) {
    console.error("getGradeById error:", err);
    res.status(500).json({ message: "Failed to retrieve hygiene grade." });
  }
}
 
// POST 
async function createGrade(req, res) {
  try {
    const validationError = validateGradeInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
 
    const stallOk = await hygieneGradeModel.stallExists(req.body.stallId);
    if (!stallOk) {
      return res.status(400).json({ message: `Stall ${req.body.stallId} does not exist.` });
    }
    if (req.body.inspectionId) {
      const inspectionOk = await hygieneGradeModel.inspectionExists(req.body.inspectionId);
      if (!inspectionOk) {
        return res.status(400).json({ message: `Inspection ${req.body.inspectionId} does not exist.` });
      }
    }
 
    const newGrade = await hygieneGradeModel.createGrade({
      ...req.body,
      grade: req.body.grade.toUpperCase(),
    });
    res.status(201).json(newGrade);
  } catch (err) {
    console.error("createGrade error:", err);
    res.status(500).json({ message: "Failed to create hygiene grade." });
  }
}
 
// PUT 
async function updateGrade(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Grade id must be a number." });
    }
 
    const validationError = validateGradeInput(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
 
    const stallOk = await hygieneGradeModel.stallExists(req.body.stallId);
    if (!stallOk) {
      return res.status(400).json({ message: `Stall ${req.body.stallId} does not exist.` });
    }
 
    const updated = await hygieneGradeModel.updateGrade(id, {
      ...req.body,
      grade: req.body.grade.toUpperCase(),
    });
    if (!updated) {
      return res.status(404).json({ message: `Hygiene grade ${id} not found.` });
    }
 
    res.status(200).json(updated);
  } catch (err) {
    console.error("updateGrade error:", err);
    res.status(500).json({ message: "Failed to update hygiene grade." });
  }
}
 
// DELETE 
async function deleteGrade(req, res) {
  try {
    const { id } = req.params;
    if (isNaN(id)) {
      return res.status(400).json({ message: "Grade id must be a number." });
    }
 
    const deleted = await hygieneGradeModel.deleteGrade(id);
    if (!deleted) {
      return res.status(404).json({ message: `Hygiene grade ${id} not found.` });
    }
 
    res.status(200).json({ message: `Hygiene grade ${id} deleted.`, deleted });
  } catch (err) {
    console.error("deleteGrade error:", err);
    res.status(500).json({ message: "Failed to delete hygiene grade." });
  }
}
 
module.exports = {
  getAllGrades,
  getGradeById,
  createGrade,
  updateGrade,
  deleteGrade,
};