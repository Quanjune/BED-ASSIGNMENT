// routes/feedbackRoutes.js
const express = require("express");
const router = express.Router();
const feedbackController = require("../controllers/feedbackController");

router.get("/", feedbackController.getAllFeedback);          // GET  /api/feedback
router.get("/:id", feedbackController.getFeedbackById);      // GET  /api/feedback/5
router.post("/", feedbackController.createFeedback);         // POST /api/feedback
router.put("/:id", feedbackController.updateFeedback);       // PUT  /api/feedback/5
router.delete("/:id", feedbackController.deleteFeedback);    // DEL  /api/feedback/5

module.exports = router;