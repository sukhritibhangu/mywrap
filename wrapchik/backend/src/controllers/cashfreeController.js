const crypto = require('node:crypto');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const cashfree = require('../services/cashfreeService');
const { isObjectId } = require('./paymentController');
const { updateOrderPaymentStatus } = require('./paymentController');

const stableCashfreeOrderId = (orderId) => `wrapchik_${String(orderId).replace(/[^a-f\d]/gi, '').toLowerCase()}`;
const stableCashfreeIdempotencyKey = (orderId) => {
  const hex = crypto.createHash('sha256').update(`wrapchik-cashfree:${orderId}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};
const terminal = (status) => ['CANCELLED', 'REJECTED', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'].includes(status);

const createCashfreeSession = async (req, res, next) => {
  try {
    const orderId = req.body?.orderId;
    if (!isObjectId(orderId)) return res.status(400).json({ success: false, message: 'A valid order ID is required.' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (String(order.userId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Unauthorized.' });
    if (order.paymentMethod !== 'CASHFREE') return res.status(400).json({ success: false, message: 'This order is not configured for Cashfree.' });
    if (terminal(order.orderStatus)) return res.status(409).json({ success: false, message: 'This order is no longer available for payment.' });
    if (order.paymentStatus === 'SUCCESS') return res.json({ success: true, paid: true, orderId: order._id });
    if (!cashfree.isConfigured()) return res.status(503).json({ success: false, message: 'Cashfree sandbox credentials are not configured.' });
    const amount = Number(order.totalAmount);
    if (!Number.isFinite(amount) || amount < 1) return res.status(400).json({ success: false, message: 'Cashfree requires an order amount of at least ₹1.' });

    const providerOrderId = stableCashfreeOrderId(order._id);
    let payment = await Payment.findOne({ orderId: order._id, gateway: 'CASHFREE' }).sort({ createdAt: -1 }).select('+paymentSessionId');
    if (payment && (Number(payment.amount) !== amount || payment.currency !== 'INR' || payment.gatewayOrderId !== providerOrderId)) {
      return res.status(409).json({ success: false, message: 'Saved payment details do not match this order.' });
    }
    if (payment?.paymentSessionId) {
      const providerOrder = await cashfree.getOrder(providerOrderId);
      if (providerOrder.order_id !== providerOrderId
        || Number(providerOrder.order_amount) !== Number(amount.toFixed(2))
        || providerOrder.order_currency !== 'INR') {
        return res.status(502).json({ success: false, message: 'Saved Cashfree order details no longer match this order.' });
      }
      if (providerOrder.order_status === 'PAID') {
        await reconcileCashfreeOrder(order, payment);
        const latest = await Order.findById(order._id);
        if (latest?.paymentStatus === 'SUCCESS') return res.json({ success: true, paid: true, orderId: order._id });
        return res.status(202).json({ success: false, pending: true, message: 'Cashfree reports payment activity that is still being reconciled. Check status before retrying.' });
      }
      if (providerOrder.order_status !== 'ACTIVE') {
        return res.status(409).json({ success: false, message: 'This Cashfree session is no longer active. Check order status or place a new order.' });
      }
      payment.status = 'PENDING';
      await payment.save();
      const pendingOrder = await Order.findOneAndUpdate({
        _id: order._id,
        paymentStatus: { $ne: 'SUCCESS' },
        orderStatus: { $nin: ['CANCELLED', 'REJECTED', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'] },
      }, { $set: { paymentId: payment._id, paymentStatus: 'PENDING' } }, { new: true });
      if (!pendingOrder) return res.status(409).json({ success: false, message: 'This order is no longer available for payment.' });
      return res.json({ success: true, cashfree: { orderId: providerOrderId, paymentSessionId: payment.paymentSessionId }, orderId: order._id });
    }

    const lockToken = crypto.randomUUID();
    const now = new Date();
    const locked = await Order.findOneAndUpdate({
      _id: order._id,
      userId: req.user._id,
      paymentMethod: 'CASHFREE',
      paymentStatus: { $ne: 'SUCCESS' },
      orderStatus: { $nin: ['CANCELLED', 'REJECTED', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED'] },
      $or: [{ paymentCreateLockUntil: { $exists: false } }, { paymentCreateLockUntil: null }, { paymentCreateLockUntil: { $lte: now } }],
    }, { $set: { paymentCreateLockToken: lockToken, paymentCreateLockUntil: new Date(now.getTime() + 120000) } }, { new: true });
    if (!locked) return res.status(409).json({ success: false, message: 'A payment session is being prepared. Refresh shortly.' });

    try {
      const customer = order.customerSnapshot || {};
      const name = String(customer.name || 'Wrapchik Customer').slice(0, 100);
      const phone = String(customer.phone || '').replace(/\D/g, '').slice(-10);
      const providerOrder = await cashfree.createOrder({
        order_id: providerOrderId,
        order_amount: Number(amount.toFixed(2)),
        order_currency: 'INR',
        customer_details: {
          customer_id: String(order.userId).replace(/[^a-z\d_-]/gi, '').slice(0, 50),
          customer_name: name,
          ...(customer.email ? { customer_email: String(customer.email).slice(0, 100) } : {}),
          ...(phone.length >= 10 ? { customer_phone: phone } : {}),
        },
        order_note: `Wrapchik ${order.orderNumber}`.slice(0, 250),
        ...(process.env.APP_PUBLIC_URL ? { order_meta: { return_url: `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/payment?orderId=${order._id}` } } : {}),
      }, stableCashfreeIdempotencyKey(order._id));
      if (providerOrder.order_id !== providerOrderId || Number(providerOrder.order_amount) !== Number(amount.toFixed(2))
        || providerOrder.order_currency !== 'INR' || typeof providerOrder.payment_session_id !== 'string') {
        return res.status(502).json({ success: false, message: 'Cashfree returned a payment session that did not match the order.' });
      }
      payment = payment || await Payment.create({
        orderId: order._id, userId: req.user._id, gatewayOrderId: providerOrderId, gateway: 'CASHFREE',
        amount, currency: 'INR', status: 'PENDING', method: 'Cashfree',
      });
      payment.paymentSessionId = providerOrder.payment_session_id;
      payment.status = 'PENDING';
      await payment.save();
      const linkedOrder = await Order.findOneAndUpdate({ _id: order._id, paymentCreateLockToken: lockToken, paymentStatus: { $ne: 'SUCCESS' } }, {
        $set: { paymentId: payment._id, paymentStatus: 'PENDING' },
      }, { new: true });
      if (!linkedOrder) return res.status(409).json({ success: false, message: 'Order changed while payment was being prepared. Refresh its latest status.' });
      require('../config/socketManager').emitOrderUpdate(linkedOrder);
      return res.json({ success: true, cashfree: { orderId: providerOrderId, paymentSessionId: providerOrder.payment_session_id }, orderId: order._id });
    } finally {
      await Order.updateOne({ _id: order._id, paymentCreateLockToken: lockToken }, { $unset: { paymentCreateLockToken: 1, paymentCreateLockUntil: 1 } });
    }
  } catch (error) {
    return next(error);
  }
};

const reconcileCashfreeOrder = async (order, payment) => {
  const [providerOrder, providerPayments] = await Promise.all([
    cashfree.getOrder(payment.gatewayOrderId),
    cashfree.getPayments(payment.gatewayOrderId),
  ]);
  if (providerOrder.order_id !== payment.gatewayOrderId
    || Number(providerOrder.order_amount) !== Number(Number(payment.amount).toFixed(2))
    || providerOrder.order_currency !== payment.currency) throw new Error('Cashfree order details did not match the saved order.');
  const records = Array.isArray(providerPayments) ? providerPayments : [];
  const verified = records.filter((item) => item.order_id === payment.gatewayOrderId
    && Number(item.payment_amount) === Number(Number(payment.amount).toFixed(2))
    && item.payment_currency === payment.currency);
  const success = verified.find((item) => item.payment_status === 'SUCCESS');
  if (success || providerOrder.order_status === 'PAID') {
    if (!success) return { status: 'PENDING' };
    const updated = await Payment.findOneAndUpdate({ _id: payment._id, status: { $ne: 'SUCCESS' } }, {
      $set: { status: 'SUCCESS', gatewayPaymentId: String(success.cf_payment_id), method: success.payment_group || 'Cashfree' },
      $addToSet: { gatewayPaymentIds: String(success.cf_payment_id) },
    }, { new: true });
    if (!updated && (await Payment.findById(payment._id).select('status'))?.status !== 'SUCCESS') return { status: 'PENDING' };
    await updateOrderPaymentStatus(order, 'SUCCESS', payment._id);
    return { status: 'SUCCESS' };
  }
  const failed = verified.filter((item) => ['FAILED', 'USER_DROPPED', 'CANCELLED'].includes(item.payment_status))
    .sort((a, b) => new Date(b.payment_completion_time || b.payment_time || 0) - new Date(a.payment_completion_time || a.payment_time || 0))[0];
  if (failed && !verified.some((item) => ['PENDING', 'NOT_ATTEMPTED'].includes(item.payment_status))) {
    await Payment.findOneAndUpdate({ _id: payment._id, status: { $ne: 'SUCCESS' } }, { $set: { status: 'FAILED', gatewayPaymentId: String(failed.cf_payment_id) } });
    await updateOrderPaymentStatus(order, 'FAILED', payment._id);
    return { status: 'FAILED' };
  }
  return { status: 'PENDING' };
};

const reconcileCashfree = async (req, res, next) => {
  try {
    const id = req.body?.orderId;
    if (!isObjectId(id)) return res.status(400).json({ success: false, message: 'A valid order ID is required.' });
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (String(order.userId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Unauthorized.' });
    if (order.paymentMethod !== 'CASHFREE') return res.status(400).json({ success: false, message: 'This order does not use Cashfree.' });
    if (order.paymentStatus === 'SUCCESS') return res.json({ success: true, paymentStatus: 'SUCCESS' });
    const payment = await Payment.findOne({ orderId: order._id, gateway: 'CASHFREE' });
    if (!payment) return res.status(404).json({ success: false, message: 'No Cashfree payment session is available.' });
    const result = await reconcileCashfreeOrder(order, payment);
    return res.json({ success: true, paymentStatus: result.status, message: result.status === 'SUCCESS' ? 'Cashfree confirmed payment.' : 'Cashfree has not confirmed a successful payment yet.' });
  } catch (error) { return next(error); }
};

const handleCashfreeWebhook = async (req, res) => {
  let ledger;
  try {
    if (!process.env.CASHFREE_WEBHOOK_SECRET) return res.status(503).send('Cashfree webhook is not configured');
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const timestamp = req.headers['x-webhook-timestamp'];
    const signature = req.headers['x-webhook-signature'];
    if (!cashfree.verifyWebhookSignature(raw, timestamp, signature)) return res.status(400).send('Invalid webhook signature');
    const payload = JSON.parse(raw.toString('utf8'));
    const data = payload.data || {};
    const orderId = data.order?.order_id;
    const paymentInfo = data.payment || {};
    const event = String(payload.type || payload.event || 'PAYMENT_EVENT').slice(0, 100);
    const eventKey = req.headers['x-idempotency-header'] || crypto.createHash('sha256').update(raw).digest('hex');
    const eventId = `cf_${crypto.createHash('sha256').update(String(eventKey)).digest('hex')}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    ledger = await WebhookEvent.findOneAndUpdate({ eventId }, { $setOnInsert: {
      eventId, event, payloadHash: hash, gatewayOrderId: orderId || null,
      payment: { id: String(paymentInfo.cf_payment_id || ''), order_id: String(orderId || ''), amount: Math.round(Number(paymentInfo.payment_amount || 0) * 100), currency: String(paymentInfo.payment_currency || 'INR'), status: String(paymentInfo.payment_status || ''), method: String(paymentInfo.payment_group || 'Cashfree') },
      status: 'RECEIVED', attempts: 0,
    } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    if (ledger.payloadHash !== hash) return res.status(409).send('Webhook idempotency key payload mismatch');
    if (ledger.status === 'PROCESSED') return res.status(200).send('Duplicate webhook already processed');
    const now = new Date();
    const claim = await WebhookEvent.findOneAndUpdate({ _id: ledger._id, $or: [{ status: 'RECEIVED' }, { status: 'PROCESSING', leaseUntil: { $lte: now } }] }, {
      $set: { status: 'PROCESSING', leaseUntil: new Date(now.getTime() + 60000), lastError: null }, $inc: { attempts: 1 },
    }, { new: true });
    if (!claim) return res.status(503).send('Webhook event is being processed');
    const payment = orderId ? await Payment.findOne({ gatewayOrderId: orderId, gateway: 'CASHFREE' }) : null;
    if (orderId && event.toUpperCase().includes('PAYMENT') && !payment) {
      await WebhookEvent.updateOne({ _id: claim._id, status: 'PROCESSING' }, { $set: { status: 'RECEIVED', lastError: 'Payment session is not persisted yet; retry required.' }, $unset: { leaseUntil: 1 } });
      return res.status(500).send('Payment session is not ready; retry webhook');
    }
    if (payment) {
      const order = await Order.findById(payment.orderId);
      if (!order) throw new Error('Related Wrapchik order was not found.');
      await reconcileCashfreeOrder(order, payment);
    }
    await WebhookEvent.updateOne({ _id: claim._id, status: 'PROCESSING' }, { $set: { status: 'PROCESSED', processedAt: new Date() }, $unset: { leaseUntil: 1 } });
    return res.status(200).send('OK');
  } catch (error) {
    if (ledger?._id) await WebhookEvent.updateOne({ _id: ledger._id, status: 'PROCESSING' }, { $set: { status: 'RECEIVED', lastError: 'Cashfree reconciliation failed; retry required.' }, $unset: { leaseUntil: 1 } }).catch(() => {});
    console.error('[Cashfree webhook] Payment event could not be reconciled.');
    return res.status(500).send('Webhook processing failed');
  }
};

module.exports = { createCashfreeSession, reconcileCashfree, handleCashfreeWebhook, stableCashfreeOrderId, stableCashfreeIdempotencyKey, reconcileCashfreeOrder };
