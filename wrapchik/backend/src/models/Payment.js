const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gatewayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gateway: { type: String, enum: ['CASHFREE', 'UPI_QR', 'COUNTER', 'RAZORPAY', null], default: null },
    gatewayPaymentId: {
      type: String,
      default: null,
    },
    gatewayPaymentIds: {
      type: [String],
      default: [],
    },
    gatewaySignature: {
      type: String,
      default: null,
    },
    paymentSessionId: { type: String, default: null, select: false },
    upiTransactionReference: { type: String, default: null, maxlength: 120 },
    verificationReason: { type: String, default: null, maxlength: 500 },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
    },
    method: {
      type: String,
      default: 'Razorpay',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Payment', paymentSchema);
