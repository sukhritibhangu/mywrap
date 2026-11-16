const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Challenge = require('../models/GoogleLoginChallenge');
const identity = require('../services/googleIdentityService');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const userPayload = (user) => ({
  _id: user._id, name: user.name, email: user.email, phone: user.phone,
  emailVerified: Boolean(user.emailVerified), phoneVerified: Boolean(user.phoneVerified),
  role: user.role, pushToken: user.pushToken,
});

const googleConfig = (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, enabled: Boolean(identity.getClientId()), clientId: identity.getClientId(), domain: 'thapar.edu' });
};

const googleChallenge = async (_req, res, next) => {
  try {
    if (!identity.getClientId()) return fail(res, 503, 'Google sign-in is not configured yet. Please try again later.');
    const nonce = crypto.randomBytes(32).toString('base64url');
    const challenge = await Challenge.create({ nonceHash: hash(nonce), expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, challengeId: String(challenge._id), nonce });
  } catch (error) { next(error); }
};

const googleLogin = async (req, res, next) => {
  try {
    if (!identity.getClientId()) return fail(res, 503, 'Google sign-in is not configured yet. Please try again later.');
    const { credential, challengeId } = req.body || {};
    if (typeof credential !== 'string' || credential.length > 12000 || !credential
        || typeof challengeId !== 'string' || !/^[a-f\d]{24}$/i.test(challengeId)) {
      return fail(res, 400, 'Start Google sign-in again.');
    }
    let payload;
    try { payload = await identity.verifyGoogleIdentity(credential); }
    catch (error) {
      return fail(res, error.statusCode || 401, error.statusCode === 403 ? error.message : 'Google sign-in could not be verified. Please try again.');
    }
    if (typeof payload.nonce !== 'string' || !payload.nonce) return fail(res, 401, 'Start Google sign-in again.');
    const filter = { _id: challengeId, nonceHash: hash(payload.nonce), expiresAt: { $gt: new Date() } };
    const challenge = await Challenge.findOne(filter);
    if (!challenge) return fail(res, 401, 'Google sign-in expired or was already used. Please start again.');

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ googleSubject: payload.sub }).select('+googleSubject');
    if (!user) user = await User.findOne({ email }).select('+googleSubject');
    if (user?.role === 'admin') return fail(res, 403, 'Administrators must use the admin email and password sign-in.');
    if (user && ((user.googleSubject && user.googleSubject !== payload.sub) || user.email !== email)) {
      return fail(res, 409, 'This Google account conflicts with an existing account. Contact support.');
    }

    let phone;
    if (!user) {
      const rawPhone = String(req.body.phone || '').trim().replace(/[\s()-]/g, '');
      phone = /^\d{10}$/.test(rawPhone) ? `+91${rawPhone}` : rawPhone;
      if (!rawPhone) return res.json({ success: true, requiresPhone: true, name: String(payload.name || email.split('@')[0]).slice(0, 80), email });
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) return fail(res, 400, 'Enter a 10-digit Indian mobile number or a valid international number.');
      const digits = phone.replace(/\D/g, '');
      const variants = [phone, digits, ...(digits.startsWith('91') && digits.length === 12 ? [digits.slice(2)] : [])];
      if (await User.findOne({ phone: { $in: variants } })) return fail(res, 409, 'This phone number is already linked to an account. Contact support.');
    }

    // Atomically consume the nonce. Concurrent/replayed requests cannot issue another session.
    if (!await Challenge.findOneAndDelete(filter)) return fail(res, 401, 'Google sign-in was already used. Please start again.');
    if (user) {
      user.googleSubject = payload.sub;
      user.emailVerified = true;
      await user.save();
    } else {
      user = await User.create({
        name: String(payload.name || email.split('@')[0]).trim().slice(0, 80), email, phone,
        googleSubject: payload.sub, emailVerified: true, phoneVerified: false, role: 'student',
        // A random, undisclosed password preserves the legacy required schema field.
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12),
      });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d', algorithm: 'HS256' });
    return res.json({ success: true, token, user: userPayload(user) });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, 'This account was updated during sign-in. Please sign in again.');
    next(error);
  }
};

module.exports = { googleConfig, googleChallenge, googleLogin };
