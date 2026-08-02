// routes/inspectionRoutes.js  (Kaden - NEA inspections)
//
// WHO CAN DO WHAT
//   GET  /                public  - list inspections (?stallId= ?status= ?officerId=)
//   GET  /:id             public  - one inspection
//   GET  /mine            officer - the logged-in officer's own worklist
//   GET  /overdue         officer - booked, date passed, no result recorded
//   GET  /stalls-due      officer - every stall + last visit + current grade
//   GET  /weather         officer - data.gov.sg 4-day outlook for one date
//   POST /                officer - schedule a visit
//   PUT  /:id             officer - move or cancel a booked visit
//   PUT  /:id/complete    officer - record score + remarks, issue the grade
//   DELETE /:id           officer - remove a visit
//
const express = require("express");
const router = express.Router();
const inspectionController = require("../controllers/inspectionController");
const { requireOfficer } = require("../middlewares/officerAuth");
const validate = require("../middlewares/validate");                    // Kishore's
const { validateIdParam } = require("../middlewares/idValidation");     // Quan Jun's
const {
  scheduleInspectionSchema,
  updateInspectionSchema,
  completeInspectionSchema,
} = require("../validators/inspectionValidator");

// ------------------------------------------------------------
// FIXED PATHS FIRST
// ------------------------------------------------------------
router.get("/mine", requireOfficer, inspectionController.getMyWorklist);
router.get("/overdue", requireOfficer, inspectionController.getOverdueInspections);
router.get("/stalls-due", requireOfficer, inspectionController.getStallsDue);

// Third-party API (data.gov.sg weather). 
router.get("/weather", requireOfficer, inspectionController.getWeatherForDate);

// ------------------------------------------------------------
// PUBLIC READS
// ------------------------------------------------------------
router.get("/", inspectionController.getAllInspections);
router.get("/:id", validateIdParam("id"), inspectionController.getInspectionById);

// ------------------------------------------------------------
// OFFICER-ONLY WRITES
// ------------------------------------------------------------
router.post(
  "/",
  requireOfficer,
  validate(scheduleInspectionSchema),
  inspectionController.createInspection
);

// Registered before "/:id" for the same ordering reason as above.
router.put(
  "/:id/complete",
  validateIdParam("id"),
  requireOfficer,
  validate(completeInspectionSchema),
  inspectionController.completeInspection
);

router.put(
  "/:id",
  validateIdParam("id"),
  requireOfficer,
  validate(updateInspectionSchema),
  inspectionController.updateInspection
);

router.delete("/:id", validateIdParam("id"), requireOfficer, inspectionController.deleteInspection);

module.exports = router;