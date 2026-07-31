// officerAuth.js  (Kaden - NEA inspections & hygiene grading)
// Glue between Aswin's auth middleware and my officer lane, written the same
// way as Kishore's vendorAuth.js so the three protected areas of the app all
// follow one pattern.
//
// Aswin's verifyToken puts req.user = { userId, role } on the request from
// the JWT. authorizeRoles("officer") then rejects anyone who is not an NEA
// officer. attachOfficer copies the id out of the token onto req.officerId,
// and every controller reads THAT instead of trusting an officerId sent in
// the request body - so an officer can never file an inspection under a
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
