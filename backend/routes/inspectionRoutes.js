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
// Reads are public on purpose: a customer looking at a stall should be able
// to see its inspection history next to its hygiene grade, exactly like the
// real NEA scheme. Everything that CHANGES data is officer-only.
//
// Middleware runs left to right:
//   validateIdParam -> requireOfficer -> validate(schema) -> controller
// requireOfficer is [verifyToken, authorizeRoles("officer"), attachOfficer],
// so by the time the controller runs the caller is proven to be an officer
// and req.officerId is set from the token.
//
// TESTING IN POSTMAN
//   POST /api/auth/login with tan@nea.gov.sg / Password123, copy the token
//   from the response, then send writes with:
//   Authorization: Bearer <token>
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
// Express matches routes in the order they are registered. If "/:id" were
// registered above these, a request for "/mine" would be captured by it and
// arrive at getInspectionById with id = "mine". Same trick Timely uses for
// /complaints/stall/:stallId.
router.get("/mine", requireOfficer, inspectionController.getMyWorklist);
router.get("/overdue", requireOfficer, inspectionController.getOverdueInspections);
router.get("/stalls-due", requireOfficer, inspectionController.getStallsDue);

// Third-party API (data.gov.sg weather). Officer-only because it is a
// work-planning aid, and a fixed path so it is not swallowed by "/:id".
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