const mongoose = require('mongoose');

const pickupSlotSchema = new mongoose.Schema({
  startsAt: { type: Date, required: true, unique: true },
  endsAt: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1 },
  reservedCount: { type: Number, default: 0, min: 0 },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
}, { timestamps: true });

pickupSlotSchema.index({ endsAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('PickupSlot', pickupSlotSchema);
