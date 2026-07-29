// adminRoutes.js  (Aswin - Admin analytics)
// Every route here is admin-only: router.use applies the guards to ALL
// routes below it, so verifyToken (logged in?) then authorizeRoles('admin')
// (is an admin?) run before any analytics query.
const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminController");
const { verifyToken, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(verifyToken, authorizeRoles("admin"));

router.get("/summary", controller.getSummary);
router.get("/complaints-by-centre", controller.getComplaintsByCentre);
router.get("/complaints-by-category", controller.getComplaintsByCategory);
router.get("/complaints-by-month", controller.getComplaintsByMonth);
router.get("/top-stalls", controller.getTopStalls);
router.get("/agreements-summary", controller.getAgreementsSummary);

// User management (admin: list + delete)
router.get("/users", controller.getUsers);
router.delete("/users/:id", controller.deleteUser);

module.exports = router;
