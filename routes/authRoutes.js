const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/authController');
const { upload } = require('../config/cloudinary');

const validate = require('../middleware/validateMiddleware');
const { loginSchema, registerSchema } = require('../utils/schemas');

/**
 * Authentication Routes Orchestrator
 * Maps user entry points to the modular authController.
 */
router.post('/register', upload.single('image'), validate(registerSchema), authController.registerUser);
router.post('/login', validate(loginSchema), authController.authUser);

module.exports = router;
