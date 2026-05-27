const axios = require('axios');
const pool = require('../config/database');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Initialize payment
exports.initializePayment = async (req, res) => {
  try {
    const { listingId, amount, email, metadata } = req.body;
    const userId = req.userId;

    if (!listingId || !amount || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify listing exists and user is not seller
    const listingResult = await pool.query(
      'SELECT user_id FROM listings WHERE id = $1',
      [listingId]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listingResult.rows[0].user_id === userId) {
      return res.status(400).json({ error: 'You cannot buy your own listing' });
    }

    // Check if order already exists
    const existingOrder = await pool.query(
      'SELECT id FROM orders WHERE listing_id = $1 AND buyer_id = $2 AND status != $3',
      [listingId, userId, 'completed']
    );

    if (existingOrder.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active order for this listing' });
    }

    // Initialize Paystack payment
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: Math.round(amount * 100), // Convert to kobo
        metadata: {
          listingId,
          buyerId: userId,
          ...metadata,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const { authorization_url, access_code, reference } = response.data.data;

    // Create order record (pending payment)
    const orderResult = await pool.query(
      `INSERT INTO orders 
       (listing_id, buyer_id, seller_id, amount, paystack_reference, paystack_authorization_url, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        listingId,
        userId,
        listingResult.rows[0].user_id,
        amount,
        reference,
        authorization_url,
        'pending',
      ]
    );

    res.json({
      message: 'Payment initialized',
      order: orderResult.rows[0],
      authorization_url,
      access_code,
      reference,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({ error: 'Reference is required' });
    }

    // Verify with Paystack
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paymentData = response.data.data;

    // Update order status
    const orderResult = await pool.query(
      `UPDATE orders 
       SET status = $1, payment_date = CURRENT_TIMESTAMP, auto_release_at = CURRENT_TIMESTAMP + INTERVAL '7 days'
       WHERE paystack_reference = $2
       RETURNING *`,
      [paymentData.status === 'success' ? 'paid' : 'failed', reference]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Record transaction
    await pool.query(
      `INSERT INTO paystack_transactions (order_id, paystack_reference, amount, status, response)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.id, reference, paymentData.amount / 100, paymentData.status, JSON.stringify(paymentData)]
    );

    // Create notification for seller
    if (order.status === 'paid') {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, related_order_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.seller_id,
          'order_created',
          'New Order Received',
          'You have received a new order. Prepare the item for shipment.',
          order.id,
        ]
      );
    }

    res.json({
      message: 'Payment verified',
      order,
      paymentStatus: paymentData.status,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

// Webhook for Paystack (handle payment confirmation server-to-server)
exports.webhookPaystack = async (req, res) => {
  try {
    const hash = require('crypto')
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      // Update order
      await pool.query(
        `UPDATE orders 
         SET status = 'paid', payment_date = CURRENT_TIMESTAMP, auto_release_at = CURRENT_TIMESTAMP + INTERVAL '7 days'
         WHERE paystack_reference = $1`,
        [reference]
      );

      // Get order details for notification
      const orderResult = await pool.query(
        'SELECT * FROM orders WHERE paystack_reference = $1',
        [reference]
      );

      if (orderResult.rows.length > 0) {
        const order = orderResult.rows[0];

        // Notify seller
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, related_order_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            order.seller_id,
            'order_created',
            'New Order Received',
            'Payment confirmed. Prepare the item for shipment.',
            order.id,
          ]
        );
      }
    }

    res.json({ message: 'Webhook received' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Get order details
exports.getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    const result = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [orderId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

// Confirm delivery
exports.confirmDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;

    // Verify buyer is the one confirming
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND buyer_id = $2 AND status = $3',
      [orderId, userId, 'shipped']
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or not ready for delivery confirmation' });
    }

    // Update order
    const result = await pool.query(
      `UPDATE orders 
       SET status = 'delivered', buyer_confirmed_delivery = TRUE, confirmed_delivery_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [orderId]
    );

    // Release escrow to seller
    const order = result.rows[0];
    await pool.query(
      'UPDATE orders SET status = $1, escrow_released_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', orderId]
    );

    // TODO: Initiate Paystack transfer to seller
    // This requires seller's bank account details which should be saved in the system

    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_order_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        order.seller_id,
        'delivery_confirmed',
        'Order Completed',
        'Buyer confirmed delivery. Payment released to your account.',
        order.id,
      ]
    );

    res.json({
      message: 'Delivery confirmed and payment released',
      order: result.rows[0],
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
};

// Get user orders
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const { role = 'buyer', status, limit = 20, offset = 0 } = req.query;

    let query = '';
    let params = [userId];

    if (role === 'buyer') {
      query = 'SELECT * FROM orders WHERE buyer_id = $1';
    } else if (role === 'seller') {
      query = 'SELECT * FROM orders WHERE seller_id = $1';
    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json({ orders: result.rows });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};
