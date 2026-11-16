const mongoose = require('mongoose');

const restaurantSettingsSchema = new mongoose.Schema(
  {
    acceptingOrders: {
      type: Boolean,
      default: true,
    },
    openTime: {
      type: String,
      default: '09:00',
    },
    closeTime: {
      type: String,
      default: '23:00',
    },
    busyStatus: {
      type: String,
      enum: ['NORMAL', 'BUSY', 'VERY_BUSY'],
      default: 'NORMAL',
    },
    deliveryEnabled: {
      type: Boolean,
      default: true,
    },
    dineInEnabled: {
      type: Boolean,
      default: true,
    },
    takeawayEnabled: {
      type: Boolean,
      default: true,
    },
    estimatedPrepMinutes: {
      type: Number,
      default: 15,
      min: 5,
    },
    scheduledPickupEnabled: { type: Boolean, default: false },
    pickupSlotMinutes: { type: Number, enum: [15, 30, 60], default: 15 },
    pickupSlotCapacity: { type: Number, min: 1, max: 100, default: 4 },
    deliveryFee: {
      type: Number,
      default: 20,
      min: 0,
    },
    upiId: { type: String, default: '', trim: true, maxlength: 120 },
    upiPayeeName: { type: String, default: '', trim: true, maxlength: 120 },
    upiQrImageUrl: { type: String, default: '', trim: true, maxlength: 1000 },
    upiEnabled: { type: Boolean, default: false },
    cashEnabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
restaurantSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('RestaurantSettings', restaurantSettingsSchema);
