// routes/hygieneGradeRoutes.js  (Kaden - hygiene grades)
//
// WHO CAN DO WHAT
//   GET  /     public - all grades (?stallId= filter); customers check grades
//   GET  /:id  public - one grade
//   POST /     admin  - manual/corrective grade entry
//   PUT  /:id  admin  - correct an issued grade
//   DELETE /:id admin - remove a grade
//
// Hygiene grades are public information (that is the whole point of the NEA
// grading scheme), so reads need no login. Issuing or correcting a grade is
// admin-only. Most grades are created automatically by
// PUT /api/inspections/:id/complete - POST here is only the manual path.
const express = require("express");
const router = express.Router();
const hygieneGradeController = require("../controllers/hygieneGradeController");
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware"); // Aswin's
const validate = require("../middlewares/validate");                              // Kishore's
const { hygieneGradeSchema } = require("../validators/inspectionValidator");

router.get("/", hygieneGradeController.getAllGrades);    // GET  /api/hygiene-grades
router.get("/:id", hygieneGradeController.getGradeById); // GET  /api/hygiene-grades/5

router.post("/", verifyToken, authorizeRoles("admin"),
  validate(hygieneGradeSchema), hygieneGradeController.createGrade);   // POST /api/hygiene-grades
router.put("/:id", verifyToken, authorizeRoles("admin"),
  validate(hygieneGradeSchema), hygieneGradeController.updateGrade);   // PUT  /api/hygiene-grades/5
router.delete("/:id", verifyToken, authorizeRoles("admin"),
  hygieneGradeController.deleteGrade);                                 // DEL  /api/hygiene-grades/5

module.exports = router;