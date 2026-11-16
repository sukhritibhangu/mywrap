const RestaurantSettings = require('../models/RestaurantSettings');
const PickupSlot = require('../models/PickupSlot');

const IST_OFFSET_MS = 330 * 60 * 1000;
const fail = (message, status = 400) => Object.assign(new Error(message), { statusCode: status });

const slotStartsForSettings = (settings, now = new Date()) => {
  if (!settings.scheduledPickupEnabled || !settings.takeawayEnabled || !settings.acceptingOrders) return [];
  const [openHour, openMinute] = settings.openTime.split(':').map(Number);
  const [closeHour, closeMinute] = settings.closeTime.split(':').map(Number);
  const openAt = openHour * 60 + openMinute;
  const closeAt = closeHour * 60 + closeMinute;
  if (closeAt <= openAt) return [];
  const interval = Number(settings.pickupSlotMinutes) || 15;
  const minimumStart = now.getTime() + Math.max(0, Number(settings.estimatedPrepMinutes) || 0) * 60000;
  const indiaToday = new Date(now.getTime() + IST_OFFSET_MS);
  const starts = [];
  for (let day = 0; day < 7; day += 1) {
    const dayDate = new Date(Date.UTC(indiaToday.getUTCFullYear(), indiaToday.getUTCMonth(), indiaToday.getUTCDate() + day));
    for (let minute = openAt; minute + interval <= closeAt; minute += interval) {
      const utc = Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), Math.floor(minute / 60), minute % 60) - IST_OFFSET_MS;
      if (utc >= minimumStart) starts.push(new Date(utc));
    }
  }
  return starts;
};

const listPickupSlots = async (req, res, next) => {
  try {
    const settings = await RestaurantSettings.getSettings();
    const starts = slotStartsForSettings(settings);
    if (!starts.length) return res.json({ success: true, slots: [], settings: { scheduledPickupEnabled: settings.scheduledPickupEnabled, pickupSlotMinutes: settings.pickupSlotMinutes } });
    const startMs = starts.map(date => date.getTime());
    const stored = await PickupSlot.find({ startsAt: { $in: starts } }).select('startsAt endsAt capacity reservedCount').lean();
    const byStart = new Map(stored.map(slot => [new Date(slot.startsAt).getTime(), slot]));
    const slots = starts.map(startsAt => {
      const saved = byStart.get(startsAt.getTime());
      const capacity = saved?.capacity || settings.pickupSlotCapacity;
      const reservedCount = saved?.reservedCount || 0;
      return { startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + settings.pickupSlotMinutes * 60000).toISOString(), capacity, availableCount: Math.max(0, capacity - reservedCount) };
    }).filter(slot => slot.availableCount > 0);
    res.json({ success: true, slots, settings: { scheduledPickupEnabled: settings.scheduledPickupEnabled, pickupSlotMinutes: settings.pickupSlotMinutes }, generatedCount: startMs.length });
  } catch (error) { next(error); }
};

const reservePickupSlot = async (startsAtValue, orderId) => {
  const startsAt = new Date(startsAtValue);
  if (!Number.isFinite(startsAt.getTime())) throw fail('Choose a valid scheduled pickup slot.');
  const settings = await RestaurantSettings.getSettings();
  if (!settings.scheduledPickupEnabled || !settings.takeawayEnabled) throw fail('Scheduled pickup is currently unavailable.', 409);
  if (!slotStartsForSettings(settings).some(slot => slot.getTime() === startsAt.getTime())) throw fail('That pickup slot is outside current operating hours or has passed.', 409);
  const endsAt = new Date(startsAt.getTime() + settings.pickupSlotMinutes * 60000);
  try {
    const slot = await PickupSlot.findOneAndUpdate(
      { startsAt, $expr: { $lt: ['$reservedCount', '$capacity'] } },
      { $inc: { reservedCount: 1 }, $addToSet: { orderIds: orderId }, $setOnInsert: { endsAt, capacity: settings.pickupSlotCapacity } },
      { new: true, upsert: true, runValidators: true }
    );
    return slot;
  } catch (error) {
    if (error.code === 11000) throw fail('That pickup slot just filled. Choose another available time.', 409);
    throw error;
  }
};

const releasePickupSlot = async order => {
  if (!order?.pickupSlotId) return false;
  const updated = await PickupSlot.findOneAndUpdate(
    { _id: order.pickupSlotId, reservedCount: { $gt: 0 }, orderIds: order._id },
    { $inc: { reservedCount: -1 }, $pull: { orderIds: order._id } },
    { new: true }
  );
  return Boolean(updated);
};

module.exports = { listPickupSlots, reservePickupSlot, releasePickupSlot, slotStartsForSettings };
