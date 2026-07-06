const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// POST /api/auth/signup
router.post('/signup', userController.signup);

module.exports = router;