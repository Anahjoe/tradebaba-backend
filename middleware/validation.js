const jwt = require('jsonwebtoken');

// Authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Validate email format
const validateEmail = (req, res, next) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(req.body.email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  next();
};

// Validate phone number
const validatePhone = (req, res, next) => {
  const phoneRegex = /^(\+234|0)[0-9]{10}$/; // Nigerian format
  if (!phoneRegex.test(req.body.phone)) {
    return res.status(400).json({ error: 'Invalid Nigerian phone number' });
  }
  next();
};

// Validate password strength
const validatePassword = (req, res, next) => {
  const password = req.body.password;
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain uppercase letter' });
  }
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain number' });
  }
  next();
};

module.exports = {
  authenticateToken,
  validateEmail,
  validatePhone,
  validatePassword,
};
