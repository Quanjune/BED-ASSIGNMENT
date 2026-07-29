// controllers/feedbackController.js
//
// WHO OWNS A REVIEW: the author is taken from the JWT (req.user.userId set by
// verifyToken), never from the request body. That is what makes "edit my own
// review" enforceable - before this, anyone could pass any name and edit any row.
// Reads stay public so guests can browse reviews before signing up.
const feedbackModel = require("../models/feedbackModel");
const stallModel = require("../models/vendorStallModel"); // Kishore's, read-only reuse

// Shared guard: the author, or an admin, may change a review.
// Vendors deliberately cannot edit or delete reviews of their own stall -
// that would defeat the point of having public reviews.
function canModify(req, feedback) {
  if (req.user.role === "admin") return true;
  return String(req.user.userId) === String(feedback.userId);
}

// GET /api/feedback  (public)
async function getAllFeedback(req, res) {
  try {
    const feedback = await feedbackModel.getAllFeedback();
    res.json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve feedback" });
  }
}

// GET /api/feedback/stall-ratings  (public)
// Average rating + review count per stall, for the stalls listing cards.
async function getStallRatings(req, res) {
  try {
    const ratings = await feedbackModel.getStallRatings();
    res.json(ratings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve stall ratings" });
  }
}

// GET /api/feedback/stall/:stallId  (public)
async function getFeedbackByStall(req, res) {
  try {
    const stallId = parseInt(req.params.stallId);
    if (isNaN(stallId)) {
      return res.status(400).json({ error: "Invalid stall id" });
    }
    const feedback = await feedbackModel.getFeedbackByStall(stallId);
    res.json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve feedback" });
  }
}

// GET /api/feedback/:id  (public)
async function getFeedbackById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid feedback id" });
    }
    const feedback = await feedbackModel.getFeedbackById(id);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    res.json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve feedback" });
  }
}

// POST /api/feedback  (login required)
async function createFeedback(req, res) {
  try {
    const { stallId, rating } = req.body;
    // input validation - userId is no longer expected from the client
    if (!stallId || rating === undefined) {
      return res.status(400).json({ error: "stallId and rating are required" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be between 1 and 5" });
    }

    const newId = await feedbackModel.createFeedback({
      stallId,
      rating,
      comment: req.body.comment,
      userId: String(req.user.userId),   // identity from the token
    });
    res.status(201).json({ message: "Feedback submitted", feedbackId: newId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create feedback" });
  }
}

// PUT /api/feedback/:id  (author or admin)
async function updateFeedback(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid feedback id" });
    }
    const { rating } = req.body;
    if (rating === undefined || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be between 1 and 5" });
    }

    // Read it first so ownership can be checked before anything changes.
    const existing = await feedbackModel.getFeedbackById(id);
    if (!existing) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    if (!canModify(req, existing)) {
      return res.status(403).json({ error: "You can only edit your own feedback." });
    }

    const rowsChanged = await feedbackModel.updateFeedback(id, req.body);
    if (rowsChanged === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    res.json({ message: "Feedback updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update feedback" });
  }
}

// PUT /api/feedback/:id/reply  (the stall's own vendor, or admin)
// A vendor may ONLY attach a reply. They cannot touch the rating or the
// comment - those stay the customer's words. The check below re-reads the
// review and compares its stallId to the stall this vendor actually owns,
// so nobody can reply on another stall's behalf by guessing an id.
async function replyToFeedback(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid feedback id" });
    }

    const existing = await feedbackModel.getFeedbackById(id);
    if (!existing) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    if (req.user.role !== "admin") {
      const myStall = await stallModel.getStallIdForUser(req.user.userId);
      if (!myStall || myStall !== existing.stallId) {
        return res.status(403).json({
          error: "You can only reply to reviews of your own stall.",
        });
      }
    }

    // An empty reply is allowed on purpose: that is how a vendor removes
    // one they regret. The model clears the timestamp to match.
    const reply = typeof req.body.vendorReply === "string"
      ? req.body.vendorReply.slice(0, 1000)   // matches the column width
      : "";

    const rowsChanged = await feedbackModel.updateVendorReply(id, reply);
    if (rowsChanged === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    res.json({ message: reply.trim() ? "Reply saved" : "Reply removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save reply" });
  }
}

// DELETE /api/feedback/:id  (author or admin)
async function deleteFeedback(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid feedback id" });
    }

    const existing = await feedbackModel.getFeedbackById(id);
    if (!existing) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    if (!canModify(req, existing)) {
      return res.status(403).json({ error: "You can only delete your own feedback." });
    }

    const rowsDeleted = await feedbackModel.deleteFeedback(id);
    if (rowsDeleted === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    res.json({ message: "Feedback deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete feedback" });
  }
}

module.exports = {
  getAllFeedback,
  getStallRatings,
  getFeedbackByStall,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  replyToFeedback,
  deleteFeedback,
};