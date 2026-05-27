const pool = require('../config/database');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcrypt');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT id, email, phone, first_name, last_name, avatar_url, bio, 
              is_verified, rating, review_count, total_sales, total_purchases, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { firstName, lastName, bio, avatarUrl } = req.body;

    let avatar = avatarUrl;

    // Upload avatar if provided as base64
    if (avatarUrl && avatarUrl.startsWith('data:')) {
      try {
        const result = await cloudinary.uploader.upload(avatarUrl, {
          folder: 'tradebaba/avatars',
          width: 200,
          height: 200,
          crop: 'fill',
        });
        avatar = result.secure_url;
      } catch (error) {
        console.error('Avatar upload error:', error);
      }
    }

    const updateResult = await pool.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           bio = COALESCE($3, bio),
           avatar_url = COALESCE($4, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, email, phone, first_name, last_name, avatar_url, bio, is_verified, rating, review_count`,
      [firstName, lastName, bio, avatar, userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT id, email, phone, first_name, last_name, avatar_url, bio, 
              is_verified, rating, review_count, total_sales, total_purchases, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    // Get user password
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

// Get user notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    await pool.query(
      'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

// Search users
exports.searchUsers = async (req, res) => {
  try {
    const { search, limit = 10 } = req.query;

    if (!search || search.length < 2) {
      return res.status(400).json({ error: 'Search term must be at least 2 characters' });
    }

    const result = await pool.query(
      `SELECT id, first_name, last_name, avatar_url, rating, review_count, is_verified
       FROM users 
       WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)
       AND is_banned = FALSE
       LIMIT $2`,
      [`%${search}%`, parseInt(limit)]
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM listings WHERE user_id = $1 AND status = 'active') as active_listings,
        (SELECT COUNT(*) FROM orders WHERE seller_id = $1 AND status = 'completed') as completed_sales,
        (SELECT COUNT(*) FROM orders WHERE buyer_id = $1 AND status = 'completed') as completed_purchases,
        (SELECT AVG(rating)::NUMERIC(3,2) FROM reviews WHERE reviewed_user_id = $1) as avg_rating,
        (SELECT COUNT(*) FROM reviews WHERE reviewed_user_id = $1) as total_reviews`,
      [userId]
    );

    res.json({ stats: result.rows[0] });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
};
