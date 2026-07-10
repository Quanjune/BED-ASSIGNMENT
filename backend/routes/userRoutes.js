const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.post('/signup', userController.signup);
router.post('/login', userController.login);

router.get('/me', verifyToken, userController.getProfile);  // Read
router.put('/me', verifyToken, userController.updateProfile);   // Update
router.delete('/me', verifyToken, userController.deleteAccount); // Delete

router.get('/users', verifyToken, authorizeRoles('admin'), userController.getAllUsers);

module.exports = router;