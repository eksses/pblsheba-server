const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, admin, owner } = require('../middleware/authMiddleware');

router.post('/subscribe', protect, notificationController.subscribe);
router.post('/unsubscribe', protect, notificationController.unsubscribe);
router.post('/test-push', protect, admin, notificationController.testPush);
router.post('/broadcast', protect, owner, notificationController.broadcast);
router.get('/my-subscriptions', protect, notificationController.mySubscriptions);
router.get('/all-subscriptions', protect, owner, notificationController.allSubscriptions);

module.exports = router;
