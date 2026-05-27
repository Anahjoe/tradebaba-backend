const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviewsController');
const { authenticateToken } = require('../middleware/validation');

// Public routes
router.get('/user/:userId', reviewsController.getUserReviews);
router.get('/order/:orderId', reviewsController.getOrderReview);

// Protected routes
router.post('/', authenticateToken, reviewsController.createReview);
router.delete('/:reviewId', authenticateToken, reviewsController.deleteReview);

module.exports = router;
