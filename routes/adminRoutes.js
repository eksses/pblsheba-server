const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Granular Controllers
const approvalController = require('../controllers/admin/approvalController');
const memberController = require('../controllers/admin/memberController');
const employeeController = require('../controllers/admin/employeeController');
const settingsController = require('../controllers/admin/settingsController');
const dashboardController = require('../controllers/admin/dashboardController');
const careerController = require('../controllers/admin/careerController');
const profileController = require('../controllers/admin/profileController');

/**
 * Admin Routes Orchestrator
 * Maps individual administrative actions to their corresponding modular controllers.
 */

// Member Approvals & Edit Requests
router.patch('/approve/:id', protect, admin, approvalController.approveUser);
router.get('/pending', protect, admin, approvalController.getPendingMembers);
router.get('/edit-requests', protect, admin, approvalController.getEditRequests);
router.patch('/edit-requests/:id/dismiss', protect, admin, approvalController.dismissEditRequest);

// Dashboard & Analytics
router.get('/dashboard', protect, admin, dashboardController.getMetrics);
router.get('/leaderboard', protect, admin, dashboardController.getLeaderboard);

// Admin Self Profile
router.post('/profile/image', protect, admin, upload.single('image'), profileController.updateProfileImage);
router.patch('/profile/password', protect, admin, profileController.changePassword);

// Member Management
router.get('/members', protect, admin, memberController.getMembers);
router.post('/members', protect, admin, upload.single('image'), memberController.createMember);
router.patch('/users/:id', protect, admin, upload.single('image'), memberController.updateMember); // Legacy endpoint match
router.delete('/users/:id', protect, admin, memberController.deleteMember); // Legacy endpoint match

// Employee Management
router.get('/employees', protect, admin, employeeController.getEmployees);
router.post('/employees', protect, admin, upload.single('image'), employeeController.createEmployee);
router.delete('/employees/:id', protect, admin, employeeController.deleteEmployee);

// System Settings
router.get('/settings', protect, admin, settingsController.getSettings);
router.patch('/settings', protect, admin, settingsController.updateSettings);

// Career / Applications
router.get('/career/applications', protect, admin, careerController.getJobApplications);
router.patch('/career/applications/:id', protect, admin, careerController.updateJobApplicationStatus);

module.exports = router;
