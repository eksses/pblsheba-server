const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');

// Granular Controllers
const publicUserController = require('../controllers/public/publicUserController');
const publicCareerController = require('../controllers/public/careerController');

/**
 * Public Routes Orchestrator
 * Handles unauthenticated lookup and service entry points.
 */

// Member Lookup
router.get('/search', publicUserController.publicSearch);

// System Config
router.get('/settings', publicUserController.getPublicSettings);

// Career Submissions
router.post('/career/apply', 
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), 
  publicCareerController.submitJobApplication
);

module.exports = router;
