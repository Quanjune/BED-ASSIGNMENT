const hygieneGradeModel = require("../models/hygieneGradeModel");
 
// Body format validation (grade A-D, date order, etc.) now lives in
// validators/inspectionValidator.js and runs as validate(schema) middleware
// in the routes. Joi also upper-cases the grade, so "a" arrives here as "A".
 
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
 
// POST — manual/corrective grade entry
async function createGrade(req, res) {
  try {
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
 
    const newGrade = await hygieneGradeModel.createGrade(req.body);
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
 
    const stallOk = await hygieneGradeModel.stallExists(req.body.stallId);
    if (!stallOk) {
      return res.status(400).json({ message: `Stall ${req.body.stallId} does not exist.` });
    }
 
    const updated = await hygieneGradeModel.updateGrade(id, req.body);
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