// officerAuth.js  (Kaden - NEA inspections & hygiene grading)
//
// rejects anyone who is not an NEA officer can never file 
// also u cannot file an inspection under another
// colleague's name.
const { verifyToken, authorizeRoles } = require("./authMiddleware"); // Aswin's

function attachOfficer(req, res, next) {
  // verifyToken has already run, so req.user is guaranteed to exist here.
  req.officerId = req.user.userId;
  next();
}

// 1) valid token?  2) role is officer?  3) which officer is it?
const requireOfficer = [verifyToken, authorizeRoles("officer"), attachOfficer];

module.exports = { requireOfficer, attachOfficer };
