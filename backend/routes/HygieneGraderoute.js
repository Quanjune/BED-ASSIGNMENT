const express = require("express");
const router = express.Router();
const hygieneGradeController = require("../controllers/HygieneGradeController");
 
router.get("/", hygieneGradeController.getAllGrades);        // GET    
router.get("/:id", hygieneGradeController.getGradeById);     // GET   
router.post("/", hygieneGradeController.createGrade);        // POST  
router.put("/:id", hygieneGradeController.updateGrade);      // PUT   
router.delete("/:id", hygieneGradeController.deleteGrade);   // DELETE 
module.exports = router;