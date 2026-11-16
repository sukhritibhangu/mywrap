const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const socketManager = require('../config/socketManager');

const signaturesMatch = (expected, received) => {
  if (typeof received !== 'string' || !/^[a-f\d]{64}$/i.test(received)) return false;
  const expectedBytes = Buffer.from(expected, 'hex');
  const receivedBytes = Buffer.from(received, 'hex');
  return expectedBytes.length === receivedBytes.length && crypto.timingSafeEqual(expectedBytes, receivedBytes);
};

const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
if (!razorpayConfigured) console.warn('[Payment] Razorpay credentials are not configured');

const razorpay = razorpayConfigured
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

const isObjectId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
const stableReceiptForOrder = (orderId) => `wrap_${String(orderId)}`;
const isValidWebhookEventId = (eventId) => typeof eventId === 'string' && /^[A-Za-z0-9_\-:.]{1,128}$/.test(eventId);
const isTerminalOrder = (order) => ['CANCELLED', 'REJECTED', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'].includes(order.orderStatus);

const updateOrderPaymentStatus = async (order, paymentStatus, paymentId) => {
  if (order.paymentStatus === paymentStatus && (!paymentId || String(order.paymentId) === String(paymentId))) {
    if (paymentStatus === 'SUCCESS') await require('../utils/couponPricing').markCouponRedeemed(order);
    return false;
  }
  const filter = paymentStatus === 'SUCCESS'
    ? { _id: order._id, paymentStatus: { $ne: 'SUCCESS' } }
    : { _id: order._id, paymentStatus: 'PENDING' };
  const updatedOrder = await Order.findOneAndUpdate(filter, {
    $set: { paymentStatus, ...(paymentId ? { paymentId } : {}) },
  }, { new: true });
  if (!updatedOrder) {
    const currentOrder = await Order.findById(order._id);
    if (currentOrder?.paymentStatus === 'SUCCESS' && paymentStatus === 'SUCCESS') {
      await require('../utils/couponPricing').markCouponRedeemed(currentOrder);
    }
    return false;
  }
  order = updatedOrder;
  if (paymentStatus === 'SUCCESS') await require('../utils/couponPricing').markCouponRedeemed(order);
  socketManager.emitOrderUpdate(order);

  const { createNotification, notifyAdmins } = require('./notificationController');
  const userId = order.userId?._id || order.userId;
  const isOnlinePayment = ['RAZORPAY', 'CASHFREE', 'UPI_QR'].includes(order.paymentMethod);
  const gatewayName = order.paymentMethod === 'UPI_QR' ? 'UPI' : order.paymentMethod === 'CASHFREE' ? 'Cashfree' : 'Razorpay';
  const paymentArrivedAfterClosure = isTerminalOrder(order);
  const messages = {
    SUCCESS: isOnlinePayment
      ? paymentArrivedAfterClosure
        ? ['Payment confirmed after order closure', `${gatewayName} payment was confirmed after this order was closed. Contact the outlet to resolve it.`, 'A payment was captured for a closed order. Manual reconciliation is required; do not reopen kitchen fulfillment.']
        : ['Payment confirmed', `${gatewayName} payment was confirmed by the outlet. Your order is waiting for the outlet.`, 'A new paid order is ready for the kitchen queue.']
      : ['Counter payment confirmed', 'The outlet confirmed receipt of your counter payment.', null],
    FAILED: ['Payment claim rejected', `${gatewayName} payment claim was rejected by the outlet. Check the reason in your order and contact the outlet if needed.`, 'An online payment claim was rejected. The order remains unpaid and locked out of kitchen acceptance.'],
    CANCELLED: ['Payment cancelled', 'This payment attempt was cancelled. Check your order for the latest payment status.', null],
    PENDING: ['Payment pending', `Your payment is awaiting confirmation from ${gatewayName}.`, null],
  };
  const [title, customerMessage, adminMessage] = messages[paymentStatus] || [];
  if (title && paymentStatus !== 'PENDING') {
    await createNotification(userId, `Order #${order.orderNumber}: ${title}`, customerMessage, 'ORDER_UPDATE', order._id, `order:${order._id}:payment:${paymentId || 'unknown'}:${paymentStatus}`);
  }
  if (paymentStatus === 'SUCCESS' && isOnlinePayment && order.orderStatus === 'PLACED') {
    socketManager.emitNewOrder(order);
  }
  if (adminMessage && isOnlinePayment) {
    const eventKey = paymentStatus === 'SUCCESS'
      ? `order:${order._id}:${paymentArrivedAfterClosure ? 'late-payment' : 'paid-online'}`
      : `order:${order._id}:payment:${paymentId}:${paymentStatus}:admin`;
    const title = paymentStatus !== 'SUCCESS'
      ? `Payment issue for order #${order.orderNumber}`
      : paymentArrivedAfterClosure ? `Manual payment review for order #${order.orderNumber}` : `Paid online order #${order.orderNumber}`;
    await notifyAdmins(title, adminMessage, 'ORDER_UPDATE', order._id, eventKey);
  }
  return true;
};

const createRazorpayOrder = async (req, res, next) => {
  try {
    const orderId = req.body?.orderId;
    if (!isObjectId(orderId)) return res.status(400).json({ success: false, message: 'A valid order ID is required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.userId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    if (order.paymentMethod !== 'RAZORPAY') return res.status(400).json({ success: false, message: 'This order is set to pay at the counter.' });
    if (isTerminalOrder(order)) return res.status(409).json({ success: false, message: 'This order is no longer available for payment.' });
    if (order.paymentStatus === 'SUCCESS') return res.status(409).json({ success: false, message: 'Order is already paid' });
    if (!razorpay) return res.status(503).json({ success: false, message: 'Online payment is not configured' });

    const amountPaise = Math.round(Number(order.totalAmount) * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) return res.status(400).json({ success: false, message: 'Order amount is invalid for payment' });
    const receipt = stableReceiptForOrder(order._id);
    const lockToken = crypto.randomUUID();
    const now = new Date();
    const claimedOrder = await Order.findOneAndUpdate({
      _id: order._id,
      userId: req.user._id,
      paymentMethod: 'RAZORPAY',
      paymentStatus: { $ne: 'SUCCESS' },
      orderStatus: { $nin: ['CANCELLED', 'REJECTED', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'] },
      $or: [
        { paymentCreateLockUntil: { $exists: false } },
        { paymentCreateLockUntil: null },
        { paymentCreateLockUntil: { $lte: now } },
      ],
    }, {
      $set: { paymentCreateLockToken: lockToken, paymentCreateLockUntil: new Date(now.getTime() + 120_000) },
    }, { new: true });

    const serializeSession = (payment) => ({
      success: true,
      razorpayOrder: {
        id: payment.gatewayOrderId,
        amount: amountPaise,
        currency: payment.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
      orderId: order._id,
    });

    if (!claimedOrder) {
      const existingPayment = await Payment.findOne({ orderId: order._id, status: 'PENDING' }).sort({ createdAt: -1 });
      if (existingPayment && Math.round(Number(existingPayment.amount) * 100) === amountPaise && existingPayment.currency === 'INR') {
        return res.json(serializeSession(existingPayment));
      }
      return res.status(409).json({ success: false, message: 'A payment session is already being prepared. Refresh the order and try again shortly.' });
    }

    try {
      let payment = await Payment.findOne({ orderId: order._id }).sort({ createdAt: -1 });
      if (payment && (Math.round(Number(payment.amount) * 100) !== amountPaise || payment.currency !== 'INR')) {
        return res.status(409).json({ success: false, message: 'The saved payment amount does not match this order. Contact support before retrying.' });
      }

      let gatewayOrder;
      if (payment) {
        try {
          gatewayOrder = await razorpay.orders.fetch(payment.gatewayOrderId);
        } catch (error) {
          return res.status(503).json({ success: false, message: 'The saved Razorpay session could not be checked. Try again shortly.' });
        }
      } else {
        // Razorpay receipts are unique. Querying by this stable receipt recovers an order
        // created remotely if the process lost the response before persisting its ID.
        const findProviderOrder = async () => {
          const list = await razorpay.orders.all({ receipt, count: 100 });
          return list.items?.find((candidate) => candidate.receipt === receipt);
        };
        gatewayOrder = await findProviderOrder();
        if (!gatewayOrder) {
          try {
            gatewayOrder = await razorpay.orders.create({
              amount: amountPaise,
              currency: 'INR',
              receipt,
              notes: { orderId: String(order._id), userId: String(req.user._id) },
            });
          } catch (createError) {
            try { gatewayOrder = await findProviderOrder(); }
            catch (lookupError) { return next(createError); }
            if (!gatewayOrder) return next(createError);
          }
        }
      }

      if (gatewayOrder.receipt !== receipt
        || gatewayOrder.amount !== amountPaise
        || gatewayOrder.currency !== 'INR'
        || String(gatewayOrder.notes?.orderId || '') !== String(order._id)) {
        return res.status(502).json({ success: false, message: 'The payment provider returned an unexpected order, amount, or currency.' });
      }

      if (gatewayOrder.status === 'paid' || Number(gatewayOrder.amount_paid) >= amountPaise) {
        const paymentCollection = await razorpay.orders.fetchPayments(gatewayOrder.id);
        const captured = paymentCollection.items?.find((item) => item.status === 'captured');
        if (!captured || captured.order_id !== gatewayOrder.id || captured.amount !== amountPaise || captured.currency !== 'INR') {
          return res.status(503).json({ success: false, pending: true, message: 'Razorpay reports payment activity that is still being reconciled. Check this order again shortly.' });
        }
        payment = payment || await Payment.create({ orderId: order._id, userId: req.user._id, gatewayOrderId: gatewayOrder.id, amount: order.totalAmount, currency: 'INR' });
        payment.gatewayPaymentId = captured.id;
        payment.gatewayPaymentIds = [...new Set([...(payment.gatewayPaymentIds || []), captured.id])];
        payment.method = captured.method || 'Razorpay';
        payment.status = 'SUCCESS';
        await payment.save();
        const currentOrder = await Order.findById(order._id);
        if (currentOrder) await updateOrderPaymentStatus(currentOrder, 'SUCCESS', payment._id);
        return res.json({ success: true, paid: true, orderId: order._id });
      }

      if (payment) {
        if (payment.gatewayOrderId !== gatewayOrder.id) {
          return res.status(409).json({ success: false, message: 'This order is linked to a different payment session. Contact support before retrying.' });
        }
        if (payment.status !== 'PENDING') {
          if (payment.gatewayPaymentId) {
            payment.gatewayPaymentIds = [...new Set([...(payment.gatewayPaymentIds || []), payment.gatewayPaymentId])];
          }
          payment.gatewayPaymentId = null;
          payment.gatewaySignature = null;
          payment.status = 'PENDING';
          await payment.save();
        }
      } else {
        payment = await Payment.create({
          orderId: order._id,
          userId: req.user._id,
          gatewayOrderId: gatewayOrder.id,
          amount: order.totalAmount,
          currency: 'INR',
          status: 'PENDING',
        });
      }

      const linkedOrder = await Order.findOneAndUpdate({
        _id: order._id,
        paymentCreateLockToken: lockToken,
        paymentStatus: { $ne: 'SUCCESS' },
        orderStatus: { $nin: ['CANCELLED', 'REJECTED', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'] },
      }, { $set: { paymentId: payment._id, paymentStatus: 'PENDING' } }, { new: true });
      if (!linkedOrder) return res.status(409).json({ success: false, message: 'The order changed while payment was being prepared. Refresh its latest status.' });
      socketManager.emitOrderUpdate(linkedOrder);
      return res.json(serializeSession(payment));
    } finally {
      await Order.updateOne({ _id: order._id, paymentCreateLockToken: lockToken }, {
        $unset: { paymentCreateLockToken: 1, paymentCreateLockUntil: 1 },
      });
    }
  } catch (error) {
    return next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, razorpay_order_id: gatewayOrderId, razorpay_payment_id: gatewayPaymentId, razorpay_signature: gatewaySignature } = req.body || {};
    if (!isObjectId(orderId) || typeof gatewayOrderId !== 'string' || typeof gatewayPaymentId !== 'string' || !gatewaySignature) {
      return res.status(400).json({ success: false, message: 'Incomplete payment verification data' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.userId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    if (order.paymentMethod !== 'RAZORPAY') return res.status(400).json({ success: false, message: 'This order is not an online payment order.' });

    const payment = await Payment.findOne({ orderId: order._id, userId: req.user._id, gatewayOrderId });
    if (!payment) return res.status(400).json({ success: false, message: 'Payment session not found' });
    if (payment.status === 'SUCCESS' && order.paymentStatus === 'SUCCESS') {
      return res.json({ success: true, message: 'Payment already verified', orderNumber: order.orderNumber, order });
    }
    if (payment.gatewayPaymentId && payment.gatewayPaymentId !== gatewayPaymentId && !payment.gatewayPaymentIds?.includes(gatewayPaymentId)) {
      return res.status(409).json({ success: false, message: 'This payment attempt is already associated with another payment.' });
    }
    if (!process.env.RAZORPAY_KEY_SECRET || !razorpay) return res.status(503).json({ success: false, message: 'Online payment is not configured' });

    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${payment.gatewayOrderId}|${gatewayPaymentId}`)
      .digest('hex');
    if (!signaturesMatch(expectedSignature, gatewaySignature)) {
      // Invalid client data must not mutate a real payment attempt.
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    let gatewayPayment;
    try {
      gatewayPayment = await razorpay.payments.fetch(gatewayPaymentId);
    } catch (error) {
      console.error('[Payment Reconciliation Error]: provider lookup failed');
      return res.status(503).json({ success: false, pending: true, message: 'Payment could not be confirmed yet. Check order status before retrying.' });
    }

    const expectedAmount = Math.round(Number(payment.amount) * 100);
    if (gatewayPayment.order_id !== payment.gatewayOrderId || gatewayPayment.amount !== expectedAmount || gatewayPayment.currency !== payment.currency) {
      return res.status(400).json({ success: false, message: 'The payment details do not match this order.' });
    }

    if (payment.gatewayPaymentId && payment.gatewayPaymentId !== gatewayPaymentId) {
      return res.status(409).json({ success: false, message: 'This payment session is already associated with another payment.' });
    }
    payment.gatewayPaymentId = gatewayPaymentId;
    payment.gatewaySignature = gatewaySignature;

    if (gatewayPayment.status === 'failed') {
      const isOldAttempt = payment.gatewayPaymentIds?.includes(gatewayPaymentId) && payment.gatewayPaymentId !== gatewayPaymentId;
      if (isOldAttempt) return res.status(402).json({ success: false, paymentStatus: 'FAILED', message: 'This earlier payment attempt failed. Check the latest order payment status.' });
      const failedPayment = await Payment.findOneAndUpdate({
        _id: payment._id,
        status: { $ne: 'SUCCESS' },
        $or: [{ gatewayPaymentId: null }, { gatewayPaymentId: gatewayPaymentId }],
      }, {
        $set: { status: 'FAILED', gatewayPaymentId },
        $addToSet: { gatewayPaymentIds: gatewayPaymentId },
      }, { new: true });
      if (failedPayment) await updateOrderPaymentStatus(order, 'FAILED', payment._id);
      else if ((await Payment.findById(payment._id).select('status'))?.status === 'SUCCESS') {
        await updateOrderPaymentStatus(await Order.findById(order._id), 'SUCCESS', payment._id);
        return res.json({ success: true, message: 'Payment already verified', orderNumber: order.orderNumber, order });
      }
      return res.status(402).json({ success: false, paymentStatus: 'FAILED', message: 'Razorpay reported that this payment failed. You can retry payment.' });
    }

    if (gatewayPayment.status !== 'captured') {
      // Do not reopen a payment attempt after the customer/admin cancelled the order.
      const currentAttempt = payment.gatewayPaymentIds?.includes(gatewayPaymentId) && payment.gatewayPaymentId !== gatewayPaymentId;
      if (!currentAttempt) {
        await Payment.findOneAndUpdate({ _id: payment._id, status: { $ne: 'SUCCESS' } }, {
          $set: { status: isTerminalOrder(order) && payment.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING', gatewayPaymentId },
          $addToSet: { gatewayPaymentIds: gatewayPaymentId },
        });
      }
      return res.status(202).json({ success: false, pending: true, paymentStatus: 'PENDING', message: 'Payment is awaiting confirmation from Razorpay. Check the order status before trying again.' });
    }

    const capturedPayment = await Payment.findOneAndUpdate({ _id: payment._id, status: { $ne: 'SUCCESS' } }, {
      $set: { status: 'SUCCESS', gatewayPaymentId, gatewaySignature, method: gatewayPayment.method || 'Razorpay' },
      $addToSet: { gatewayPaymentIds: gatewayPaymentId },
    }, { new: true });
    if (!capturedPayment && (await Payment.findById(payment._id).select('status'))?.status !== 'SUCCESS') {
      return res.status(409).json({ success: false, message: 'Payment status changed while it was being verified. Refresh the order before retrying.' });
    }

    await updateOrderPaymentStatus(order, 'SUCCESS', payment._id);

    return res.json({ success: true, message: 'Payment verified successfully', orderNumber: order.orderNumber, order });
  } catch (error) {
    return next(error);
  }
};

const reportPaymentOutcome = async (req, res, next) => {
  try {
    const { orderId, razorpay_order_id: gatewayOrderId, razorpay_payment_id: gatewayPaymentId, outcome } = req.body || {};
    if (!isObjectId(orderId) || typeof gatewayOrderId !== 'string' || !['FAILED', 'CANCELLED'].includes(outcome)) {
      return res.status(400).json({ success: false, message: 'A valid payment failure or cancellation is required' });
    }
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (String(order.userId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Unauthorized' });

    const payment = await Payment.findOne({ orderId: order._id, userId: req.user._id, gatewayOrderId });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment session not found' });
    if (gatewayPaymentId && payment.gatewayPaymentId && payment.gatewayPaymentId !== gatewayPaymentId) {
      return res.status(409).json({ success: false, message: 'This payment session is already associated with another payment.' });
    }
    if (payment.status === 'SUCCESS' || order.paymentStatus === 'SUCCESS') {
      return res.json({ success: true, paymentStatus: 'SUCCESS', message: 'Razorpay has confirmed this payment.' });
    }

    if (outcome === 'CANCELLED') {
      // A checkout dismissal is only a client-side observation. Razorpay may
      // still capture the payment or deliver a delayed webhook, so leave the
      // attempt pending until the provider confirms its final state.
      return res.status(202).json({
        success: true,
        paymentStatus: 'PENDING',
        message: 'Checkout was closed. Payment remains pending until Razorpay confirms its status.',
      });
    }

    if (outcome === 'FAILED') {
      // A native checkout error is not proof of failure; reconcile it with Razorpay first.
      if (!gatewayPaymentId || !razorpay) {
        return res.status(202).json({ success: true, paymentStatus: 'PENDING', message: 'The payment attempt is awaiting confirmation from Razorpay.' });
      }
      let gatewayPayment;
      try {
        gatewayPayment = await razorpay.payments.fetch(gatewayPaymentId);
      } catch (error) {
        return res.status(202).json({ success: true, paymentStatus: 'PENDING', message: 'The payment attempt is awaiting confirmation from Razorpay.' });
      }
      if (gatewayPayment.order_id !== payment.gatewayOrderId || gatewayPayment.amount !== Math.round(Number(payment.amount) * 100) || gatewayPayment.currency !== payment.currency) {
        return res.status(400).json({ success: false, message: 'The payment details do not match this order.' });
      }
      if (gatewayPayment.status === 'captured') {
        const capturedPayment = await Payment.findOneAndUpdate(
          { _id: payment._id, $or: [{ gatewayPaymentId: null }, { gatewayPaymentId: gatewayPaymentId }] },
          { $set: { status: 'SUCCESS', gatewayPaymentId, method: gatewayPayment.method || 'Razorpay' } },
          { new: true }
        );
        if (capturedPayment) {
          await updateOrderPaymentStatus(order, 'SUCCESS', capturedPayment._id);
          return res.json({ success: true, paymentStatus: 'SUCCESS', message: 'Razorpay confirmed payment capture.' });
        }
      }
      if (gatewayPayment.status !== 'failed') {
        return res.status(202).json({ success: true, paymentStatus: 'PENDING', message: 'The payment attempt is awaiting confirmation from Razorpay.' });
      }
    }

    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $ne: 'SUCCESS' },
        $or: [{ gatewayPaymentId: null }, { gatewayPaymentId: gatewayPaymentId || null }],
      },
      { $set: { status: outcome, ...(gatewayPaymentId ? { gatewayPaymentId } : {}) } },
      { new: true }
    );
    const currentPayment = updatedPayment || await Payment.findById(payment._id);
    if (currentPayment?.status === 'SUCCESS') {
      return res.json({ success: true, paymentStatus: 'SUCCESS', message: 'Razorpay has confirmed this payment.' });
    }
    if (updatedPayment && order.paymentStatus !== 'SUCCESS' && !isTerminalOrder(order)) {
      await updateOrderPaymentStatus(order, outcome, updatedPayment._id);
    }

    return res.json({ success: true, paymentStatus: currentPayment?.status || outcome, message: 'Payment outcome recorded. The order remains unpaid unless Razorpay confirms capture.' });
  } catch (error) {
    return next(error);
  }
};

const confirmCounterPayment = async (req, res, next) => {
  try {
    const orderId = req.body?.orderId;
    if (!isObjectId(orderId)) return res.status(400).json({ success: false, message: 'A valid order ID is required' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if ((order.paymentMethod || 'COUNTER') !== 'COUNTER') return res.status(400).json({ success: false, message: 'This order is set to pay online and cannot be confirmed as cash.' });
    if (['CANCELLED', 'REJECTED'].includes(order.orderStatus)) return res.status(409).json({ success: false, message: 'Payment cannot be collected for a cancelled or rejected order.' });
    if (order.paymentStatus === 'SUCCESS') {
      await require('../utils/couponPricing').markCouponRedeemed(order);
      return res.json({ success: true, message: 'Counter payment was already confirmed', order });
    }

    let payment = await Payment.findOne({ orderId: order._id, method: 'CASH', status: 'SUCCESS' });
    if (!payment) {
      try {
        payment = await Payment.create({
          orderId: order._id,
          userId: order.userId,
          amount: order.totalAmount,
          currency: 'INR',
          status: 'SUCCESS',
          method: 'CASH',
          gateway: 'COUNTER',
          gatewayOrderId: `CASH_${order._id}`,
          verifiedBy: req.user._id,
          verifiedAt: new Date(),
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        payment = await Payment.findOne({ orderId: order._id, method: 'CASH', status: 'SUCCESS' });
        if (!payment) throw error;
      }
    }
    if (!payment.verifiedBy) payment.verifiedBy = req.user._id;
    if (!payment.verifiedAt) payment.verifiedAt = new Date();
    if (!payment.gateway) payment.gateway = 'COUNTER';
    await payment.save();
    await updateOrderPaymentStatus(order, 'SUCCESS', payment._id);
    return res.json({ success: true, message: 'Counter payment confirmed', order });
  } catch (error) {
    return next(error);
  }
};

const applyWebhookPayment = async (paymentEntity, paymentStatus, { authoritative = false } = {}) => {
  if (!paymentEntity?.order_id || !paymentEntity?.id) return { retry: false };
  const payment = await Payment.findOne({ gatewayOrderId: paymentEntity.order_id });
  if (!payment) return { retry: true };

  const amount = Number(paymentEntity.amount);
  if (amount !== Math.round(Number(payment.amount) * 100) || paymentEntity.currency !== payment.currency) {
    console.error('[Webhook] Payment amount or currency does not match the saved order.');
    return { retry: false };
  }
  if (payment.status === 'SUCCESS' && paymentStatus !== 'SUCCESS') return { retry: false };
  const isKnownOldAttempt = payment.gatewayPaymentIds?.includes(paymentEntity.id)
    && payment.gatewayPaymentId !== paymentEntity.id;
  if (paymentStatus !== 'SUCCESS' && isKnownOldAttempt && !authoritative) return { retry: false };
  if (paymentStatus !== 'SUCCESS' && payment.gatewayPaymentId && payment.gatewayPaymentId !== paymentEntity.id && !authoritative) return { retry: false };

  const paymentAlreadyApplied = payment.status === paymentStatus && payment.gatewayPaymentId === paymentEntity.id;
  if (!paymentAlreadyApplied) {
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: 'SUCCESS' }, ...(paymentStatus === 'SUCCESS' ? {} : { $or: [{ gatewayPaymentId: null }, { gatewayPaymentId: paymentEntity.id }] }) },
      { $set: { status: paymentStatus, gatewayPaymentId: paymentEntity.id, method: paymentEntity.method || 'Razorpay' }, $addToSet: { gatewayPaymentIds: paymentEntity.id } },
      { new: true }
    );
    if (!updatedPayment) {
      const currentPayment = await Payment.findById(payment._id).select('status');
      return { retry: false, alreadyFinal: currentPayment?.status === 'SUCCESS' };
    }
  }

  const order = await Order.findById(payment.orderId);
  if (!order) return { retry: true };
  await updateOrderPaymentStatus(order, paymentStatus, payment._id);
  return { retry: false };
};

const reconcilePayment = async (req, res, next) => {
  try {
    const orderId = req.body?.orderId;
    if (!isObjectId(orderId)) return res.status(400).json({ success: false, message: 'A valid order ID is required.' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (String(order.userId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Unauthorized' });
    if (order.paymentMethod !== 'RAZORPAY') return res.status(400).json({ success: false, message: 'This order does not use online payment.' });
    if (order.paymentStatus === 'SUCCESS') return res.json({ success: true, paymentStatus: 'SUCCESS' });
    if (!razorpay) return res.status(503).json({ success: false, paymentStatus: order.paymentStatus, message: 'Online payment is not configured.' });

    const payment = await Payment.findOne({ orderId: order._id, userId: req.user._id }).sort({ createdAt: -1 });
    if (!payment) return res.status(404).json({ success: false, message: 'No saved payment session is available to reconcile.' });

    const paymentCollection = await razorpay.orders.fetchPayments(payment.gatewayOrderId);
    const matchesOrder = (item) => item.order_id === payment.gatewayOrderId
      && item.amount === Math.round(Number(payment.amount) * 100)
      && item.currency === payment.currency;
    const captured = paymentCollection.items?.find((item) => item.status === 'captured' && matchesOrder(item));
    if (captured) {
      await applyWebhookPayment(captured, 'SUCCESS', { authoritative: true });
    } else {
      const latestFailed = paymentCollection.items
        ?.filter((item) => item.status === 'failed' && matchesOrder(item))
        .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))[0];
      const hasPendingAttempt = paymentCollection.items?.some((item) => ['created', 'authorized'].includes(item.status) && matchesOrder(item));
      if (latestFailed && !hasPendingAttempt) await applyWebhookPayment(latestFailed, 'FAILED', { authoritative: true });
    }

    const currentOrder = await Order.findById(order._id).select('paymentStatus orderStatus orderNumber');
    return res.json({
      success: true,
      paymentStatus: currentOrder?.paymentStatus || 'PENDING',
      orderStatus: currentOrder?.orderStatus,
      message: currentOrder?.paymentStatus === 'SUCCESS'
        ? 'Razorpay confirmed payment.'
        : 'Razorpay has not confirmed a captured payment yet.',
    });
  } catch (error) {
    return next(error);
  }
};

const handleWebhook = async (req, res) => {
  let ledgerEntry;
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) return res.status(503).send('Payment webhook is not configured');
    const signature = req.headers['x-razorpay-signature'];
    const eventId = req.headers['x-razorpay-event-id'];
    if (!signature) return res.status(400).send('Missing signature');
    if (!isValidWebhookEventId(eventId)) return res.status(400).send('Missing or invalid event ID');
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
    if (!signaturesMatch(expectedSignature, signature)) return res.status(400).send('Invalid signature');

    let event;
    try { event = JSON.parse(rawBody.toString('utf8')); }
    catch (error) { return res.status(400).send('Invalid webhook payload'); }
    if (!event || typeof event.event !== 'string' || event.event.length > 100) return res.status(400).send('Invalid webhook payload');

    const entity = event.payload?.payment?.entity;
    const gatewayOrderId = entity?.order_id || event.payload?.order?.entity?.id || null;
    const snapshot = entity ? {
      id: String(entity.id || ''),
      order_id: String(entity.order_id || ''),
      amount: Number(entity.amount),
      currency: String(entity.currency || ''),
      status: String(entity.status || ''),
      method: entity.method ? String(entity.method) : null,
      created_at: Number.isFinite(Number(entity.created_at)) ? Number(entity.created_at) : null,
    } : null;
    if (['payment.captured', 'payment.failed'].includes(event.event)
      && (!snapshot?.id || !snapshot.order_id || !Number.isSafeInteger(snapshot.amount) || !snapshot.currency)) {
      return res.status(400).send('Payment event is missing required payment details');
    }
    if (event.event === 'order.paid' && !gatewayOrderId) return res.status(400).send('Order event is missing the provider order ID');
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

    try {
      ledgerEntry = await WebhookEvent.findOneAndUpdate(
        { eventId },
        { $setOnInsert: {
          eventId,
          event: event.event,
          payloadHash,
          gatewayOrderId,
          payment: snapshot,
          status: 'RECEIVED',
          attempts: 0,
        } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      ledgerEntry = await WebhookEvent.findOne({ eventId });
    }
    if (!ledgerEntry) return res.status(503).send('Webhook event could not be stored');
    if (ledgerEntry.payloadHash !== payloadHash) return res.status(409).send('Event ID was already used for a different payload');
    if (ledgerEntry.status === 'PROCESSED') return res.status(200).send('Duplicate event already processed');

    const now = new Date();
    const claimed = await WebhookEvent.findOneAndUpdate({
      _id: ledgerEntry._id,
      $or: [
        { status: 'RECEIVED' },
        { status: 'PROCESSING', leaseUntil: { $lte: now } },
      ],
    }, {
      $set: { status: 'PROCESSING', leaseUntil: new Date(now.getTime() + 60_000), lastError: null },
      $inc: { attempts: 1 },
    }, { new: true });
    if (!claimed) {
      const current = await WebhookEvent.findById(ledgerEntry._id).select('status');
      return current?.status === 'PROCESSED'
        ? res.status(200).send('Duplicate event already processed')
        : res.status(503).send('Event is being processed; provider may retry');
    }

    let result = { retry: false };
    const paymentSnapshot = claimed.payment?.id ? claimed.payment.toObject?.() || claimed.payment : null;
    if (claimed.event === 'payment.captured') {
      if (!paymentSnapshot?.id) result = { retry: true };
      else result = await applyWebhookPayment(paymentSnapshot, 'SUCCESS');
    } else if (claimed.event === 'order.paid') {
      if (paymentSnapshot?.id) {
        result = await applyWebhookPayment(paymentSnapshot, 'SUCCESS');
      } else if (!claimed.gatewayOrderId || !razorpay) {
        result = { retry: true };
      } else {
        const paymentCollection = await razorpay.orders.fetchPayments(claimed.gatewayOrderId);
        const capturedPayment = paymentCollection.items?.find((item) => item.status === 'captured');
        if (capturedPayment) result = await applyWebhookPayment(capturedPayment, 'SUCCESS');
        else result = { retry: true };
      }
    } else if (claimed.event === 'payment.failed') {
      if (!paymentSnapshot?.id) result = { retry: true };
      else result = await applyWebhookPayment(paymentSnapshot, 'FAILED');
    }

    if (result.retry) {
      await WebhookEvent.updateOne({ _id: claimed._id, status: 'PROCESSING' }, {
        $set: { status: 'RECEIVED', lastError: 'Related payment record is not ready; retry required.' },
        $unset: { leaseUntil: 1 },
      });
      return res.status(500).send('Payment record is not ready; retry webhook');
    }

    await WebhookEvent.updateOne({ _id: claimed._id, status: 'PROCESSING' }, {
      $set: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
      $unset: { leaseUntil: 1 },
    });
    return res.status(200).send('OK');
  } catch (error) {
    if (ledgerEntry?._id) {
      await WebhookEvent.updateOne({ _id: ledgerEntry._id, status: 'PROCESSING' }, {
        $set: { status: 'RECEIVED', lastError: 'Webhook processing failed; retry required.' },
        $unset: { leaseUntil: 1 },
      }).catch(() => {});
    }
    console.error('[Webhook Error] Payment event processing failed; provider retry may be required.');
    return res.status(500).send('Webhook processing failed');
  }
};

module.exports = {
  createRazorpayOrder,
  verifyPayment,
  reportPaymentOutcome,
  reconcilePayment,
  confirmCounterPayment,
  handleWebhook,
  signaturesMatch,
  stableReceiptForOrder,
  isValidWebhookEventId,
  isObjectId,
  updateOrderPaymentStatus,
};
