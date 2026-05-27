const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const { authenticateToken } = require('../middleware/validation');

// All order routes are protected
router.post('/:orderId/dispute', authenticateToken, ordersController.createDispute);
router.get('/:orderId/timeline', authenticateToken, ordersController.getOrderTimeline);
router.get('/:orderId/disputes', authenticateToken, ordersController.getOrderDisputes);
router.put('/:orderId/shipping', authenticateToken, ordersController.updateShippingInfo);

module.exports = router;
