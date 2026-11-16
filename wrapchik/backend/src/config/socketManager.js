let io = null;

const init = (socketIo) => {
  io = socketIo;
};

const getIO = () => io;

const emitOrderUpdate = (order) => {
  if (!io) return;
  const userId = order.userId?._id || order.userId;
  io.to(`user_${userId}`).emit('order_updated', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    orderType: order.orderType,
    paymentStatus: order.paymentStatus,
    acceptedAt: order.acceptedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    completedAt: order.completedAt,
    pickedUpAt: order.pickedUpAt,
    deliveredAt: order.deliveredAt,
    servedAt: order.servedAt,
    rejectedAt: order.rejectedAt,
    cancelledAt: order.cancelledAt,
  });
  io.to('admin').emit('order_updated', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.orderStatus,
    orderType: order.orderType,
    paymentStatus: order.paymentStatus,
    acceptedAt: order.acceptedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    completedAt: order.completedAt,
    pickedUpAt: order.pickedUpAt,
    deliveredAt: order.deliveredAt,
    servedAt: order.servedAt,
    rejectedAt: order.rejectedAt,
    cancelledAt: order.cancelledAt,
  });
};

const emitNewOrder = (order) => {
  if (!io) return;
  io.to('admin').emit('new_order', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
  });
};

const emitNotification = (notification) => {
  if (!io || !notification) return;
  io.to(`user_${notification.userId}`).emit('notification_created', {
    notificationId: notification._id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    orderId: notification.orderId,
    createdAt: notification.createdAt,
  });
};

module.exports = { init, getIO, emitOrderUpdate, emitNewOrder, emitNotification };
