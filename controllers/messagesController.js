const pool = require('../config/database');

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId, recipientId, content } = req.body;

    if (!orderId || !recipientId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify order and that user is part of it
    const orderResult = await pool.query(
      'SELECT buyer_id, seller_id FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Verify sender is part of order
    if (userId !== order.buyer_id && userId !== order.seller_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Verify recipient is the other party
    if (recipientId !== order.buyer_id && recipientId !== order.seller_id) {
      return res.status(400).json({ error: 'Invalid recipient' });
    }

    if (userId === recipientId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    // Create message
    const result = await pool.query(
      `INSERT INTO messages (order_id, sender_id, recipient_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orderId, userId, recipientId, content]
    );

    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_order_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        recipientId,
        'new_message',
        'New Message',
        'You have a new message in your order',
        orderId,
      ]
    );

    res.status(201).json({
      message: 'Message sent successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// Get conversation (messages for an order)
exports.getConversation = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify user is part of order
    const orderResult = await pool.query(
      'SELECT buyer_id, seller_id FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    if (userId !== order.buyer_id && userId !== order.seller_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get messages
    const result = await pool.query(
      `SELECT m.*, u.first_name, u.last_name, u.avatar_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.order_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [orderId, parseInt(limit), parseInt(offset)]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE order_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
      [orderId, userId]
    );

    res.json({
      messages: result.rows,
      order: {
        id: orderId,
        buyerId: order.buyer_id,
        sellerId: order.seller_id,
      },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Get all conversations for user
exports.getUserConversations = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT DISTINCT o.id as order_id, 
        CASE 
          WHEN o.buyer_id = $1 THEN u_seller.id
          ELSE u_buyer.id
        END as other_user_id,
        CASE 
          WHEN o.buyer_id = $1 THEN u_seller.first_name
          ELSE u_buyer.first_name
        END as other_user_first_name,
        CASE 
          WHEN o.buyer_id = $1 THEN u_seller.last_name
          ELSE u_buyer.last_name
        END as other_user_last_name,
        (SELECT content FROM messages WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages WHERE order_id = o.id AND recipient_id = $1 AND is_read = FALSE) as unread_count
       FROM orders o
       JOIN users u_buyer ON o.buyer_id = u_buyer.id
       JOIN users u_seller ON o.seller_id = u_seller.id
       WHERE o.buyer_id = $1 OR o.seller_id = $1
       ORDER BY last_message_time DESC NULLS LAST`,
      [userId]
    );

    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

// Delete message (only sender can delete)
exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId } = req.params;

    // Check ownership
    const checkResult = await pool.query(
      'SELECT sender_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (checkResult.rows[0].sender_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete message
    await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};
