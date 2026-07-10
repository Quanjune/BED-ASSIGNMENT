const jwt = require('jsonwebtoken');

// AUTHENTICATION — "who are you?"
// Checks the token in the Authorization header. If valid, attaches the user to req.
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Please log in.' });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = decoded; // { userId, role, iat, exp }
    next();
  });
}

// AUTHORIZATION — "are you allowed?"
// Use like authorizeRoles('admin') to lock a route to certain roles.
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this.' });
    }
    next();
  };
}

module.exports = { verifyToken, authorizeRoles };