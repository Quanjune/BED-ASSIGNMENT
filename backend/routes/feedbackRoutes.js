// routes/feedbackRoutes.js
//
// WHO CAN DO WHAT
//   GET  /stall-ratings   public - avg rating + count per stall (stalls page)
//   GET  /stall/:stallId  public - all reviews for one stall
//   GET  /                public - every review
//   GET  /:id             public - one review
//   POST /                logged in - author comes from the token
//   PUT/DELETE /:id       author or admin (checked in the controller)
//
// Reads are public on purpose: a guest browsing stalls should see ratings
// and reviews without an account. Only writing needs a login.
const express = require("express");
const router = express.Router();
const feedbackController = require("../controllers/feedbackController");
const { verifyToken } = require("../middlewares/authMiddleware"); // Aswin's

// IMPORTANT: the fixed paths come BEFORE /:id. Express matches top-to-bottom,
// so with /:id first a call to /api/feedback/stall-ratings would be read as
// id="stall-ratings", fail parseInt and 400.
router.get("/stall-ratings", feedbackController.getStallRatings);   // GET /api/feedback/stall-ratings
router.get("/stall/:stallId", feedbackController.getFeedbackByStall); // GET /api/feedback/stall/3

router.get("/", feedbackController.getAllFeedback);                 // GET  /api/feedback
router.get("/:id", feedbackController.getFeedbackById);             // GET  /api/feedback/5
router.post("/", verifyToken, feedbackController.createFeedback);   // POST /api/feedback
// Vendor reply. A distinct path from PUT /:id so a vendor can never reach
// the handler that edits a customer's rating or comment.
router.put("/:id/reply", verifyToken, feedbackController.replyToFeedback); // PUT /api/feedback/5/reply
router.put("/:id", verifyToken, feedbackController.updateFeedback); // PUT  /api/feedback/5
router.delete("/:id", verifyToken, feedbackController.deleteFeedback); // DEL /api/feedback/5

module.exports = router;