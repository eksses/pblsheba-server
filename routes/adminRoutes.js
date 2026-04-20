const express = require('express');
const router = express.Router();
const { approveUser, getMetrics, getPendingMembers, createEmployee, createMember, getEmployees, getMembers, deleteUser, updateUser, getSettings, updateSettings, getLeaderboard, getEditRequests, dismissEditRequest } = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

const { upload } = require('../config/cloudinary');

router.patch('/approve/:id', protect, admin, approveUser);
router.get('/dashboard', protect, admin, getMetrics);
router.get('/pending', protect, admin, getPendingMembers);
router.post('/employees', protect, admin, upload.single('image'), createEmployee);
router.post('/members', protect, admin, upload.single('image'), createMember);
router.get('/employees', protect, admin, getEmployees);
router.get('/members', protect, admin, getMembers);
router.delete('/users/:id', protect, admin, deleteUser);
router.patch('/users/:id', protect, admin, upload.single('image'), updateUser);

router.get('/edit-requests', protect, admin, getEditRequests);
router.patch('/edit-requests/:id/dismiss', protect, admin, dismissEditRequest);

router.get('/settings', protect, admin, getSettings);
router.patch('/settings', protect, admin, updateSettings);

router.get('/leaderboard', protect, admin, getLeaderboard);

module.exports = router;
