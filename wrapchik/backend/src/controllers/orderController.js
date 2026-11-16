const Order = require('../models/Order');
const Product = require('../models/Product');
const socketManager = require('../config/socketManager');
const mongoose = require('mongoose');
const { calculateVerifiedItems } = require('../utils/orderPricing');
const { reserveCoupon, releaseCouponForOrder } = require('../utils/couponPricing');
const { reservePickupSlot, releasePickupSlot } = require('./pickupSlotController');
const { isUpiConfigured, isSupportedNewPaymentMethod } = require('../utils/upiPayment');

// @desc    Create new order & recalculate price server-side
// @route   POST /api/orders
// @access  Private (Student)
const createOrder = async (req, res, next) => {
  let couponReservation = null;
  let pickupSlotReservation = null;
  const orderId = new mongoose.Types.ObjectId();
  let orderPersisted = false;
  try {
    const {
      items,
      pickupTimeSlot,
      pickupLocation,
      orderType = 'TAKEAWAY',
      paymentMethod = 'COUNTER',
      hostel,
      roomNumber,
      deliveryInstructions,
      tableId,
      couponCode,
      scheduledPickupAt,
      idempotencyKey: rawIdempotencyKey,
    } = req.body || {};
    const idempotencyKey = typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim() : rawIdempotencyKey;

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'An order must contain between 1 and 50 items',
      });
    }

    if (rawIdempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 128)) {
      return res.status(400).json({ success: false, message: 'A valid idempotency key is required' });
    }

    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return res.status(400).json({ success: false, message: 'Each order item must be an object' });
      }
      const quantity = Number(item.quantity);
      if (typeof item.productId !== 'string' || !/^[a-f\d]{24}$/i.test(item.productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return res.status(400).json({ success: false, message: 'Each item must have a product ID and a whole-number quantity from 1 to 50' });
      }
    }

    const allowedOrderTypes = ['TAKEAWAY', 'DELIVERY', 'DINE_IN'];
    if (!allowedOrderTypes.includes(orderType)) {
      return res.status(400).json({ success: false, message: 'Invalid orderType' });
    }
    if (!isSupportedNewPaymentMethod(paymentMethod)) return res.status(400).json({ success: false, message: 'Choose UPI or cash at counter.' });

    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey, userId: req.user._id });
      if (existingOrder) {
        await existingOrder.populate('userId', 'name email phone');
        return res.status(200).json({
          success: true,
          message: 'Order already placed (Idempotent response)',
          order: existingOrder,
        });
      }
    }

    const RestaurantSettings = require('../models/RestaurantSettings');
    const settings = await RestaurantSettings.getSettings();
    if (paymentMethod === 'UPI_QR' && !isUpiConfigured(settings)) return res.status(503).json({ success: false, message: 'UPI payment is not enabled or configured by the outlet.' });
    if (paymentMethod === 'COUNTER' && settings.cashEnabled === false) return res.status(503).json({ success: false, message: 'Cash at counter is currently unavailable.' });
    if (!settings.acceptingOrders) {
      return res.status(503).json({ success: false, message: 'Restaurant is currently not accepting orders. Please try again later.' });
    }

    const settingByOrderType = {
      TAKEAWAY: 'takeawayEnabled',
      DELIVERY: 'deliveryEnabled',
      DINE_IN: 'dineInEnabled',
    };
    if (settings[settingByOrderType[orderType]] !== true) {
      return res.status(409).json({ success: false, message: 'This fulfillment option is currently unavailable. Please choose another option.' });
    }

    if (orderType === 'DELIVERY') {
      if (typeof hostel !== 'string' || hostel.trim() === '' || hostel.trim().length > 120 || typeof roomNumber !== 'string' || roomNumber.trim() === '' || roomNumber.trim().length > 32) {
        return res.status(400).json({ success: false, message: 'Hostel and room number are required for delivery' });
      }
      if (deliveryInstructions != null && (typeof deliveryInstructions !== 'string' || deliveryInstructions.length > 500)) {
        return res.status(400).json({ success: false, message: 'Delivery instructions must be 500 characters or fewer' });
      }
    } else if (orderType === 'DINE_IN') {
      if (typeof tableId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(tableId)) {
        return res.status(400).json({ success: false, message: 'Table ID is required and must be a valid ObjectId for dine-in' });
      }
      const Table = require('../models/Table');
      const table = await Table.findById(tableId);
      if (!table || table.status !== 'AVAILABLE') {
        return res.status(400).json({ success: false, message: 'Table is not available' });
      }
    }

    if (scheduledPickupAt && orderType !== 'TAKEAWAY') return res.status(400).json({ success: false, message: 'Scheduled pickup is only available for takeaway orders.' });
    if (scheduledPickupAt) {
      pickupSlotReservation = await reservePickupSlot(scheduledPickupAt, orderId);
    }

    const { verifiedItems, subtotal: calculatedSubtotal } = await calculateVerifiedItems(items);
    if (couponCode) couponReservation = await reserveCoupon(couponCode, req.user._id, orderId, calculatedSubtotal);
    const discountAmount = couponReservation?.discountAmount || 0;
    const netSubtotal = calculatedSubtotal - discountAmount;
    const taxAndFees = Math.round(netSubtotal * 0.05); // Existing 5% order tax/fee rule, applied after discount.
    let totalAmount = netSubtotal + taxAndFees;

    if (orderType === 'DELIVERY') {
      totalAmount += settings.deliveryFee || 0;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || totalAmount > Number.MAX_SAFE_INTEGER / 100) {
      if (couponReservation) await releaseCouponForOrder({ _id: orderId, couponId: couponReservation.couponId });
      if (pickupSlotReservation) await releasePickupSlot({ _id: orderId, pickupSlotId: pickupSlotReservation._id });
      return res.status(400).json({ success: false, message: 'The calculated order total is invalid' });
    }

    // Generate unique Order Number
    const orderNumber = `WRP-${Math.floor(100000 + Math.random() * 900000)}`;

    const order = await Order.create({
      _id: orderId,
      userId: req.user._id,
      customerSnapshot: {
        name: req.user.name || '',
        email: req.user.email || '',
        phone: req.user.phone || '',
      },
      orderNumber,
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      taxAndFees,
      totalAmount,
      couponId: couponReservation?.couponId,
      couponCode: couponReservation?.code,
      discountAmount,
      paymentMethod,
      pickupLocation: orderType === 'TAKEAWAY' ? (pickupLocation || 'Wrapchik Counter, SAC Ground Floor') : undefined,
      pickupTimeSlot: orderType === 'TAKEAWAY' ? (pickupSlotReservation ? `Scheduled · ${new Date(scheduledPickupAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}` : (pickupTimeSlot || '15-20 Mins')) : undefined,
      scheduledPickupAt: pickupSlotReservation ? new Date(scheduledPickupAt) : null,
      pickupSlotId: pickupSlotReservation?._id,
      paymentStatus: 'PENDING',
      orderStatus: 'PLACED',
      orderType,
      hostel: orderType === 'DELIVERY' ? hostel.trim() : undefined,
      roomNumber: orderType === 'DELIVERY' ? roomNumber.trim() : undefined,
      deliveryInstructions: orderType === 'DELIVERY' ? deliveryInstructions?.trim() : undefined,
      tableId: orderType === 'DINE_IN' ? tableId : undefined,
      estimatedPrepTime: settings.estimatedPrepMinutes,
      idempotencyKey,
    });
    orderPersisted = true;

    if (orderType === 'DINE_IN') {
      const Table = require('../models/Table');
      const reservedTable = await Table.findOneAndUpdate(
        { _id: tableId, status: 'AVAILABLE' },
        { $set: { status: 'OCCUPIED', currentOrderId: order._id } },
        { new: true }
      );
      if (!reservedTable) {
        await Order.findByIdAndDelete(order._id);
        if (couponReservation) await releaseCouponForOrder(order);
        if (pickupSlotReservation) await releasePickupSlot(order);
        orderPersisted = false;
        return res.status(409).json({ success: false, message: 'That table was just reserved. Please choose an available table.' });
      }
    }

    // Populate user info for immediate response
    await order.populate('userId', 'name email phone');

    const { createNotification, notifyAdmins } = require('./notificationController');
    const placedMessage = paymentMethod === 'COUNTER'
      ? 'Your order is placed. Payment is due at the counter.'
      : 'Your order is saved. Pay using the order QR and submit the UPI transaction reference; outlet verification is required before preparation.';
    await createNotification(order.userId._id || order.userId, `Order #${order.orderNumber} placed`, placedMessage, 'ORDER_UPDATE', order._id, `order:${order._id}:placed`);
    socketManager.emitOrderUpdate(order);
    if (paymentMethod === 'COUNTER') {
      socketManager.emitNewOrder(order);
      await notifyAdmins(`New counter order #${order.orderNumber}`, 'A new pay-at-counter order is waiting in the order queue.', 'ORDER_UPDATE', order._id, `order:${order._id}:counter-new`);
    }

    res.status(201).json({
      success: true,
      message: paymentMethod === 'COUNTER'
        ? 'Order placed. Pay at the counter.'
        : 'Order saved. Submit the UPI transaction reference for outlet verification.',
      order,
    });
  } catch (error) {
    if (!orderPersisted && couponReservation) {
      try { await releaseCouponForOrder({ _id: orderId, couponId: couponReservation.couponId }); } catch (releaseError) { console.error('[Coupon reservation] Could not release failed order reservation.'); }
    }
    if (!orderPersisted && pickupSlotReservation) {
      try { await releasePickupSlot({ _id: orderId, pickupSlotId: pickupSlotReservation._id }); } catch (releaseError) { console.error('[Pickup slot] Could not release failed order reservation.'); }
    }
    if (error.code === 11000 && req.body?.idempotencyKey) {
      try {
        const existingOrder = await Order.findOne({
          idempotencyKey: String(req.body.idempotencyKey).trim(),
          userId: req.user._id,
        }).populate('userId', 'name email phone');
        if (existingOrder) {
          return res.status(200).json({ success: true, message: 'Order already placed (Idempotent response)', order: existingOrder });
        }
      } catch (lookupError) {
        return next(lookupError);
      }
    }
    next(error);
  }
};

