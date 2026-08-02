// routes/hygieneGradeRoutes.js  (Kaden - hygiene grading)
//
// WHO CAN DO WHAT
//   GET  /                  public  - the full register (?stallId= filter)
//   GET  /current           public  - one current grade per stall
//   GET  /stall/:stallId    public  - one stall's full compliance history
//   GET  /expiring?days=30  officer - grades about to run out
//   GET  /:id               public  - one grade
//   POST /                  officer - manual / corrective grade entry
//   PUT  /:id               officer - correct an issued grade
//   DELETE /:id             officer - remove a grade
const express = require("express");
const router = express.Router();
const hygieneGradeController = require("../controllers/hygieneGradeController");
const { requireOfficer } = require("../middlewares/officerAuth");
const validate = require("../middlewares/validate");             // Kishore's
const { validateIdParam } = require("../middlewares/idValidation");  // Quan Jun's
const { hygieneGradeSchema } = require("../validators/inspectionValidator");

// ------------------------------------------------------------
// FIXED PATHS FIRST 
// ------------------------------------------------------------
router.get("/current", hygieneGradeController.getCurrentGrades);
router.get("/expiring", requireOfficer, hygieneGradeController.getExpiringGrades);
router.get("/stall/:stallId", validateIdParam("stallId"), hygieneGradeController.getStallCompliance);

// ------------------------------------------------------------
// PUBLIC READS
// ------------------------------------------------------------
router.get("/", hygieneGradeController.getAllGrades);
router.get("/:id", validateIdParam("id"), hygieneGradeController.getGradeById);

// ------------------------------------------------------------
// OFFICER-ONLY WRITES
// ------------------------------------------------------------
router.post(
  "/",
  requireOfficer,
  validate(hygieneGradeSchema),
  hygieneGradeController.createGrade
);

router.put(
  "/:id",
  validateIdParam("id"),
  requireOfficer,
  validate(hygieneGradeSchema),
  hygieneGradeController.updateGrade
);

router.delete("/:id", validateIdParam("id"), requireOfficer, hygieneGradeController.deleteGrade);

module.exports = router;