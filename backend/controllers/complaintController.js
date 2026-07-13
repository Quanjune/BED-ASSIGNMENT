// controllers/complaintController.js
const complaintModel = require("../models/complaintModel");

async function getAllComplaints(req, res) {
  try {
    const complaints = await complaintModel.getAllComplaints();
    res.json(complaints);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve complaints" });
  }
}

async function getComplaintById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid complaint id" });
    }
    const complaint = await complaintModel.getComplaintById(id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    res.json(complaint);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve complaint" });
  }
}

async function createComplaint(req, res) {
  try {
    const { stallId, userId, description } = req.body;
    if (!stallId || !userId || !description) {
      return res.status(400).json({ error: "stallId, userId and description are required" });
    }
    const newId = await complaintModel.createComplaint(req.body);
    res.status(201).json({ message: "Complaint submitted", complaintId: newId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create complaint" });
  }
}

async function updateComplaintStatus(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid complaint id" });
    }
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }
    const rowsChanged = await complaintModel.updateComplaintStatus(id, status);
    if (rowsChanged === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    res.json({ message: "Complaint status updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update complaint" });
  }
}

async function deleteComplaint(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid complaint id" });
    }
    const rowsDeleted = await complaintModel.deleteComplaint(id);
    if (rowsDeleted === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    res.json({ message: "Complaint deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete complaint" });
  }
}

module.exports = {
  getAllComplaints,
  getComplaintById,
  createComplaint,
  updateComplaintStatus,
  deleteComplaint,
};