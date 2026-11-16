const Order = require('../models/Order');
const Product = require('../models/Product');

const socketManager = require('../config/socketManager');

// Allowed status transition state machine map
const TRANSITIONS_BY_TYPE = {
  TAKEAWAY: {
    PLACED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
    ACCEPTED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY'],
    READY: ['COMPLETED'],
    COMPLETED: [], REJECTED: [], CANCELLED: [],
  },
  DELIVERY: {
    PLACED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
    ACCEPTED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY'],
    READY: ['PICKED_UP'],
    PICKED_UP: ['DELIVERED'],
    DELIVERED: [], REJECTED: [], CANCELLED: [],
  },
  DINE_IN: {
    PLACED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
    ACCEPTED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['SERVED'],
    SERVED: ['COMPLETED'],
    COMPLETED: [], REJECTED: [], CANCELLED: [],
  },
};

// @desc    Get all orders for admin shopkeeper
// @route   GET /api/admin/orders
// @access  Private/Admin
const getAllOrders = async (req, res, next) => {
  try {
    const allowedStatuses = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED', 'SERVED', 'REJECTED', 'CANCELLED'];
    const { status } = req.query;
    const requestedLimit = Number.parseInt(req.query.limit, 10) || 50;
    const limit = Math.min(100, Math.max(1, requestedLimit));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * limit;
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status filter' });
    }

    let query = {};
    if (status) {
      query.orderStatus = status;
    }

    const [orders, total] = await Promise.all([Order.find(query)
      .populate('userId', 'name email phone')
      .populate('tableId', 'tableNumber label')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit), Order.countDocuments(query)]);

    res.json({
      success: true,
      count: orders.length,
      total,
      limit,
      page,
      pages: Math.ceil(total / limit),
      orders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status (Enforce state machine rule 7)
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Order status is required',
      });
    }

    const order = await Order.findById(req.params.id).populate('userId', 'name email phone');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const currentStatus = order.orderStatus;
    const allowedNextStatuses = TRANSITIONS_BY_TYPE[order.orderType || 'TAKEAWAY'][currentStatus] || [];

    if (status === 'ACCEPTED' && ['RAZORPAY', 'CASHFREE', 'UPI_QR'].includes(order.paymentMethod) && order.paymentStatus !== 'SUCCESS') {
      return res.status(409).json({ success: false, message: 'This online order cannot enter kitchen preparation until payment is confirmed.' });
    }

    if (['REJECTED', 'CANCELLED'].includes(status) && order.paymentStatus === 'SUCCESS') {
      return res.status(409).json({ success: false, message: 'This order is paid. Cancellation and refunds are not available from this workflow; contact the customer and resolve the payment first.' });
    }

    if (status === 'REJECTED' && rejectionReason !== undefined && (typeof rejectionReason !== 'string' || rejectionReason.length > 500)) {
      return res.status(400).json({ success: false, message: 'Rejection reason must be 500 characters or fewer' });
    }

    // Check invalid transition
    if (!allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid order status transition from ${currentStatus} to ${status}. Allowed next states: ${allowedNextStatuses.join(', ') || 'None (Terminal state)'}`,
      });
    }

    const timestampFields = {
      ACCEPTED: 'acceptedAt',
      PREPARING: 'preparingAt',
      READY: 'readyAt',
      PICKED_UP: 'pickedUpAt',
      DELIVERED: 'deliveredAt',
      SERVED: 'servedAt',
      COMPLETED: 'completedAt',
      REJECTED: 'rejectedAt',
      CANCELLED: 'cancelledAt',
    };
    const setFields = { orderStatus: status, [timestampFields[status]]: new Date() };
    if (status === 'REJECTED' && rejectionReason) setFields.rejectionReason = rejectionReason.trim();
    if (['REJECTED', 'CANCELLED'].includes(status) && order.paymentStatus !== 'SUCCESS') setFields.paymentStatus = 'CANCELLED';

    const transitionFilter = { _id: order._id, orderStatus: currentStatus };
    if (status === 'ACCEPTED' && ['RAZORPAY', 'CASHFREE', 'UPI_QR'].includes(order.paymentMethod)) transitionFilter.paymentStatus = 'SUCCESS';
    if (['REJECTED', 'CANCELLED'].includes(status)) transitionFilter.paymentStatus = { $ne: 'SUCCESS' };
    const updatedOrder = await Order.findOneAndUpdate(transitionFilter, { $set: setFields }, { new: true, runValidators: true })
      .populate('userId', 'name email phone');
    if (!updatedOrder) {
      const latest = await Order.findById(order._id).populate('userId', 'name email phone');
      if (latest?.orderStatus === status) {
        return res.json({ success: true, message: `Order is already ${status}`, order: latest });
      }
      return res.status(409).json({ success: false, message: `Order changed while this action was being applied. Current status: ${latest?.orderStatus || 'unknown'}. Refresh and try again.` });
    }
    if (['REJECTED', 'CANCELLED'].includes(status) && updatedOrder.paymentStatus === 'CANCELLED') {
      const Payment = require('../models/Payment');
      await Payment.updateMany({ orderId: updatedOrder._id, status: 'PENDING' }, { $set: { status: 'CANCELLED' } });
      await require('../utils/couponPricing').releaseCouponForOrder(updatedOrder);
    }
    if (['REJECTED', 'CANCELLED', 'COMPLETED', 'DELIVERED', 'SERVED'].includes(status)) await require('./pickupSlotController').releasePickupSlot(updatedOrder);

    const { createNotification } = require('./notificationController');
    const userId = updatedOrder.userId._id || updatedOrder.userId;
    const statusMessages = {
      ACCEPTED: 'Your order has been accepted and is being processed!',
      PREPARING: 'Your order is now being prepared in the kitchen!',
      READY: 'Your order is ready for pickup!',
      COMPLETED: 'Your order has been completed. Enjoy your meal!',
      PICKED_UP: 'Your order has been picked up by the delivery person!',
      DELIVERED: 'Your order has been delivered! Enjoy your meal!',
      SERVED: 'Your food has been served at your table!',
      REJECTED: `Your order was rejected. Reason: ${rejectionReason || 'Not specified'}`,
      CANCELLED: 'Your order has been cancelled.',
    };
    const message = statusMessages[status] || `Order status updated to ${status}`;
    await createNotification(userId, `Order #${updatedOrder.orderNumber} Update`, message, 'ORDER_UPDATE', updatedOrder._id, `order:${updatedOrder._id}:status:${status}`);

    socketManager.emitOrderUpdate(updatedOrder);

    if (updatedOrder.orderType === 'DINE_IN' && (status === 'COMPLETED' || status === 'CANCELLED' || status === 'REJECTED')) {
      const Table = require('../models/Table');
      await Table.findOneAndUpdate({ _id: updatedOrder.tableId, currentOrderId: updatedOrder._id }, { status: 'AVAILABLE', currentOrderId: null });
    }

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Admin Dashboard Analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
const getAnalytics = async (req, res, next) => {
  try {
    const period = ['today', '7d', '30d'].includes(req.query.period) ? req.query.period : 'today';
    // Calendar boundaries follow the outlet's India time (UTC+05:30).
    const now = new Date();
    const indiaNow = new Date(now.getTime() + 330 * 60 * 1000);
    const daysBack = period === '30d' ? 29 : period === '7d' ? 6 : 0;
    const indiaStart = new Date(Date.UTC(indiaNow.getUTCFullYear(), indiaNow.getUTCMonth(), indiaNow.getUTCDate() - daysBack));
    const periodStart = new Date(indiaStart.getTime() - 330 * 60 * 1000);
    const todayStart = new Date(Date.UTC(indiaNow.getUTCFullYear(), indiaNow.getUTCMonth(), indiaNow.getUTCDate()) - 330 * 60 * 1000);
    const periodQuery = { createdAt: { $gte: periodStart } };
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: { $in: ['PLACED', 'ACCEPTED', 'PREPARING'] } });
    const paidOrderMatch = { ...periodQuery, paymentStatus: 'SUCCESS', orderStatus: { $nin: ['CANCELLED', 'REJECTED'] } };
    const [completedOrders, todayOrders, periodOrders, totalProducts, availableProducts, unavailableProducts, allRevenue, periodRevenue, paidOrderCount, paymentBreakdown, paymentMethodBreakdown, statusBreakdown, ordersByType, popularProducts, recentOrders, revenueTrend, orderVolumeTrend, ordersByHour, customerRepeatStats, couponPerformance] = await Promise.all([
      Order.countDocuments({ orderStatus: 'COMPLETED' }),
      Order.countDocuments({ createdAt: { $gte: todayStart } }),
      Order.countDocuments(periodQuery),
      Product.countDocuments(),
      Product.countDocuments({ available: true }),
      Product.countDocuments({ available: false }),
      Order.aggregate([{ $match: { paymentStatus: 'SUCCESS', orderStatus: { $nin: ['CANCELLED', 'REJECTED'] } } }, { $group: { _id: null, amount: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $match: { ...periodQuery, paymentStatus: 'SUCCESS', orderStatus: { $nin: ['CANCELLED', 'REJECTED'] } } }, { $group: { _id: null, amount: { $sum: '$totalAmount' } } }]),
      Order.countDocuments(paidOrderMatch),
      Order.aggregate([{ $match: periodQuery }, { $group: { _id: '$paymentStatus', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $match: periodQuery }, { $group: { _id: { method: '$paymentMethod', status: '$paymentStatus' }, count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: periodQuery }, { $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: periodQuery }, { $group: { _id: '$orderType', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { ...periodQuery, paymentStatus: 'SUCCESS', orderStatus: { $nin: ['CANCELLED', 'REJECTED'] } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', name: { $first: '$items.name' }, totalQuantity: { $sum: '$items.quantity' } } },
        { $sort: { totalQuantity: -1 } }, { $limit: 5 },
      ]),
      Order.find().sort({ createdAt: -1 }).limit(8).select('orderNumber orderStatus paymentStatus paymentMethod orderType totalAmount createdAt customerSnapshot items').lean(),
      Order.aggregate([
        { $match: paidOrderMatch },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, amount: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: periodQuery },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: periodQuery },
        { $group: { _id: { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } }, orders: { $sum: 1 } } },
        { $sort: { orders: -1, _id: 1 } },
      ]),
      Order.aggregate([
        { $match: paidOrderMatch },
        { $group: { _id: '$userId', orders: { $sum: 1 } } },
        { $group: { _id: null, uniqueCustomers: { $sum: 1 }, returningCustomers: { $sum: { $cond: [{ $gt: ['$orders', 1] }, 1, 0] } } } },
      ]),
      Order.aggregate([
        { $match: { ...paidOrderMatch, couponCode: { $type: 'string' } } },
        { $group: { _id: '$couponCode', orders: { $sum: 1 }, discountAmount: { $sum: '$discountAmount' }, paidRevenue: { $sum: '$totalAmount' } } },
        { $sort: { orders: -1 } }, { $limit: 10 },
      ]),
    ]);
    const totalRevenue = allRevenue[0]?.amount || 0;
    const rangeRevenue = periodRevenue[0]?.amount || 0;
    const completeDailyTrend = (rows, valueKey) => {
      const values = new Map(rows.map(row => [row._id, Number(row[valueKey] || 0)]));
      return Array.from({ length: daysBack + 1 }, (_, index) => {
        const day = new Date(Date.UTC(indiaNow.getUTCFullYear(), indiaNow.getUTCMonth(), indiaNow.getUTCDate() - daysBack + index)).toISOString().slice(0, 10);
        return { _id: day, [valueKey]: values.get(day) || 0 };
      });
    };
    const statusCount = status => statusBreakdown.find(row => row._id === status)?.count || 0;
    const cancelledOrders = statusCount('CANCELLED');
    const rejectedOrders = statusCount('REJECTED');
    const todayRevenue = period === 'today' ? rangeRevenue : (await Order.aggregate([{ $match: { createdAt: { $gte: todayStart }, paymentStatus: 'SUCCESS', orderStatus: { $nin: ['CANCELLED', 'REJECTED'] } } }, { $group: { _id: null, amount: { $sum: '$totalAmount' } } }]))[0]?.amount || 0;

    res.json({
      success: true,
      analytics: {
        totalOrders,
        todayOrders,
        pendingOrders,
        completedOrders,
        totalProducts,
        totalRevenue,
        todayRevenue,
        period,
        periodOrders,
        periodRevenue: rangeRevenue,
        averageOrderValue: paidOrderCount ? Math.round((rangeRevenue / paidOrderCount) * 100) / 100 : 0,
        paidOrderCount,
        paymentBreakdown,
        paymentMethodBreakdown,
        statusBreakdown,
        cancelledOrders,
        rejectedOrders,
        cancellationRate: periodOrders ? Math.round(cancelledOrders / periodOrders * 10000) / 100 : 0,
        rejectionRate: periodOrders ? Math.round(rejectedOrders / periodOrders * 10000) / 100 : 0,
        revenueTrend: completeDailyTrend(revenueTrend, 'amount'),
        orderVolumeTrend: completeDailyTrend(orderVolumeTrend, 'orders'),
        ordersByHour,
        customerRepeatStats: customerRepeatStats[0] || { uniqueCustomers: 0, returningCustomers: 0 },
        couponPerformance,
        availableProducts,
        unavailableProducts,
        ordersByType,
        popularProducts,
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllOrders,
  updateOrderStatus,
  getAnalytics,
};
