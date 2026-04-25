const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/subscribe', protect, notificationController.subscribe);
router.post('/unsubscribe', protect, notificationController.unsubscribe);
router.post('/test-push', protect, admin, notificationController.testPush);
router.get('/my-subscriptions', protect, notificationController.mySubscriptions);

module.exports = router;