// @desc    Get logged-in user's orders
// @route   GET /api/orders/my
// @access  Private
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).populate('paymentId', 'method status upiTransactionReference verificationReason verifiedBy verifiedAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order details by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId', 'name email phone').populate('paymentId', 'method status upiTransactionReference verificationReason verifiedBy verifiedAt');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Rule 3: Enforce authorization check (Must belong to user or user is admin)
    if (order.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to order details',
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel student's order (Only if status is PLACED)
// @route   POST /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized action',
      });
    }

    if (order.orderStatus === 'CANCELLED') {
      return res.json({ success: true, message: 'Order is already cancelled', order });
    }

    if (order.paymentStatus === 'SUCCESS') {
      return res.status(409).json({
        success: false,
        message: 'This order is already paid. Online refunds are not enabled; contact the outlet before cancelling.',
      });
    }

    if (order.orderStatus !== 'PLACED') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order after it has been ${order.orderStatus.toLowerCase()}`,
      });
    }

    const cancelledOrder = await Order.findOneAndUpdate(
      { _id: order._id, userId: req.user._id, orderStatus: 'PLACED', paymentStatus: { $ne: 'SUCCESS' } },
      { $set: { orderStatus: 'CANCELLED', paymentStatus: 'CANCELLED', cancelledAt: new Date() } },
      { new: true }
    );
    if (!cancelledOrder) {
      const currentOrder = await Order.findById(order._id);
      return res.status(409).json({
        success: false,
        message: currentOrder?.paymentStatus === 'SUCCESS'
          ? 'This order has been paid and cannot be cancelled here because refunds are not enabled.'
          : `This order can no longer be cancelled from ${currentOrder?.orderStatus || 'its current state'}.`,
      });
    }

    const Payment = require('../models/Payment');
    await Payment.updateMany({ orderId: order._id, status: 'PENDING' }, { $set: { status: 'CANCELLED' } });
    await releaseCouponForOrder(cancelledOrder);
    await releasePickupSlot(cancelledOrder);

    socketManager.emitOrderUpdate(cancelledOrder);
    const { createNotification, notifyAdmins } = require('./notificationController');
    await createNotification(req.user._id, `Order #${order.orderNumber} cancelled`, 'Your order was cancelled before the outlet began preparation.', 'ORDER_UPDATE', order._id, `order:${order._id}:status:CANCELLED`);
    await notifyAdmins(`Order #${order.orderNumber} cancelled`, 'A customer cancelled an order before preparation.', 'ORDER_UPDATE', order._id, `order:${order._id}:customer-cancelled`);

    if (order.orderType === 'DINE_IN') {
      const Table = require('../models/Table');
      await Table.findOneAndUpdate({ _id: order.tableId, currentOrderId: order._id }, { status: 'AVAILABLE', currentOrderId: null });
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: cancelledOrder,
    });
  } catch (error) {
    next(error);
  }
};

