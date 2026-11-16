const Notification = require('../models/Notification');
const User = require('../models/User');
const socketManager = require('../config/socketManager');

const isExpoPushToken = (token) => typeof token === 'string' && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);

const deliverPushTicket = async (notification, pushToken) => {
  if (!isExpoPushToken(pushToken)) return;

  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        to: pushToken,
        title: notification.title,
        body: notification.message,
        data: { type: notification.type, orderId: notification.orderId ? String(notification.orderId) : null },
        channelId: 'orders',
        sound: 'default',
      }),
    });
    const result = await response.json();
    const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (!response.ok || ticket?.status !== 'ok') {
      const reason = ticket?.message || result?.errors?.[0]?.message || `Expo push request failed (${response.status})`;
      await Notification.updateOne({ _id: notification._id }, { $set: { pushStatus: 'TICKET_REJECTED', pushError: String(reason).slice(0, 300) } });
      console.warn('[Push Notification] Provider rejected ticket:', reason);
      return;
    }

    // Expo acceptance is a ticket, not proof of device delivery. Receipts are not polled here.
    await Notification.updateOne({ _id: notification._id }, {
      $set: { pushStatus: 'TICKET_ACCEPTED', pushTicketId: ticket.id || null, pushError: null },
    });
  } catch (error) {
    await Notification.updateOne({ _id: notification._id }, {
      $set: { pushStatus: 'FAILED', pushError: String(error.message || 'Push request failed').slice(0, 300) },
    }).catch((updateError) => console.error('[Push Notification] Could not record provider error:', updateError.message));
    console.error('[Push Notification] Delivery request failed:', error.message);
  }
};

const createNotification = async (userId, title, message, type = 'ORDER_UPDATE', orderId = null, dedupeKey = null) => {
  try {
    let notification;
    try {
      notification = await Notification.create({ userId, title, message, type, orderId, ...(dedupeKey ? { dedupeKey } : {}) });
    } catch (error) {
      if (error.code !== 11000 || !dedupeKey) throw error;
      return Notification.findOne({ dedupeKey });
    }

    socketManager.emitNotification(notification);
    const recipient = await User.findById(userId).select('pushToken');
    if (isExpoPushToken(recipient?.pushToken)) {
      deliverPushTicket(notification, recipient.pushToken).catch((error) => console.error('[Push Notification] Unexpected delivery error:', error.message));
    }
    return notification;
  } catch (error) {
    console.error('[Notification Error]:', error.message);
    return null;
  }
};

const notifyAdmins = async (title, message, type, orderId, dedupeKey) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    return Promise.all(admins.map((admin) => createNotification(
      admin._id, title, message, type, orderId, `${dedupeKey}:admin:${admin._id}`
    )));
  } catch (error) {
    console.error('[Admin Notification Error]:', error.message);
    return [];
  }
};

const getMyNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Notification.countDocuments({ userId: req.user._id });
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ success: true, notifications, total, unreadCount, page, limit });
  } catch (error) { next(error); }
};

const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id }, { $set: { read: true } }, { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, notification });
  } catch (error) { next(error); }
};

const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) { next(error); }
};

module.exports = { getMyNotifications, markAsRead, markAllRead, createNotification, notifyAdmins };
