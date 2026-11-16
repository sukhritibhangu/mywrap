const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
}, { _id: false });

const emailOtpChallengeSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  purpose: { type: String, enum: ['LOGIN', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'SIGNUP'], required: true },
  pendingRegistration: { type: pendingRegistrationSchema, select: false },
  providerMessageId: { type: String, default: null },
  otpHash: { type: String, required: true, select: false },
  challengeNonce: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  resendAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  generation: { type: Number, default: 0 },
  state: { type: String, enum: ['SENDING', 'SENT', 'FAILED', 'CONSUMED'], required: true },
  consumed: { type: Boolean, default: false },
}, { timestamps: true });

// One current challenge per email and purpose. Updating this record atomically
// supersedes older codes and prevents simultaneous requests bypassing cooldown.
emailOtpChallengeSchema.index({ email: 1, purpose: 1 }, { unique: true });
emailOtpChallengeSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('EmailOtpChallenge', emailOtpChallengeSchema);
