const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const pool = require('../config/database');
const { generateToken } = require('../utils/jwt');

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// User Registration
exports.register = async (req, res) => {
  try {
    const { email, phone, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !phone || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email or phone already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = jwt.sign(
      { email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create user
    const result = await pool.query(
      `INSERT INTO users 
       (email, phone, password_hash, first_name, last_name, verification_token) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, phone, first_name, last_name`,
      [email, phone, passwordHash, firstName, lastName, verificationToken]
    );

    const user = result.rows[0];

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await transporter.sendMail({
      to: email,
      subject: 'Verify your Tradebaba.ng account',
      html: `
        <h2>Welcome to Tradebaba.ng!</h2>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link expires in 24 hours.</p>
      `,
    });

    res.status(201).json({
      message: 'User registered successfully. Check your email to verify.',
      user,
      requiresEmailVerification: true,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Email Verification
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Update user
    const result = await pool.query(
      `UPDATE users 
       SET is_email_verified = TRUE, email_verified_at = CURRENT_TIMESTAMP, verification_token = NULL 
       WHERE email = $1 
       RETURNING id, email, phone, first_name, last_name`,
      [decoded.email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const authToken = generateToken(user.id);

    res.json({
      message: 'Email verified successfully',
      user,
      token: authToken,
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(400).json({ error: 'Invalid or expired verification token' });
  }
};

// Phone Verification
exports.sendPhoneVerificationCode = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Generate 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save code (in production, use Twilio/Termii for SMS)
    await pool.query(
      'UPDATE users SET phone_verification_code = $1 WHERE phone = $2',
      [verificationCode, phone]
    );

    // TODO: Send SMS via Termii or Twilio
    console.log(`Verification code for ${phone}: ${verificationCode}`);

    res.json({
      message: 'Verification code sent to phone',
      // In production, don't return the code
      ...(process.env.NODE_ENV === 'development' && { code: verificationCode }),
    });
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
};

// Verify Phone Code
exports.verifyPhoneCode = async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }

    // Check code
    const result = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND phone_verification_code = $2',
      [phone, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const userId = result.rows[0].id;

    // Update user
    await pool.query(
      `UPDATE users 
       SET is_phone_verified = TRUE, phone_verified_at = CURRENT_TIMESTAMP, phone_verification_code = NULL 
       WHERE id = $1`,
      [userId]
    );

    res.json({ message: 'Phone verified successfully' });
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({ error: 'Phone verification failed' });
  }
};

// User Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if banned
    if (user.is_banned) {
      return res.status(403).json({ error: 'This account has been banned' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate token
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        isVerified: user.is_verified,
        rating: user.rating,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const newToken = generateToken(decoded.userId);

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Password Reset Request
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      to: email,
      subject: 'Reset your Tradebaba.ng password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link expires in 1 hour.</p>
      `,
    });

    res.json({ message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to send reset link' });
  }
};

// Password Reset
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [
      passwordHash,
      decoded.email,
    ]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(400).json({ error: 'Invalid or expired reset token' });
  }
};
