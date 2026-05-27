const pool = require('../config/database');

// Create dispute
exports.createDispute = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId, reason, description, evidenceUrls } = req.body;

    if (!orderId || !reason) {
      return res.status(400).json({ error: 'Order ID and reason are required' });
    }

    // Verify order belongs to user
    const orderResult = await pool.query(
      'SELECT buyer_id, seller_id, status FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Only buyer or seller can create dispute
    if (userId !== order.buyer_id && userId !== order.seller_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if dispute already exists
    const existingDispute = await pool.query(
      'SELECT id FROM disputes WHERE order_id = $1 AND status != $2',
      [orderId, 'resolved']
    );

    if (existingDispute.rows.length > 0) {
      return res.status(400).json({ error: 'Order already has an active dispute' });
    }

    // Create dispute
    const result = await pool.query(
      `INSERT INTO disputes (order_id, raised_by, reason, description, evidence_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orderId, userId, reason, description, JSON.stringify(evidenceUrls || [])]
    );

    // Update order status
    await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['disputed', orderId]
    );

    // Notify both parties
    const notifyUsers = [order.buyer_id, order.seller_id].filter(id => id !== userId);
    for (const notifyUserId of notifyUsers) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, related_order_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [notifyUserId, 'dispute_raised', 'Dispute Raised', 'A dispute has been raised for your order', orderId]
      );
    }

    res.status(201).json({
      message: 'Dispute created successfully',
      dispute: {
        ...result.rows[0],
        evidence_urls: JSON.parse(result.rows[0].evidence_urls || '[]'),
      },
    });
  } catch (error) {
    console.error('Create dispute error:', error);
    res.status(500).json({ error: 'Failed to create dispute' });
  }
};

// Get dispute
exports.getDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;

    const result = await pool.query(
      `SELECT d.*, u.first_name, u.last_name
       FROM disputes d
       JOIN users u ON d.raised_by = u.id
       WHERE d.id = $1`,
      [disputeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    res.json({
      dispute: {
        ...result.rows[0],
        evidence_urls: JSON.parse(result.rows[0].evidence_urls || '[]'),
      },
    });
  } catch (error) {
    console.error('Get dispute error:', error);
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
};

// Get order disputes
exports.getOrderDisputes = async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await pool.query(
      `SELECT d.*, u.first_name, u.last_name
       FROM disputes d
       JOIN users u ON d.raised_by = u.id
       WHERE d.order_id = $1`,
      [orderId]
    );

    res.json({
      disputes: result.rows.map(d => ({
        ...d,
        evidence_urls: JSON.parse(d.evidence_urls || '[]'),
      })),
    });
  } catch (error) {
    console.error('Get order disputes error:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
};

// Update order shipping info
exports.updateShippingInfo = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;
    const { trackingNumber, estimatedDeliveryDate, deliveryNotes } = req.body;

    // Verify seller owns the order
    const orderResult = await pool.query(
      'SELECT seller_id, status FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (orderResult.rows[0].seller_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update order
    const result = await pool.query(
      `UPDATE orders 
       SET tracking_number = COALESCE($1, tracking_number),
           estimated_delivery_date = COALESCE($2, estimated_delivery_date),
           delivery_notes = COALESCE($3, delivery_notes),
           status = 'shipped'
       WHERE id = $4
       RETURNING *`,
      [trackingNumber, estimatedDeliveryDate, deliveryNotes, orderId]
    );

    // Notify buyer
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_order_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        orderResult.rows[0].buyer_id,
        'order_shipped',
        'Order Shipped',
        `Your order has been shipped with tracking number: ${trackingNumber}`,
        orderId,
      ]
    );

    res.json({
      message: 'Shipping information updated',
      order: result.rows[0],
    });
  } catch (error) {
    console.error('Update shipping error:', error);
    res.status(500).json({ error: 'Failed to update shipping information' });
  }
};

// Get order timeline
exports.getOrderTimeline = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

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

    // Get all timeline events (combine multiple tables)
    const timelineEvents = [];

    // Get order details
    const orderDetails = await pool.query(
      'SELECT created_at, payment_date, confirmed_delivery_at, updated_at, status FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderDetails.rows.length > 0) {
      const od = orderDetails.rows[0];
      timelineEvents.push({ timestamp: od.created_at, event: 'Order Created', status: 'pending' });
      if (od.payment_date) timelineEvents.push({ timestamp: od.payment_date, event: 'Payment Received', status: 'paid' });
      if (od.confirmed_delivery_at) timelineEvents.push({ timestamp: od.confirmed_delivery_at, event: 'Delivery Confirmed', status: 'completed' });
    }

    // Get disputes
    const disputes = await pool.query(
      'SELECT created_at, reason FROM disputes WHERE order_id = $1',
      [orderId]
    );

    disputes.rows.forEach(d => {
      timelineEvents.push({ timestamp: d.created_at, event: `Dispute: ${d.reason}`, status: 'disputed' });
    });

    // Sort by timestamp
    timelineEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({ timeline: timelineEvents });
  } catch (error) {
    console.error('Get order timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch order timeline' });
  }
};
