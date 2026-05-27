const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticateToken } = require('../middleware/validation');

// Public routes
router.get('/profile/:userId', usersController.getUserProfile);
router.get('/stats/:userId', usersController.getUserStats);
router.get('/search', usersController.searchUsers);

// Protected routes
router.get('/me', authenticateToken, usersController.getCurrentUser);
router.put('/profile', authenticateToken, usersController.updateUserProfile);
router.post('/change-password', authenticateToken, usersController.changePassword);
router.get('/notifications', authenticateToken, usersController.getNotifications);
router.put('/notifications/:notificationId/read', authenticateToken, usersController.markNotificationAsRead);

module.exports = router;
