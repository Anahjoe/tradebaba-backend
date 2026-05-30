const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:FlXPkYRVSTDqXkNutJHKYNFAJfBoRoej@zephyr.proxy.rlwy.net:58221/railway'
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'tradebaba_secret_2024';

// Middleware: Verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ==================== AUTH ENDPOINTS ====================

// SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    // Validate inputs
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, email, password, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, email, full_name',
      [username, email, hashedPassword, full_name]
    );

    const user = result.rows[0];

    // Create token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '30d'
    });

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '30d'
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== LISTINGS ENDPOINTS ====================

// GET ALL LISTINGS
app.get('/api/listings', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u.username, u.rating 
       FROM listings l 
       JOIN users u ON l.user_id = u.id 
       ORDER BY l.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET SINGLE LISTING
app.get('/api/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT l.*, u.username, u.rating 
       FROM listings l 
       JOIN users u ON l.user_id = u.id 
       WHERE l.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE LISTING
app.post('/api/listings', verifyToken, async (req, res) => {
  try {
    const { title, description, price, category, condition, location, images } = req.body;
    const user_id = req.user.id;

    if (!title || !price || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO listings (user_id, title, description, price, category, condition, location, images) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [user_id, title, description, price, category, condition || 'good', location, images || []]
    );

    res.status(201).json({
      message: 'Listing created successfully',
      listing: result.rows[0]
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE LISTING
app.put('/api/listings/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, category, condition, location } = req.body;
    const user_id = req.user.id;

    // Check if user owns listing
    const listing = await pool.query(
      'SELECT * FROM listings WHERE id = $1',
      [id]
    );

    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.rows[0].user_id !== user_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `UPDATE listings 
       SET title = $1, description = $2, price = $3, category = $4, condition = $5, location = $6, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7 
       RETURNING *`,
      [title, description, price, category, condition, location, id]
    );

    res.json({
      message: 'Listing updated successfully',
      listing: result.rows[0]
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE LISTING
app.delete('/api/listings/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Check if user owns listing
    const listing = await pool.query(
      'SELECT * FROM listings WHERE id = $1',
      [id]
    );

    if (listing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.rows[0].user_id !== user_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query('DELETE FROM listings WHERE id = $1', [id]);

    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== MESSAGES ENDPOINTS ====================

// GET MESSAGES
app.get('/api/messages', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT m.*, sender.username as sender_name, receiver.username as receiver_name 
       FROM messages m 
       JOIN users sender ON m.sender_id = sender.id 
       JOIN users receiver ON m.receiver_id = receiver.id 
       WHERE m.sender_id = $1 OR m.receiver_id = $1 
       ORDER BY m.created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// SEND MESSAGE
app.post('/api/messages', verifyToken, async (req, res) => {
  try {
    const { receiver_id, message_text, listing_id } = req.body;
    const sender_id = req.user.id;

    if (!receiver_id || !message_text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, listing_id, message_text) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [sender_id, receiver_id, listing_id || null, message_text]
    );

    res.status(201).json({
      message: 'Message sent successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ORDERS ENDPOINTS ====================

// CREATE ORDER
app.post('/api/orders', verifyToken, async (req, res) => {
  try {
    const { seller_id, listing_id, amount } = req.body;
    const buyer_id = req.user.id;

    if (!seller_id || !listing_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO orders (buyer_id, seller_id, listing_id, amount) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [buyer_id, seller_id, listing_id, amount]
    );

    res.status(201).json({
      message: 'Order created successfully',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET ORDERS
app.get('/api/orders', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT o.*, l.title as listing_title, buyer.username as buyer_name, seller.username as seller_name 
       FROM orders o 
       JOIN listings l ON o.listing_id = l.id 
       JOIN users buyer ON o.buyer_id = buyer.id 
       JOIN users seller ON o.seller_id = seller.id 
       WHERE o.buyer_id = $1 OR o.seller_id = $1 
       ORDER BY o.created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE ORDER STATUS
app.put('/api/orders/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      message: 'Order updated successfully',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== REVIEWS ENDPOINTS ====================

// CREATE REVIEW
app.post('/api/reviews', verifyToken, async (req, res) => {
  try {
    const { reviewed_user_id, order_id, rating, comment } = req.body;
    const reviewer_id = req.user.id;

    if (!reviewed_user_id || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO reviews (reviewer_id, reviewed_user_id, order_id, rating, comment) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [reviewer_id, reviewed_user_id, order_id || null, rating, comment || '']
    );

    res.status(201).json({
      message: 'Review created successfully',
      review: result.rows[0]
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET REVIEWS FOR USER
app.get('/api/reviews/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT r.*, reviewer.username 
       FROM reviews r 
       JOIN users reviewer ON r.reviewer_id = reviewer.id 
       WHERE r.reviewed_user_id = $1 
       ORDER BY r.created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== FAVORITES ENDPOINTS ====================

// ADD TO FAVORITES
app.post('/api/favorites', verifyToken, async (req, res) => {
  try {
    const { listing_id } = req.body;
    const user_id = req.user.id;

    if (!listing_id) {
      return res.status(400).json({ error: 'Listing ID required' });
    }

    const result = await pool.query(
      `INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2) RETURNING *`,
      [user_id, listing_id]
    );

    res.status(201).json({
      message: 'Added to favorites',
      favorite: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Already in favorites' });
    }
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// REMOVE FROM FAVORITES
app.delete('/api/favorites/:listing_id', verifyToken, async (req, res) => {
  try {
    const { listing_id } = req.params;
    const user_id = req.user.id;

    await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2',
      [user_id, listing_id]
    );

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== USER ENDPOINTS ====================

// GET USER PROFILE
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, username, email, full_name, rating, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET CURRENT USER
app.get('/api/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, rating, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running!', timestamp: new Date() });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Tradebaba.ng Backend Running on port ${PORT}`);
  console.log(`📍 API: https://tradebaba-backend-production-9c05.up.railway.app`);
  console.log(`🗄️  Database: Connected to Railway PostgreSQL`);
});
