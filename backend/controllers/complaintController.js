// controllers/complaintController.js
//
// WHO CAN DO WHAT
//   read    - public (the complaints list stays open to everyone)
//   create  - any logged-in user; the author comes from the JWT
//   resolve - the VENDOR who owns that stall, or an admin.
//             Deliberately not the complainant: letting people close their
//             own complaint would make the Open/Resolved status meaningless.
//   delete  - the author (withdrawing it), or an admin.
const complaintModel = require("../models/complaintModel");
const stallModel = require("../models/vendorStallModel"); // Kishore's, read-only reuse

// Which stall does this caller own? null for customers/admins.
async function ownedStallId(req) {
  if (req.user.role !== "vendor") return null;
  return await stallModel.getStallIdForUser(req.user.userId);
}

// GET /api/complaints  (public)
async function getAllComplaints(req, res) {
  try {
    const complaints = await complaintModel.getAllComplaints();
    res.json(complaints);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve complaints" });
  }
}

// GET /api/complaints/stall/:stallId  (public)
async function getComplaintsByStall(req, res) {
  try {
    const stallId = parseInt(req.params.stallId);
    if (isNaN(stallId)) {
      return res.status(400).json({ error: "Invalid stall id" });
    }
    const complaints = await complaintModel.getComplaintsByStall(stallId);
    res.json(complaints);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve complaints" });
  }
}

// GET /api/complaints/:id  (public)
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

// POST /api/complaints  (login required)
async function createComplaint(req, res) {
  try {
    const { stallId, description } = req.body;
    // userId is no longer expected from the client - it comes from the token
    if (!stallId || !description) {
      return res.status(400).json({ error: "stallId and description are required" });
    }

    const newId = await complaintModel.createComplaint({
      stallId,
      description,
      category: req.body.category,
      userId: String(req.user.userId),
    });
    res.status(201).json({ message: "Complaint submitted", complaintId: newId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create complaint" });
  }
}

// PUT /api/complaints/:id  (vendor who owns the stall, or admin)
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
    if (status !== "Open" && status !== "Resolved") {
      return res.status(400).json({ error: "status must be 'Open' or 'Resolved'" });
    }

    const existing = await complaintModel.getComplaintById(id);
    if (!existing) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    if (req.user.role !== "admin") {
      const myStall = await ownedStallId(req);
      if (myStall === null || myStall !== existing.stallId) {
        return res.status(403).json({
          error: "Only the stall this complaint is about (or an admin) can change its status.",
        });
      }
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

// DELETE /api/complaints/:id  (author or admin)
async function deleteComplaint(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid complaint id" });
    }

    const existing = await complaintModel.getComplaintById(id);
    if (!existing) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const isAuthor = String(req.user.userId) === String(existing.userId);
    if (req.user.role !== "admin" && !isAuthor) {
      return res.status(403).json({ error: "You can only delete your own complaint." });
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
  getComplaintsByStall,
  getComplaintById,
  createComplaint,
  updateComplaintStatus,
  deleteComplaint,
};