// controllers/feedbackController.js
const feedbackModel = require("../models/feedbackModel");

async function getAllFeedback(req, res) {
  try {
    const feedback = await feedbackModel.getAllFeedback();
    res.json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve feedback" });
  }
}

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

async function createFeedback(req, res) {
  try {
    const { stallId, userId, rating } = req.body;
    // input validation
    if (!stallId || !userId || rating === undefined) {
      return res.status(400).json({ error: "stallId, userId and rating are required" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating must be between 1 and 5" });
    }
    const newId = await feedbackModel.createFeedback(req.body);
    res.status(201).json({ message: "Feedback submitted", feedbackId: newId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create feedback" });
  }
}

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

async function deleteFeedback(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid feedback id" });
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
  getFeedbackById,
  createFeedback,
  updateFeedback,
  deleteFeedback,
};