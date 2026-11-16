const mongoose = require('mongoose');

const redemptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  status: { type: String, enum: ['RESERVED', 'REDEEMED'], default: 'RESERVED' },
  createdAt: { type: Date, default: Date.now },
  redeemedAt: { type: Date, default: null },
}, { _id: false });

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, minlength: 3, maxlength: 32 },
  description: { type: String, trim: true, maxlength: 240, default: '' },
  discountType: { type: String, enum: ['PERCENT', 'FIXED'], required: true },
  discountValue: { type: Number, required: true, min: 0.01 },
  minOrderValue: { type: Number, default: 0, min: 0 },
  maxDiscountAmount: { type: Number, default: null, min: 0 },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  usageLimit: { type: Number, required: true, min: 1, max: 10000 },
  perCustomerLimit: { type: Number, default: 1, min: 1, max: 100 },
  active: { type: Boolean, default: true },
  redemptionCount: { type: Number, default: 0, min: 0 },
  redemptions: { type: [redemptionSchema], default: [] },
}, { timestamps: true });

couponSchema.index({ active: 1, startsAt: 1, expiresAt: 1 });
module.exports = mongoose.model('Coupon', couponSchema);
