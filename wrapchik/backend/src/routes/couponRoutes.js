const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { validateCoupon, getCoupons, getAvailableCoupons, createCoupon, updateCoupon } = require('../controllers/couponController');

router.get('/available', getAvailableCoupons);
router.post('/validate', protect, validateCoupon);
router.get('/', protect, adminOnly, getCoupons);
router.post('/', protect, adminOnly, createCoupon);
router.put('/:id', protect, adminOnly, updateCoupon);

module.exports = router;
