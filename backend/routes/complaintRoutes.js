// routes/complaintRoutes.js
//
// WHO CAN DO WHAT
//   GET  /stall/:stallId  public    - complaints about one stall (vendor panel)
//   GET  /                public    - the full list
//   GET  /:id             public    - one complaint
//   POST /                logged in - author comes from the token
//   PUT  /:id             vendor who owns the stall, or admin (checked in controller)
//   DELETE /:id           author, or admin (checked in controller)
const express = require("express");
const router = express.Router();
const complaintController = require("../controllers/complaintController");
const { verifyToken } = require("../middlewares/authMiddleware"); // Aswin's

// Fixed path first - otherwise /stall/3 would be matched by /:id.
router.get("/stall/:stallId", complaintController.getComplaintsByStall); // GET /api/complaints/stall/3

router.get("/", complaintController.getAllComplaints);           // GET  /api/complaints
router.get("/:id", complaintController.getComplaintById);        // GET  /api/complaints/5
router.post("/", verifyToken, complaintController.createComplaint);         // POST /api/complaints
router.put("/:id", verifyToken, complaintController.updateComplaintStatus); // PUT  /api/complaints/5
router.delete("/:id", verifyToken, complaintController.deleteComplaint);    // DEL  /api/complaints/5

module.exports = router;