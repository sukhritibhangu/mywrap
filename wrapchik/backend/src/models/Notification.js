const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['ORDER_UPDATE', 'PROMO', 'SYSTEM'],
      default: 'ORDER_UPDATE',
    },
    read: {
      type: Boolean,
      default: false,
    },
    dedupeKey: { type: String, unique: true, sparse: true },
    pushStatus: {
      type: String,
      enum: ['NOT_CONFIGURED', 'TICKET_ACCEPTED', 'TICKET_REJECTED', 'FAILED'],
      default: 'NOT_CONFIGURED',
    },
    pushTicketId: { type: String, default: null },
    pushError: { type: String, default: null, maxlength: 300 },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
