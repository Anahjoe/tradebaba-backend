const express = require('express');
const router = express.Router();
const paystackController = require('../controllers/paystackController');
const { authenticateToken } = require('../middleware/validation');

// Public webhook (no auth needed)
router.post('/webhook', paystackController.webhookPaystack);

// Protected routes
router.post('/initialize', authenticateToken, paystackController.initializePayment);
router.post('/verify', authenticateToken, paystackController.verifyPayment);
router.get('/order/:orderId', authenticateToken, paystackController.getOrder);
router.post('/order/:orderId/confirm-delivery', authenticateToken, paystackController.confirmDelivery);
router.get('/user/orders', authenticateToken, paystackController.getUserOrders);

module.exports = router;
