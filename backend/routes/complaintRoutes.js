// routes/complaintRoutes.js
const express = require("express");
const router = express.Router();
const complaintController = require("../controllers/complaintController");

router.get("/", complaintController.getAllComplaints);           // GET  /api/complaints
router.get("/:id", complaintController.getComplaintById);        // GET  /api/complaints/5
router.post("/", complaintController.createComplaint);           // POST /api/complaints
router.put("/:id", complaintController.updateComplaintStatus);   // PUT  /api/complaints/5
router.delete("/:id", complaintController.deleteComplaint);      // DEL  /api/complaints/5

module.exports = router;