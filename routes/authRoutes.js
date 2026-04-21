const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/authController');
const { upload } = require('../config/cloudinary');

/**
 * Authentication Routes Orchestrator
 * Maps user entry points to the modular authController.
 */
router.post('/register', upload.single('image'), authController.registerUser);
router.post('/login', authController.authUser);

module.exports = router;
