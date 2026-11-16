const RestaurantSettings = require('../models/RestaurantSettings');
const { isValidUpiId } = require('../utils/upiPayment');

const getSettings = async (req, res, next) => {
  try {
    const settings = await RestaurantSettings.getSettings();
    res.json({ success: true, settings });
  } catch (error) { next(error); }
};

const updateSettings = async (req, res, next) => {
  try {
    const body = req.body || {};
    for (const key of ['upiId', 'upiPayeeName', 'upiQrImageUrl']) {
      if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > (key === 'upiQrImageUrl' ? 1000 : 120))) return res.status(400).json({ success: false, message: `${key} must be a string within the allowed length` });
    }
    if (body.upiId !== undefined && body.upiId && !isValidUpiId(body.upiId)) return res.status(400).json({ success: false, message: 'Enter a valid UPI ID.' });
    if (body.upiQrImageUrl) {
      try {
        const url = new URL(body.upiQrImageUrl);
        if (url.protocol !== 'https:') throw new Error('https required');
      } catch { return res.status(400).json({ success: false, message: 'UPI QR image URL must be a valid HTTPS URL.' }); }
    }
    const { acceptingOrders, openTime, closeTime, busyStatus, deliveryEnabled, dineInEnabled, takeawayEnabled, estimatedPrepMinutes, deliveryFee } = body;
    for (const key of ['acceptingOrders', 'deliveryEnabled', 'dineInEnabled', 'takeawayEnabled', 'upiEnabled', 'cashEnabled']) {
      if (body[key] !== undefined && typeof body[key] !== 'boolean') return res.status(400).json({ success: false, message: `${key} must be a boolean` });
    }
    if (body.scheduledPickupEnabled !== undefined && typeof body.scheduledPickupEnabled !== 'boolean') return res.status(400).json({ success: false, message: 'scheduledPickupEnabled must be a boolean' });
    if (body.pickupSlotMinutes !== undefined && ![15, 30, 60].includes(Number(body.pickupSlotMinutes))) return res.status(400).json({ success: false, message: 'Pickup slot interval must be 15, 30, or 60 minutes' });
    if (body.pickupSlotCapacity !== undefined && (!Number.isInteger(Number(body.pickupSlotCapacity)) || Number(body.pickupSlotCapacity) < 1 || Number(body.pickupSlotCapacity) > 100)) return res.status(400).json({ success: false, message: 'Pickup slot capacity must be an integer from 1 to 100' });
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    for (const key of ['openTime', 'closeTime']) {
      if (body[key] !== undefined && (typeof body[key] !== 'string' || !timePattern.test(body[key]))) return res.status(400).json({ success: false, message: `${key} must use 24-hour HH:mm format` });
    }
    if (busyStatus !== undefined && !['NORMAL', 'BUSY', 'VERY_BUSY'].includes(busyStatus)) return res.status(400).json({ success: false, message: 'Invalid busy status' });
    if (estimatedPrepMinutes !== undefined && (!Number.isInteger(Number(estimatedPrepMinutes)) || Number(estimatedPrepMinutes) < 5 || Number(estimatedPrepMinutes) > 240)) return res.status(400).json({ success: false, message: 'Preparation time must be between 5 and 240 minutes' });
    if (deliveryFee !== undefined && (!Number.isFinite(Number(deliveryFee)) || Number(deliveryFee) < 0)) return res.status(400).json({ success: false, message: 'Delivery fee must be a non-negative number' });
    const settings = await RestaurantSettings.getSettings();
    const proposedUpiEnabled = body.upiEnabled ?? settings.upiEnabled;
    const proposedUpiId = body.upiId ?? settings.upiId;
    const proposedPayee = body.upiPayeeName ?? settings.upiPayeeName;
    if (proposedUpiEnabled && (!isValidUpiId(proposedUpiId) || !proposedPayee?.trim())) return res.status(400).json({ success: false, message: 'A valid outlet UPI ID and payee name are required before enabling UPI.' });
    const proposedOpen = body.openTime ?? settings.openTime;
    const proposedClose = body.closeTime ?? settings.closeTime;
    if (proposedOpen >= proposedClose) return res.status(400).json({ success: false, message: 'Closing time must be later than opening time' });
    const allowedFields = ['acceptingOrders', 'openTime', 'closeTime', 'busyStatus', 'deliveryEnabled', 'dineInEnabled', 'takeawayEnabled', 'estimatedPrepMinutes', 'deliveryFee', 'scheduledPickupEnabled', 'pickupSlotMinutes', 'pickupSlotCapacity', 'upiId', 'upiPayeeName', 'upiQrImageUrl', 'upiEnabled', 'cashEnabled'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) settings[field] = body[field];
    }
    await settings.save();
    res.json({ success: true, message: 'Restaurant settings updated', settings });
  } catch (error) { next(error); }
};

module.exports = { getSettings, updateSettings };
