const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { signupSchema, loginSchema, updateProfileSchema, cardSchema } = require('../validators/userValidator');

// middleware runs left to right: validate -> (verifyToken) -> controller
router.post('/signup', validate(signupSchema), userController.signup);
router.post('/login', validate(loginSchema), userController.login);

router.get('/me', verifyToken, userController.getProfile);  // Read
router.put('/me', verifyToken, validate(updateProfileSchema), userController.updateProfile);   // Update
router.delete('/me', verifyToken, userController.deleteAccount); // Delete

// Saved card (customer payment details) - part of the user profile
router.put('/me/card', verifyToken, validate(cardSchema), userController.saveCard);
router.delete('/me/card', verifyToken, userController.removeCard);

router.get('/users', verifyToken, authorizeRoles('admin'), userController.getAllUsers);

module.exports = router;