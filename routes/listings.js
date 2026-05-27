const express = require('express');
const router = express.Router();
const listingsController = require('../controllers/listingsController');
const { authenticateToken } = require('../middleware/validation');

// Public routes
router.get('/', listingsController.getListings);
router.get('/categories', listingsController.getCategories);
router.get('/:id', listingsController.getListing);
router.get('/user/:userId', listingsController.getUserListings);

// Protected routes
router.post('/', authenticateToken, listingsController.createListing);
router.put('/:id', authenticateToken, listingsController.updateListing);
router.delete('/:id', authenticateToken, listingsController.deleteListing);

module.exports = router;
