const express = require("express");
const router = express.Router();
const inspectionController = require("../controllers/inspectionController");
 
router.get("/", inspectionController.getAllInspections);            // GET    
router.get("/:id", inspectionController.getInspectionById);         // GET   
router.post("/", inspectionController.createInspection);            // POST  
router.put("/:id", inspectionController.updateInspection);          // PUT   
router.put("/:id/complete", inspectionController.completeInspection); // PUT  
router.delete("/:id", inspectionController.deleteInspection);       // DELETE 
 
module.exports = router;