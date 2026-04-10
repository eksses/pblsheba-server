const express = require('express');
const router = express.Router();
const { registerUser, authUser } = require('../controllers/authController');

const { upload } = require('../config/cloudinary');

router.post('/register', upload.single('image'), registerUser);
router.post('/login', authUser);

module.exports = router;
