// adminController.js  (Aswin - Admin analytics)
// Thin controllers - each calls one aggregation query and returns JSON.
// All error handling funnels a 500 with a clear message.
const adminModel = require("../models/adminModel");
const neaService = require("../services/neaService");

async function getSummary(req, res) {
  try {
    return res.status(200).json(await adminModel.getSummary());
  } catch (err) {
    console.error("Admin summary error:", err);
    return res.status(500).json({ message: "Failed to load summary." });
  }
}

async function getComplaintsByCentre(req, res) {
  try {
    return res.status(200).json(await adminModel.getComplaintsByCentre());
  } catch (err) {
    console.error("Complaints-by-centre error:", err);
    return res.status(500).json({ message: "Failed to load complaints by centre." });
  }
}

async function getComplaintsByCategory(req, res) {
  try {
    return res.status(200).json(await adminModel.getComplaintsByCategory());
  } catch (err) {
    console.error("Complaints-by-category error:", err);
    return res.status(500).json({ message: "Failed to load complaints by category." });
  }
}

async function getComplaintsByMonth(req, res) {
  try {
    return res.status(200).json(await adminModel.getComplaintsByMonth());
  } catch (err) {
    console.error("Complaints-by-month error:", err);
    return res.status(500).json({ message: "Failed to load complaints by month." });
  }
}

async function getTopStalls(req, res) {
  try {
    return res.status(200).json(await adminModel.getTopStalls());
  } catch (err) {
    console.error("Top-stalls error:", err);
    return res.status(500).json({ message: "Failed to load top stalls." });
  }
}

async function getAgreementsSummary(req, res) {
  try {
    return res.status(200).json(await adminModel.getAgreementsSummary());
  } catch (err) {
    console.error("Agreements-summary error:", err);
    return res.status(500).json({ message: "Failed to load agreements summary." });
  }
}

// ---- Revenue & Orders analytics ----

async function getRevenueSummary(req, res) {
  try {
    return res.status(200).json(await adminModel.getRevenueSummary());
  } catch (err) {
    console.error("Revenue summary error:", err);
    return res.status(500).json({ message: "Failed to load revenue summary." });
  }
}

async function getRevenueByMonth(req, res) {
  try {
    return res.status(200).json(await adminModel.getRevenueByMonth());
  } catch (err) {
    console.error("Revenue-by-month error:", err);
    return res.status(500).json({ message: "Failed to load revenue by month." });
  }
}

async function getOrdersByPayment(req, res) {
  try {
    return res.status(200).json(await adminModel.getOrdersByPayment());
  } catch (err) {
    console.error("Orders-by-payment error:", err);
    return res.status(500).json({ message: "Failed to load orders by payment method." });
  }
}

async function getRevenueByCentre(req, res) {
  try {
    return res.status(200).json(await adminModel.getRevenueByCentre());
  } catch (err) {
    console.error("Revenue-by-centre error:", err);
    return res.status(500).json({ message: "Failed to load revenue by centre." });
  }
}

async function getTopStallsByRevenue(req, res) {
  try {
    return res.status(200).json(await adminModel.getTopStallsByRevenue());
  } catch (err) {
    console.error("Top-stalls-by-revenue error:", err);
    return res.status(500).json({ message: "Failed to load top stalls by revenue." });
  }
}

// ---- User management (admin) ----

async function getUsers(req, res) {
  try {
    return res.status(200).json(await adminModel.listUsers());
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ message: "Failed to load users." });
  }
}

async function deleteUser(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ message: "Invalid user id." });
  }
  // an admin cannot delete their own account from this page
  if (userId === req.user.userId) {
    return res.status(400).json({ message: "You cannot delete your own account here." });
  }
  try {
    const rows = await adminModel.deleteUserById(userId);
    if (rows === 0) return res.status(404).json({ message: "User not found." });
    return res.status(200).json({ message: "User deleted." });
  } catch (err) {
    console.error("Delete user error:", err);
    // usually a foreign-key conflict: the user still has orders / reviews
    return res.status(409).json({ message: "Cannot delete this user - they have related records (orders, reviews, etc.)." });
  }
}

// ---- Third-party API: live NEA hawker-centre data from data.gov.sg ----
async function getNeaHawkerCentres(req, res) {
  try {
    const data = await neaService.fetchHawkerCentres();
    return res.status(200).json(data);
  } catch (err) {
    console.error("NEA hawker centres fetch error:", err.message);
    // 502 = we (the gateway) failed to get a good response from the upstream API.
    return res.status(502).json({
      message: "Could not reach the NEA data service (data.gov.sg). Please try again shortly.",
    });
  }
}

module.exports = {
  getSummary,
  getComplaintsByCentre,
  getComplaintsByCategory,
  getComplaintsByMonth,
  getTopStalls,
  getAgreementsSummary,
  getRevenueSummary,
  getRevenueByMonth,
  getOrdersByPayment,
  getRevenueByCentre,
  getTopStallsByRevenue,
  getNeaHawkerCentres,
  getUsers,
  deleteUser
};
