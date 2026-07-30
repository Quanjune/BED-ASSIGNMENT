// routes/inspectionRoutes.js  (Kaden - NEA inspections)
// WHO CAN DO WHAT
//   GET  /             public - list inspections (?stallId= & ?status= filters)
//   GET  /:id          public - one inspection
//   POST /             admin  - schedule a new inspection
//   PUT  /:id          admin  - edit schedule details
//   PUT  /:id/complete admin  - record score + remarks, auto-issue hygiene grade
//   DELETE /:id        admin  - remove an inspection
//
// Reads stay public on purpose: guests browsing stalls can see inspection
// history next to hygiene grades. Only NEA/admin staff may change anything,
// so every write runs verifyToken (logged in?) then authorizeRoles("admin").
// Format validation happens in validate(schema) BEFORE the controller runs,
// so controllers only handle business rules (stall exists, already completed).
//
// To test in Postman: POST /api/auth/login as the seeded admin, copy the
// accessToken, then send writes with  Authorization: Bearer <accessToken>.
const express = require("express");
const router = express.Router();
const inspectionController = require("../controllers/inspectionController");
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware"); // Aswin's
const validate = require("../middlewares/validate");                              // Kishore's
const {
  scheduleInspectionSchema,
  updateInspectionSchema,
  completeInspectionSchema,
} = require("../validators/inspectionValidator");

router.get("/", inspectionController.getAllInspections);    // GET  /api/inspections
router.get("/:id", inspectionController.getInspectionById); // GET  /api/inspections/5

router.post("/", verifyToken, authorizeRoles("admin"),
  validate(scheduleInspectionSchema), inspectionController.createInspection);      // POST /api/inspections

// A distinct path from PUT /:id (same trick as Timely's /:id/reply) so
// completing an inspection can never be confused with editing its schedule.
router.put("/:id/complete", verifyToken, authorizeRoles("admin"),
  validate(completeInspectionSchema), inspectionController.completeInspection);    // PUT  /api/inspections/5/complete

router.put("/:id", verifyToken, authorizeRoles("admin"),
  validate(updateInspectionSchema), inspectionController.updateInspection);        // PUT  /api/inspections/5

router.delete("/:id", verifyToken, authorizeRoles("admin"),
  inspectionController.deleteInspection);                                          // DEL  /api/inspections/5

module.exports = router;