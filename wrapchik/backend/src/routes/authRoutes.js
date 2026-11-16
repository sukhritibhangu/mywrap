const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const crypto = require('crypto');

const router = express.Router();

const {
  registerUser,
  loginUser,
  sendOtp,
  verifyOtp,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  getMe,
  updateProfile,
} = require('../controllers/authController');

const {
  getFavourites,
  addFavourite,
  removeFavourite,
} = require('../controllers/favouritesController');

const { protect } = require('../middleware/authMiddleware');

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.warn('[Auth OTP] Rate limit exceeded', { scope: 'ip', action: 'send' });
    res.status(options.statusCode).json(options.message);
  },
  message: { success: false, message: 'Too many OTP requests. Try again in 15 minutes.' },
});
const otpAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => crypto.createHash('sha256')
    .update(String(req.body?.email || '').trim().toLowerCase() || 'missing-email')
    .digest('hex'),
  handler: (req, res, next, options) => {
    console.warn('[Auth OTP] Rate limit exceeded', { scope: 'email', action: 'send' });
    res.status(options.statusCode).json(options.message);
  },
  message: { success: false, message: 'Too many code requests for this email. Try again later.' },
});
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.warn('[Auth OTP] Rate limit exceeded', { scope: 'ip', action: 'verify' });
    res.status(options.statusCode).json(options.message);
  },
  message: { success: false, message: 'Too many OTP attempts. Try again in 15 minutes.' },
});
const passwordLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const accountKey = crypto.createHash('sha256').update(email).digest('hex');
    return `${ipKeyGenerator(req.ip)}:${accountKey}`;
  },
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

router.post('/register', otpSendLimiter, otpAccountLimiter, registerUser);
router.post('/login', passwordLoginLimiter, loginUser);

router.post('/otp/send', otpSendLimiter, otpAccountLimiter, sendOtp);
router.post('/otp/verify', otpVerifyLimiter, verifyOtp);
router.post('/password/reset/otp/send', otpSendLimiter, otpAccountLimiter, sendPasswordResetOtp);
router.post('/password/reset/otp/verify', otpVerifyLimiter, resetPasswordWithOtp);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

router.get('/favourites', protect, getFavourites);
router.post('/favourites/:productId', protect, addFavourite);
router.delete('/favourites/:productId', protect, removeFavourite);

module.exports = router;
