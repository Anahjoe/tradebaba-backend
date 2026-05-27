const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/validation');

// All admin routes are protected
router.get('/dashboard/stats', authenticateToken, adminController.getDashboardStats);
router.get('/disputes/pending', authenticateToken, adminController.getPendingDisputes);
router.post('/disputes/:disputeId/resolve', authenticateToken, adminController.resolveDispute);
router.post('/users/:targetUserId/verify', authenticateToken, adminController.verifyUser);
router.post('/users/:targetUserId/ban', authenticateToken, adminController.banUser);
router.get('/users', authenticateToken, adminController.getUsers);
router.post('/listings/:listingId/remove', authenticateToken, adminController.removeListing);

module.exports = router;
