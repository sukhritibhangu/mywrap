const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, maxlength: 128 },
  event: { type: String, required: true, maxlength: 100 },
  payloadHash: { type: String, required: true, maxlength: 64 },
  gatewayOrderId: { type: String, default: null, maxlength: 80 },
  payment: {
    id: { type: String, default: null, maxlength: 80 },
    order_id: { type: String, default: null, maxlength: 80 },
    amount: { type: Number, default: null },
    currency: { type: String, default: null, maxlength: 8 },
    status: { type: String, default: null, maxlength: 32 },
    method: { type: String, default: null, maxlength: 80 },
    created_at: { type: Number, default: null },
  },
  status: { type: String, enum: ['RECEIVED', 'PROCESSING', 'PROCESSED'], default: 'RECEIVED' },
  attempts: { type: Number, default: 0 },
  leaseUntil: { type: Date, default: null },
  receivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null },
  lastError: { type: String, default: null, maxlength: 240 },
}, { timestamps: true });

webhookEventSchema.index({ status: 1, leaseUntil: 1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
