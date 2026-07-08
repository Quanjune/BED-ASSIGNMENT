const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.post('/signup', userController.signup);
router.post('/login', userController.login);
router.get('/me', verifyToken, userController.getProfile);

module.exports = router;