const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.post('/subscribe', protect, notificationController.subscribe);
router.post('/unsubscribe', protect, notificationController.unsubscribe);

module.exports = router;
