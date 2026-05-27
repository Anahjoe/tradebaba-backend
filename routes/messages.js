const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messagesController');
const { authenticateToken } = require('../middleware/validation');

// All message routes are protected
router.post('/', authenticateToken, messagesController.sendMessage);
router.get('/order/:orderId', authenticateToken, messagesController.getConversation);
router.get('/', authenticateToken, messagesController.getUserConversations);
router.delete('/:messageId', authenticateToken, messagesController.deleteMessage);

module.exports = router;
