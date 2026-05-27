const pool = require('../config/database');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create listing
exports.createListing = async (req, res) => {
  try {
    const userId = req.userId;
    const { title, description, categoryId, price, condition, location, latitude, longitude } = req.body;
    const images = req.body.images || []; // Array of base64 images

    if (!title || !description || !categoryId || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Upload images to Cloudinary
    const imageUrls = [];
    for (const image of images) {
      try {
        const result = await cloudinary.uploader.upload(image, {
          folder: 'tradebaba/listings',
        });
        imageUrls.push(result.secure_url);
      } catch (error) {
        console.error('Image upload error:', error);
      }
    }

    // Create listing
    const result = await pool.query(
      `INSERT INTO listings 
       (user_id, title, description, category_id, price, condition, images, location, latitude, longitude) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [userId, title, description, categoryId, price, condition, JSON.stringify(imageUrls), location, latitude, longitude]
    );

    const listing = result.rows[0];

    res.status(201).json({
      message: 'Listing created successfully',
      listing: {
        ...listing,
        images: JSON.parse(listing.images),
      },
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
};

// Get all listings
exports.getListings = async (req, res) => {
  try {
    const { categoryId, search, sortBy = 'newest', limit = 20, offset = 0 } = req.query;
    let query = 'SELECT * FROM listings WHERE status = $1';
    let params = ['active'];
    let paramIndex = 2;

    // Filter by category
    if (categoryId) {
      query += ` AND category_id = $${paramIndex}`;
      params.push(categoryId);
      paramIndex++;
    }

    // Search by title or description
    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Sort
    if (sortBy === 'price_low') {
      query += ' ORDER BY price ASC';
    } else if (sortBy === 'price_high') {
      query += ' ORDER BY price DESC';
    } else if (sortBy === 'oldest') {
      query += ' ORDER BY created_at ASC';
    } else {
      query += ' ORDER BY created_at DESC';
    }

    // Pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    const listings = result.rows.map(l => ({
      ...l,
      images: JSON.parse(l.images || '[]'),
    }));

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM listings WHERE status = $1';
    let countParams = ['active'];
    if (categoryId) {
      countQuery += ` AND category_id = $2`;
      countParams.push(categoryId);
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      listings,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

// Get single listing
exports.getListing = async (req, res) => {
  try {
    const { id } = req.params;

    // Get listing
    const result = await pool.query(
      'SELECT * FROM listings WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = result.rows[0];

    // Increment views
    await pool.query('UPDATE listings SET views = views + 1 WHERE id = $1', [id]);

    // Get seller info
    const sellerResult = await pool.query(
      'SELECT id, first_name, last_name, avatar_url, rating, review_count, total_sales FROM users WHERE id = $1',
      [listing.user_id]
    );

    res.json({
      listing: {
        ...listing,
        images: JSON.parse(listing.images || '[]'),
        seller: sellerResult.rows[0],
      },
    });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
};

// Update listing
exports.updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { title, description, categoryId, price, condition, status } = req.body;

    // Check ownership
    const checkResult = await pool.query('SELECT user_id FROM listings WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update listing
    const result = await pool.query(
      `UPDATE listings 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           category_id = COALESCE($3, category_id),
           price = COALESCE($4, price),
           condition = COALESCE($5, condition),
           status = COALESCE($6, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [title, description, categoryId, price, condition, status, id]
    );

    res.json({
      message: 'Listing updated successfully',
      listing: {
        ...result.rows[0],
        images: JSON.parse(result.rows[0].images || '[]'),
      },
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
};

// Delete listing
exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check ownership
    const checkResult = await pool.query('SELECT user_id FROM listings WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete listing
    await pool.query('DELETE FROM listings WHERE id = $1', [id]);

    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
};

// Get user listings
exports.getUserListings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      'SELECT * FROM listings WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, parseInt(limit), parseInt(offset)]
    );

    const listings = result.rows.map(l => ({
      ...l,
      images: JSON.parse(l.images || '[]'),
    }));

    res.json({ listings });
  } catch (error) {
    console.error('Get user listings error:', error);
    res.status(500).json({ error: 'Failed to fetch user listings' });
  }
};

// Get categories
exports.getCategories = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};
