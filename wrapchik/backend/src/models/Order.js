const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  name: {
    type: String,
    required: true,
  },
  priceAtPurchase: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  customizations: [
    {
      name: String,
      price: Number,
    },
  ],
  itemTotal: {
    type: Number,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerSnapshot: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    taxAndFees: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['COUNTER', 'UPI_QR', 'CASHFREE', 'RAZORPAY'],
      default: 'COUNTER',
    },
    pickupLocation: {
      type: String,
      default: 'Wrapchik Campus Counter, Student Activity Center',
    },
    pickupTimeSlot: {
      type: String,
      default: 'Immediate (15-20 mins)',
    },
    scheduledPickupAt: { type: Date, default: null },
    pickupSlotId: { type: mongoose.Schema.Types.ObjectId, ref: 'PickupSlot', default: null },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    couponCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0, min: 0 },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    paymentCreateLockToken: { type: String, select: false },
    paymentCreateLockUntil: { type: Date, select: false },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
    },
    orderStatus: {
      type: String,
      enum: [
        'PLACED',
        'ACCEPTED',
        'PREPARING',
        'READY',
        'COMPLETED',
        'PICKED_UP',
        'DELIVERED',
        'SERVED',
        'REJECTED',
        'CANCELLED',
      ],
      default: 'PLACED',
    },
    acceptedAt: { type: Date, default: null },
    preparingAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    servedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    rejectionReason: {
      type: String,
      default: null,
    },
    orderType: { type: String, enum: ['DELIVERY', 'TAKEAWAY', 'DINE_IN'], default: 'TAKEAWAY' },
    hostel: { type: String, default: null },
    roomNumber: { type: String, default: null },
    deliveryInstructions: { type: String, default: null },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
    deliveryStatus: { type: String, enum: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED', null], default: null },
    estimatedPrepTime: { type: Number, default: 15 },
    estimatedDeliveryTime: { type: Date, default: null },
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    groupOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupOrder', default: null },
    // Enforce uniqueness for real keys while excluding legacy null/missing values.
    idempotencyKey: {
      type: String,
      index: {
        name: 'idempotencyKey_uniqueStrings',
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      },
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ paymentStatus: 1, orderStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
