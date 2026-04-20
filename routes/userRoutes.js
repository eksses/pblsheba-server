const express = require('express');
const router = express.Router();
const { searchUsers, requestEdit, changePassword, updateProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

router.get('/search', protect, searchUsers);
router.patch('/request-edit', protect, requestEdit);
router.patch('/change-password', protect, changePassword);
router.patch('/profile', protect, upload.single('image'), updateProfile);

module.exports = router;
