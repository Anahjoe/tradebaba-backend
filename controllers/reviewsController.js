const pool = require('../config/database');

// Create review
exports.createReview = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId, rating, comment, isBuyerReview } = req.body;

    if (!orderId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid rating or missing fields' });
    }

    // Verify order belongs to reviewer
    const orderResult = await pool.query(
      `SELECT buyer_id, seller_id, status FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Check if order is completed
    if (order.status !== 'completed' && order.status !== 'delivered') {
      return res.status(400).json({ error: 'Can only review completed orders' });
    }

    // Determine reviewed user
    let reviewedUserId;
    if (isBuyerReview) {
      // Buyer reviewing seller
      if (order.buyer_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      reviewedUserId = order.seller_id;
    } else {
      // Seller reviewing buyer
      if (order.seller_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      reviewedUserId = order.buyer_id;
    }

    // Check if review already exists
    const existingReview = await pool.query(
      `SELECT id FROM reviews WHERE order_id = $1 AND reviewer_id = $2`,
      [orderId, userId]
    );

    if (existingReview.rows.length > 0) {
      return res.status(400).json({ error: 'Review already exists for this order' });
    }

    // Create review
    const result = await pool.query(
      `INSERT INTO reviews (order_id, reviewer_id, reviewed_user_id, rating, comment, is_buyer_review)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orderId, userId, reviewedUserId, rating, comment, isBuyerReview]
    );

    // Update user rating
    const ratingResult = await pool.query(
      `SELECT AVG(rating)::NUMERIC(3,2) as avg_rating, COUNT(*) as count
       FROM reviews WHERE reviewed_user_id = $1`,
      [reviewedUserId]
    );

    const avgRating = ratingResult.rows[0].avg_rating;
    const reviewCount = ratingResult.rows[0].count;

    await pool.query(
      `UPDATE users SET rating = $1, review_count = $2 WHERE id = $3`,
      [avgRating, reviewCount, reviewedUserId]
    );

    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_order_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        reviewedUserId,
        'review_posted',
        isBuyerReview ? 'New Seller Review' : 'New Buyer Review',
        `You received a ${rating}-star review`,
        orderId,
      ]
    );

    res.status(201).json({
      message: 'Review created successfully',
      review: result.rows[0],
      userRating: avgRating,
      reviewCount,
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
};

// Get reviews for user
exports.getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT r.*, u.first_name, u.last_name, u.avatar_url
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewed_user_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    // Get user rating stats
    const statsResult = await pool.query(
      `SELECT 
        AVG(rating)::NUMERIC(3,2) as avg_rating,
        COUNT(*) as total_reviews,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
       FROM reviews WHERE reviewed_user_id = $1`,
      [userId]
    );

    res.json({
      reviews: result.rows,
      stats: statsResult.rows[0],
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

// Get order review
exports.getOrderReview = async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await pool.query(
      `SELECT * FROM reviews WHERE order_id = $1`,
      [orderId]
    );

    res.json({ reviews: result.rows });
  } catch (error) {
    console.error('Get order review error:', error);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
};

// Delete review (only by reviewer)
exports.deleteReview = async (req, res) => {
  try {
    const userId = req.userId;
    const { reviewId } = req.params;

    // Check ownership
    const checkResult = await pool.query(
      'SELECT reviewer_id, reviewed_user_id FROM reviews WHERE id = $1',
      [reviewId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (checkResult.rows[0].reviewer_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete review
    await pool.query('DELETE FROM reviews WHERE id = $1', [reviewId]);

    // Recalculate user rating
    const reviewedUserId = checkResult.rows[0].reviewed_user_id;
    const ratingResult = await pool.query(
      `SELECT AVG(rating)::NUMERIC(3,2) as avg_rating, COUNT(*) as count
       FROM reviews WHERE reviewed_user_id = $1`,
      [reviewedUserId]
    );

    const avgRating = ratingResult.rows[0].avg_rating || 0;
    const reviewCount = parseInt(ratingResult.rows[0].count) || 0;

    await pool.query(
      `UPDATE users SET rating = $1, review_count = $2 WHERE id = $3`,
      [avgRating, reviewCount, reviewedUserId]
    );

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
};