const reorderFromPast = async (req, res, next) => {
  try {
    const pastOrder = await Order.findById(req.params.id);
    if (!pastOrder) return res.status(404).json({ success: false, message: 'Order not found' });
    if (pastOrder.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const reorderItems = [];
    const unavailableItems = [];
    
    for (const item of pastOrder.items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.available) {
        unavailableItems.push({ name: item.name, reason: product ? 'Currently unavailable' : 'No longer on menu' });
        continue;
      }
      // Use CURRENT price, not historical
      let unitPrice = product.price;
      const validCustomizations = [];
      if (item.customizations) {
        for (const cust of item.customizations) {
          const matchedCust = product.customizations.find(c => c.name === cust.name);
          if (matchedCust) {
            unitPrice += matchedCust.price;
            validCustomizations.push({ name: matchedCust.name, price: matchedCust.price });
          }
        }
      }
      reorderItems.push({
        productId: product._id,
        name: product.name,
        basePrice: product.price,
        unitPrice,
        quantity: item.quantity,
        imageUrl: product.imageUrl,
        isVeg: product.isVeg,
        customizations: validCustomizations,
      });
    }
    
    res.json({
      success: true,
      reorderItems,
      unavailableItems,
      message: unavailableItems.length > 0 ? `${unavailableItems.length} item(s) are no longer available` : 'All items available',
    });
  } catch (error) { next(error); }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  reorderFromPast,
};
