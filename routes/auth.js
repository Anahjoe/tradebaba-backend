const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateEmail, validatePhone } = require('../middleware/validation');

// Public routes
router.post('/register', validateEmail, validatePhone, authController.register);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/send-phone-verification', validatePhone, authController.sendPhoneVerificationCode);
router.post('/verify-phone', authController.verifyPhoneCode);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
