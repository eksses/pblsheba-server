const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Granular Controllers
const profileController = require('../controllers/user/profileController');
const requestController = require('../controllers/user/requestController');
const discoveryController = require('../controllers/user/discoveryController');

/**
 * User Routes Orchestrator
 * Handles protected member and employee profile management and internal searches.
 */

// Member Discovery
router.get('/search', protect, discoveryController.searchUsers);

// Profile & Security
router.patch('/change-password', protect, profileController.changePassword);
router.patch('/profile', protect, upload.single('image'), profileController.updateProfile);

// Administrative Requests
router.patch('/request-edit', protect, requestController.requestEdit);

module.exports = router;
