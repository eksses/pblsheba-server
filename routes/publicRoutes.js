const express = require('express');
const router = express.Router();
const { publicSearch, getPublicSettings } = require('../controllers/userController');

router.get('/search', publicSearch);
router.get('/settings', getPublicSettings);

module.exports = router;
