const express = require('express');
const router = express.Router();
const { publicSearch, getPublicSettings } = require('../controllers/userController');
const { submitJobApplication } = require('../controllers/jobController');
const { upload } = require('../config/cloudinary');

router.get('/search', publicSearch);
router.get('/settings', getPublicSettings);
router.post('/career/apply', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), submitJobApplication);

module.exports = router;
