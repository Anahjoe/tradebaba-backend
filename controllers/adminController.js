const pool = require('../config/database');

// Middleware to check if user is admin
const checkAdmin = async (userId) => {
  // For MVP, we'll use a simple check. In production, add an is_admin field to users table
  const admins = process.env.ADMIN_USERS?.split(',') || [];
  return admins.includes(userId);
};

// Resolve dispute
exports.resolveDispute = async (req, res) => {
  try {
    const userId = req.userId;
    const { disputeId } = req.params;
    const { resolution } = req.body; // refund_buyer, release_to_seller, split

    // Check admin
    if (!(await checkAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get dispute
    const disputeResult = await pool.query(
      'SELECT * FROM disputes WHERE id = $1',
      [disputeId]
    );

    if (disputeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = disputeResult.rows[0];

    // Get order
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [dispute.order_id]
    );

    const order = orderResult.rows[0];

    // Resolve dispute
    let orderStatus = order.status;
    let notificationMessage = '';

    if (resolution === 'refund_buyer') {
      orderStatus = 'refunded';
      notificationMessage = 'Dispute resolved in your favor. You will receive a refund.';
      // TODO: Process refund via Paystack
    } else if (resolution === 'release_to_seller') {
      orderStatus = 'completed';
      notificationMessage = 'Dispute resolved. Payment released to seller.';
      // TODO: Process transfer to seller
    } else if (resolution === 'split') {
      orderStatus = 'completed';
      notificationMessage = 'Dispute resolved with payment split.';
      // TODO: Process split payment
    }

    // Update dispute
    await pool.query(
      `UPDATE disputes 
       SET status = 'resolved', resolution = $1, resolved_by = $2, resolved_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [resolution, userId, disputeId]
    );

    // Update order
    await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      [orderStatus, dispute.order_id]
    );

    // Notify both parties
    const notification_data = [
      [order.buyer_id, 'dispute_resolved', 'Dispute Resolved', notificationMessage, order.id],
      [order.seller_id, 'dispute_resolved', 'Dispute Resolved', notificationMessage, order.id],
    ];

    for (const data of notification_data) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, related_order_id)
         VALUES ($1, $2, $3, $4, $5)`,
        data
      );
    }

    res.json({
      message: 'Dispute resolved successfully',
      resolution,
    });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
};

// Get pending disputes
exports.getPendingDisputes = async (req, res) => {
  try {
    const userId = req.userId;

    if (!(await checkAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(
      `SELECT d.*, o.*, u_buyer.first_name as buyer_first_name, u_buyer.last_name as buyer_last_name,
              u_seller.first_name as seller_first_name, u_seller.last_name as seller_last_name
       FROM disputes d
       JOIN orders o ON d.order_id = o.id
       JOIN users u_buyer ON o.buyer_id = u_buyer.id
       JOIN users u_seller ON o.seller_id = u_seller.id
       WHERE d.status = 'open' OR d.status = 'under_review'
       ORDER BY d.created_at ASC`
    );

    res.json({
      disputes: result.rows.map(d => ({
        ...d,
        evidence_urls: JSON.parse(d.evidence_urls || '[]'),
      })),
    });
  } catch (error) {
    console.error('Get pending disputes error:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
};

// Verify user
exports.verifyUser = async (req, res) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.params;

    if (!(await checkAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await pool.query(
      'UPDATE users SET is_verified = TRUE, verified_at = CURRENT_TIMESTAMP WHERE id = $1',
      [targetUserId]
    );

    // Notify user
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [targetUserId, 'user_verified', 'Account Verified', 'Your account has been verified by Tradebaba.ng']
    );

    res.json({ message: 'User verified successfully' });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ error: 'Failed to verify user' });
  }
};

// Ban user
exports.banUser = async (req, res) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.params;
    const { reason } = req.body;

    if (!(await checkAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await pool.query(
      'UPDATE users SET is_banned = TRUE WHERE id = $1',
      [targetUserId]
    );

    // Notify user
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [targetUserId, 'account_banned', 'Account Banned', `Your account has been banned. Reason: ${reason}`]
    );

    res.json({ message: 'User banned successfully' });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
};

// Get admin dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.userId;

    if (!(await checkAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM listings WHERE status = 'active') as active_listings,
        (SELECT COUNT(*) FROM orders WHERE status = 'completed') as completed_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending' OR status = 'paid') as pending_orders,
        (SELECT COUNT(*) FROM disputes WHERE status = 'open' OR status = 'under_review') as open_disputes,
        (SELECT SUM(amount) FROM orders WHERE status = 'completed') as total_gmv`
    );

    res.json({ stats: stats.rows[0] });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// Get user list (for moderation)
exports.getUsers = async (req, res) => {
  try {
    const userId = req.userId;
    const { search, limit = 50, offset = 0 } = req.query;

    if (!(await checkAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let query = 'SELECT id, email, phone, first_name, last_name, is_verified, is_banned, rating, total_sales FROM users';
    let params = [];

    if (search) {
      query += ' WHERE email ILIKE $1 OR phone ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1';
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Remove listing
exports.removeListing = async (req, res) => {
  try {
    const userId = req.userId;
    const { listingId } = req.params;
    const { reason } = req.body;

    if (!(await checkAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const listingResult = await pool.query(
      'SELECT user_id FROM listings WHERE id = $1',
      [listingId]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Update listing status
    await pool.query(
      'UPDATE listings SET status = $1 WHERE id = $2',
      ['removed', listingId]
    );

    // Notify user
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, $2, $3, $4)`,
      [listingResult.rows[0].user_id, 'listing_removed', 'Listing Removed', `Your listing has been removed. Reason: ${reason}`]
    );

    res.json({ message: 'Listing removed successfully' });
  } catch (error) {
    console.error('Remove listing error:', error);
    res.status(500).json({ error: 'Failed to remove listing' });
  }
};
