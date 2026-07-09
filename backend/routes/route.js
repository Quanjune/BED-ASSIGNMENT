const express = require("express");
const router = express.Router();
const inspectionController = require("../controllers/inspectionController");
 
router.get("/", inspectionController.getAllInspections);            // GET    /api/inspections
router.get("/:id", inspectionController.getInspectionById);         // GET    /api/inspections/:id
router.post("/", inspectionController.createInspection);            // POST   /api/inspections            (schedule)
router.put("/:id", inspectionController.updateInspection);          // PUT    /api/inspections/:id         (edit schedule)
router.put("/:id/complete", inspectionController.completeInspection); // PUT  /api/inspections/:id/complete (record result + auto-issue grade)
router.delete("/:id", inspectionController.deleteInspection);       // DELETE /api/inspections/:id
 
module.exports = router;