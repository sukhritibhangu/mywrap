const Order = require('../models/Order');
const Payment = require('../models/Payment');
const RestaurantSettings = require('../models/RestaurantSettings');
const { isObjectId, updateOrderPaymentStatus } = require('./paymentController');
const { isUpiConfigured, createUpiPaymentUri } = require('../utils/upiPayment');

const getUpiInstructions = async (req, res, next) => {
  try {
    if (!isObjectId(req.params.orderId)) return res.status(400).json({ success: false, message: 'A valid order ID is required.' });
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (String(order.userId) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized.' });
    if (order.paymentMethod !== 'UPI_QR') return res.status(400).json({ success: false, message: 'This order does not use UPI.' });
    if (['CANCELLED', 'REJECTED'].includes(order.orderStatus)) return res.status(409).json({ success: false, message: 'This order is closed.' });
    const settings = await RestaurantSettings.getSettings();
    if (!isUpiConfigured(settings)) return res.status(503).json({ success: false, message: 'UPI payment is not enabled or configured by the outlet.' });
    const upiUri = createUpiPaymentUri({ upiId: settings.upiId, payeeName: settings.upiPayeeName, amount: order.totalAmount, orderId: order._id, orderNumber: order.orderNumber });
    return res.json({ success: true, instructions: { upiUri, upiId: settings.upiId, payeeName: settings.upiPayeeName, amount: order.totalAmount, currency: 'INR', orderId: String(order._id), orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, paymentReference: String(order._id) } });
  } catch (error) { return next(error); }
};

const submitUpiReference = async (req, res, next) => {
  try {
    const { orderId, transactionReference } = req.body || {};
    const reference = typeof transactionReference === 'string' ? transactionReference.trim() : '';
    if (!isObjectId(orderId)) return res.status(400).json({ success: false, message: 'A valid order ID is required.' });
    if (!/^[A-Za-z0-9-]{8,120}$/.test(reference)) return res.status(400).json({ success: false, message: 'Enter a valid UPI transaction reference (8–120 letters, numbers, or hyphens).' });
    const settings = await RestaurantSettings.getSettings();
    if (!isUpiConfigured(settings)) return res.status(503).json({ success: false, message: 'UPI payment is not enabled or configured by the outlet.' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (String(order.userId) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Unauthorized.' });
    if (order.paymentMethod !== 'UPI_QR') return res.status(400).json({ success: false, message: 'This order does not use UPI QR payment.' });
    if (!Number.isFinite(Number(order.totalAmount)) || Number(order.totalAmount) <= 0) return res.status(409).json({ success: false, message: 'The saved order total is invalid.' });
    if (order.paymentStatus === 'SUCCESS') return res.status(409).json({ success: false, message: 'This order is already paid.' });
    if (['CANCELLED', 'REJECTED'].includes(order.orderStatus)) return res.status(409).json({ success: false, message: 'Payment cannot be submitted for a cancelled or rejected order.' });
    const gatewayOrderId = `UPI_${order._id}`;
    let payment = await Payment.findOne({ orderId: order._id, method: 'UPI_QR' });
    if (payment?.status === 'SUCCESS') return res.status(409).json({ success: false, message: 'This payment is already verified.' });
    const alreadyPendingSameReference = payment?.status === 'PENDING' && payment.upiTransactionReference === reference;
    if (!payment) payment = await Payment.create({ orderId: order._id, userId: req.user._id, gatewayOrderId, gateway: 'UPI_QR', amount: order.totalAmount, currency: 'INR', status: 'PENDING', method: 'UPI_QR', upiTransactionReference: reference });
    else {
      if (payment.status === 'PENDING' && payment.upiTransactionReference && payment.upiTransactionReference !== reference) return res.status(409).json({ success: false, message: 'A UPI reference is already awaiting outlet verification.' });
      payment.upiTransactionReference = reference;
      payment.amount = order.totalAmount;
      payment.status = 'PENDING';
      payment.verificationReason = null;
      payment.verifiedBy = null;
      payment.verifiedAt = null;
      await payment.save();
    }
    await Order.updateOne({ _id: order._id, paymentStatus: { $ne: 'SUCCESS' } }, { $set: { paymentId: payment._id, paymentStatus: 'PENDING' } });
    if (!alreadyPendingSameReference) {
      const socketManager = require('../config/socketManager');
      socketManager.emitOrderUpdate(order);
      await require('./notificationController').notifyAdmins(
        `UPI claim submitted for order #${order.orderNumber}`,
        'A customer submitted a UPI transaction reference. Verify receipt before confirming payment.',
        'ORDER_UPDATE', order._id, `order:${order._id}:upi-claim:${payment._id}:${reference}`
      ).catch(() => {});
    }
    return res.status(202).json({ success: true, paymentStatus: 'PENDING', message: 'UPI reference submitted. The outlet must verify receipt before the order is marked paid.' });
  } catch (error) { return next(error); }
};

const getPendingUpiPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ method: 'UPI_QR', status: 'PENDING', upiTransactionReference: { $type: 'string' } })
      .sort({ createdAt: 1 }).limit(100).populate({ path: 'orderId', select: 'orderNumber userId customerSnapshot items totalAmount paymentStatus orderStatus', populate: { path: 'userId', select: 'name email phone' } });
    return res.json({ success: true, payments });
  } catch (error) { return next(error); }
};

