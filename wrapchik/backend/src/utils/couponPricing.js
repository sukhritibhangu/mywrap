const Coupon = require('../models/Coupon');
const mongoose = require('mongoose');

const couponError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const couponDiscount = (coupon, subtotal) => {
  let discount = coupon.discountType === 'PERCENT' ? subtotal * coupon.discountValue / 100 : coupon.discountValue;
  if (coupon.maxDiscountAmount != null) discount = Math.min(discount, coupon.maxDiscountAmount);
  return Math.round(Math.min(subtotal, discount) * 100) / 100;
};

const getEligibleCoupon = async (rawCode, userId, subtotal) => {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw couponError('Enter a valid coupon code.');
  const now = new Date();
  const coupon = await Coupon.findOne({ code, active: true, startsAt: { $lte: now }, expiresAt: { $gt: now } }).select('+redemptions');
  if (!coupon) throw couponError('This coupon is not active or has expired.');
  if (coupon.redemptionCount >= coupon.usageLimit) throw couponError('This coupon has reached its usage limit.');
  if (Number(subtotal) < coupon.minOrderValue) throw couponError(`This coupon requires a minimum item subtotal of ₹${coupon.minOrderValue}.`);
  const userIdString = String(userId);
  const userUsage = coupon.redemptions.filter(entry => String(entry.userId) === userIdString).length;
  if (userUsage >= coupon.perCustomerLimit) throw couponError('You have already used this coupon the maximum number of times.');
  const discountAmount = couponDiscount(coupon, Number(subtotal));
  return { coupon, code, discountAmount };
};

const previewCoupon = async (rawCode, userId, subtotal) => {
  const result = await getEligibleCoupon(rawCode, userId, subtotal);
  return { couponId: result.coupon._id, code: result.code, description: result.coupon.description, discountType: result.coupon.discountType, discountValue: result.coupon.discountValue, minOrderValue: result.coupon.minOrderValue, discountAmount: result.discountAmount };
};

const reserveCoupon = async (rawCode, userId, orderId, subtotal) => {
  const result = await getEligibleCoupon(rawCode, userId, subtotal);
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const updated = await Coupon.findOneAndUpdate({
    _id: result.coupon._id,
    active: true,
    startsAt: { $lte: new Date() },
    expiresAt: { $gt: new Date() },
    $expr: { $and: [
      { $lt: ['$redemptionCount', '$usageLimit'] },
      { $lt: [
        { $size: { $filter: { input: { $ifNull: ['$redemptions', []] }, as: 'redemption', cond: { $eq: ['$$redemption.userId', userObjectId] } } } },
        '$perCustomerLimit',
      ] },
    ] },
  }, {
    $inc: { redemptionCount: 1 },
    $push: { redemptions: { userId: userObjectId, orderId, status: 'RESERVED', createdAt: new Date() } },
  }, { new: true });
  if (!updated) throw couponError('Coupon eligibility changed. Review the code and try again.', 409);
  return { couponId: updated._id, code: result.code, discountAmount: result.discountAmount };
};

const releaseCouponForOrder = async order => {
  if (!order?.couponId) return false;
  const updated = await Coupon.findOneAndUpdate(
    { _id: order.couponId, redemptions: { $elemMatch: { orderId: order._id, status: 'RESERVED' } } },
    { $inc: { redemptionCount: -1 }, $pull: { redemptions: { orderId: order._id, status: 'RESERVED' } } },
    { new: true }
  );
  return Boolean(updated);
};

const markCouponRedeemed = async order => {
  if (!order?.couponId) return false;
  const updated = await Coupon.updateOne(
    { _id: order.couponId, redemptions: { $elemMatch: { orderId: order._id, status: 'RESERVED' } } },
    { $set: { 'redemptions.$.status': 'REDEEMED', 'redemptions.$.redeemedAt': new Date() } }
  );
  return updated.modifiedCount > 0;
};

module.exports = { previewCoupon, reserveCoupon, releaseCouponForOrder, markCouponRedeemed };
