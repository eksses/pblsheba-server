const express = require('express');
const router = express.Router();
const { searchUsers, requestEdit, changePassword } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.get('/search', protect, searchUsers);
router.patch('/request-edit', protect, requestEdit);
router.patch('/change-password', protect, changePassword);

module.exports = router;
