// hygieneGradeController.js  (Kaden - hygiene grading)
// Request/response side of /api/hygiene-grades. Joi has already checked the
// shape of the body, so what is left here is the business rules.
const hygieneGradeModel = require("../models/hygieneGradeModel");
const inspectionModel = require("../models/inspectionModel");

// ============================================================
// READ  (public - a hygiene grade is public information, that is the
//        whole point of the NEA grading scheme)
// ============================================================

// GET /api/hygiene-grades?stallId=
async function getAllGrades(req, res) {
  try {
    const { stallId } = req.query;
    if (stallId && isNaN(stallId)) {
      return res.status(400).json({ message: "stallId must be a number." });
    }

    const grades = await hygieneGradeModel.getAllGrades(stallId);
    res.status(200).json(grades);
  } catch (err) {
    console.error("getAllGrades error:", err);
    res.status(500).json({ message: "Could not load hygiene grades. Please try again." });
  }
}

// GET /api/hygiene-grades/current
// One row per stall - the grade it is displaying right now.
async function getCurrentGrades(req, res) {
  try {
    const grades = await hygieneGradeModel.getCurrentGrades();
    res.status(200).json(grades);
  } catch (err) {
    console.error("getCurrentGrades error:", err);
    res.status(500).json({ message: "Could not load current grades. Please try again." });
  }
}

// GET /api/hygiene-grades/expiring?days=30
async function getExpiringGrades(req, res) {
  try {
    const days = req.query.days === undefined ? 30 : Number(req.query.days);
    if (isNaN(days) || days < 0 || days > 365) {
      return res.status(400).json({ message: "days must be a number between 0 and 365." });
    }

    const grades = await hygieneGradeModel.getExpiringGrades(days);
    res.status(200).json(grades);
  } catch (err) {
    console.error("getExpiringGrades error:", err);
    res.status(500).json({ message: "Could not load expiring grades. Please try again." });
  }
}

// GET /api/hygiene-grades/stall/:stallId
// The whole compliance picture for one stall: its current grade, every grade
// it has ever held, and every inspection behind them. One request instead of
// three, so the history page loads in one go.
async function getStallCompliance(req, res) {
  try {
    // validateIdParam("stallId") in the routes file has already checked this.
    const { stallId } = req.params;
    if (!(await hygieneGradeModel.stallExists(stallId))) {
      return res.status(404).json({ message: `Stall ${stallId} was not found.` });
    }

    const [grades, inspections] = await Promise.all([
      hygieneGradeModel.getAllGrades(stallId),
      inspectionModel.getAllInspections({ stallId }),
    ]);

    // getAllGrades is already sorted newest-first, so the first row that is
    // still inside its validity window is the current one.
    const current = grades.find((g) => g.isCurrent === 1) || null;

    res.status(200).json({
      stallId: Number(stallId),
      stallName: grades[0]?.stallName || inspections[0]?.stallName || null,
      currentGrade: current,
      grades,
      inspections,
    });
  } catch (err) {
    console.error("getStallCompliance error:", err);
    res.status(500).json({ message: "Could not load the stall's compliance history. Please try again." });
  }
}

// GET /api/hygiene-grades/:id
async function getGradeById(req, res) {
  try {
    // validateIdParam("id") in the routes file has already checked this.
    const { id } = req.params;

    const grade = await hygieneGradeModel.getGradeById(id);
    if (!grade) {
      return res.status(404).json({ message: `Hygiene grade ${id} was not found.` });
    }

    res.status(200).json(grade);
  } catch (err) {
    console.error("getGradeById error:", err);
    res.status(500).json({ message: "Could not load that hygiene grade. Please try again." });
  }
}

// ============================================================
// WRITE  (officer only)
// ============================================================

// POST /api/hygiene-grades - manual / corrective entry.
// Most grades are issued automatically by PUT /api/inspections/:id/complete.
// This is the path for corrections and for historical records being entered
// after the fact.
async function createGrade(req, res) {
  try {
    if (!(await hygieneGradeModel.stallExists(req.body.stallId))) {
      return res.status(400).json({ message: `Stall ${req.body.stallId} does not exist.` });
    }
    if (req.body.inspectionId && !(await hygieneGradeModel.inspectionExists(req.body.inspectionId))) {
      return res.status(400).json({ message: `Inspection ${req.body.inspectionId} does not exist.` });
    }

    const newGrade = await hygieneGradeModel.createGrade(req.body);
    res.status(201).json(newGrade);
  } catch (err) {
    console.error("createGrade error:", err);
    res.status(500).json({ message: "Could not issue the hygiene grade. Please try again." });
  }
}

// PUT /api/hygiene-grades/:id
async function updateGrade(req, res) {
  try {
    // validateIdParam("id") in the routes file has already checked this.
    const { id } = req.params;
    if (!(await hygieneGradeModel.stallExists(req.body.stallId))) {
      return res.status(400).json({ message: `Stall ${req.body.stallId} does not exist.` });
    }

    const updated = await hygieneGradeModel.updateGrade(id, req.body);
    if (!updated) {
      return res.status(404).json({ message: `Hygiene grade ${id} was not found.` });
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error("updateGrade error:", err);
    res.status(500).json({ message: "Could not update the hygiene grade. Please try again." });
  }
}

// DELETE /api/hygiene-grades/:id
async function deleteGrade(req, res) {
  try {
    // validateIdParam("id") in the routes file has already checked this.
    const { id } = req.params;

    const deleted = await hygieneGradeModel.deleteGrade(id);
    if (!deleted) {
      return res.status(404).json({ message: `Hygiene grade ${id} was not found.` });
    }

    res.status(200).json({ message: `Hygiene grade ${id} deleted.`, deleted });
  } catch (err) {
    console.error("deleteGrade error:", err);
    res.status(500).json({ message: "Could not delete the hygiene grade. Please try again." });
  }
}

module.exports = {
  getAllGrades,
  getCurrentGrades,
  getExpiringGrades,
  getStallCompliance,
  getGradeById,
  createGrade,
  updateGrade,
  deleteGrade,
};