const reviewUpiPayment = async (req, res, next) => {
  try {
    const { action, reason } = req.body || {};
    if (!['VERIFY', 'REJECT'].includes(action)) return res.status(400).json({ success: false, message: 'Action must be VERIFY or REJECT.' });
    const rejectionReason = typeof reason === 'string' ? reason.trim() : '';
    if (action === 'REJECT' && (!rejectionReason || rejectionReason.length > 500)) return res.status(400).json({ success: false, message: 'A rejection reason (1–500 characters) is required.' });
    const payment = await Payment.findOne({ _id: req.params.id, method: 'UPI_QR' });
    if (!payment) return res.status(404).json({ success: false, message: 'UPI payment claim not found.' });
    if (payment.status !== 'PENDING') return res.status(409).json({ success: false, message: `This payment claim is already ${payment.status.toLowerCase()}.` });
    const order = await Order.findById(payment.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.paymentMethod !== 'UPI_QR' || Number(payment.amount) !== Number(order.totalAmount)) return res.status(409).json({ success: false, message: 'The payment claim does not match this UPI order amount.' });
    if (order.paymentStatus === 'SUCCESS') return res.status(409).json({ success: false, message: 'This order is already paid.' });
    if (['CANCELLED', 'REJECTED'].includes(order.orderStatus)) return res.status(409).json({ success: false, message: 'This order is closed and cannot be verified.' });
    const status = action === 'VERIFY' ? 'SUCCESS' : 'FAILED';
    const updated = await Payment.findOneAndUpdate({ _id: payment._id, status: 'PENDING' }, { $set: {
      status, verificationReason: action === 'REJECT' ? rejectionReason : null,
      verifiedBy: req.user._id, verifiedAt: new Date(),
    } }, { new: true });
    if (!updated) return res.status(409).json({ success: false, message: 'This payment was reviewed by another administrator. Refresh the queue.' });
    if (action === 'VERIFY') {
      await updateOrderPaymentStatus(order, 'SUCCESS', payment._id);
    } else {
      await updateOrderPaymentStatus(order, 'FAILED', payment._id);
    }
    return res.json({ success: true, paymentStatus: status, payment: updated, message: action === 'VERIFY' ? 'UPI payment verified by the outlet.' : 'UPI payment claim rejected.' });
  } catch (error) { return next(error); }
};

module.exports = { getUpiInstructions, submitUpiReference, getPendingUpiPayments, reviewUpiPayment };
