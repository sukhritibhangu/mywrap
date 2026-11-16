const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  verifyPayment,
  reportPaymentOutcome,
  reconcilePayment,
  confirmCounterPayment,
} = require('../controllers/paymentController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { createCashfreeSession, reconcileCashfree } = require('../controllers/cashfreeController');
const { getUpiInstructions, submitUpiReference, getPendingUpiPayments, reviewUpiPayment } = require('../controllers/manualPaymentController');

router.post('/create', protect, createRazorpayOrder);
router.post('/verify', protect, verifyPayment);
router.post('/outcome', protect, reportPaymentOutcome);
router.post('/reconcile', protect, reconcilePayment);
router.post('/counter-confirm', protect, adminOnly, confirmCounterPayment);
router.post('/cashfree/create', protect, createCashfreeSession);
router.post('/cashfree/reconcile', protect, reconcileCashfree);
router.get('/upi/:orderId/instructions', protect, getUpiInstructions);
router.post('/upi/submit', protect, submitUpiReference);
router.get('/upi/pending', protect, adminOnly, getPendingUpiPayments);
router.post('/upi/:id/review', protect, adminOnly, reviewUpiPayment);

module.exports = router;
