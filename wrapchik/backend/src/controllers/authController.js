const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { demoAdminEnabled, demoAdminProfile } = require('../config/demoAdmin');
const { createEmailOtpService, normalizeEmail, isValidEmail, isThaparEmail } = require('../services/emailOtpService');

const OTP_TTL_SECONDS = 10 * 60;
const OTP_RESEND_SECONDS = 60;
const PHONE_ACCOUNT_CONFLICT_MESSAGE =
  'This phone number is linked to multiple accounts. Contact support to resolve the duplicate phone records.';
const emailOtpService = createEmailOtpService();

const normalizePhone = (phone) => {
  const value = String(phone || '').trim().replace(/[\s()-]/g, '');
  if (value.startsWith('+')) return value;

  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  return value;
};

const phoneLookupValues = (phone) => {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, '');
  const values = new Set([normalized, digits]);
  if (digits.startsWith('91') && digits.length === 12) {
    values.add(digits.slice(2));
    values.add(`91${digits.slice(2)}`);
  }
  return [...values];
};

const findUsersByPhone = (phone) =>
  User.find({ phone: { $in: phoneLookupValues(phone) } }).limit(2);

const isValidPhone = (phone) => /^\+[1-9]\d{7,14}$/.test(phone);
const isAccountVerified = (user) => Boolean(user?.emailVerified || user?.phoneVerified);
const isEmailOtpConfigured = () => Boolean(
  (process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD)
  || (process.env.RESEND_API_KEY && process.env.EMAIL_FROM && !/@resend\.dev\s*>?$/i.test(process.env.EMAIL_FROM))
)
  || (process.env.NODE_ENV === 'development' && process.env.LOCAL_OTP_ENABLED === 'true');
const otpUnavailable = (res) => res.status(503).json({
  success: false,
  message: 'Student email delivery is not configured. Set Gmail SMTP credentials in the backend and restart the service.',
});
const isStrongPassword = (password) =>
  typeof password === 'string' && /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password);

const generateToken = (id) => jwt.sign(
  { id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRE || '7d', algorithm: 'HS256' }
);

const authUserPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  emailVerified: Boolean(user.emailVerified),
  phone: user.phone,
  role: user.role,
  phoneVerified: Boolean(user.phoneVerified),
  pushToken: user.pushToken,
});

const otpRequestPayload = (delivery, message) => ({
  success: true,
  message,
  ...(delivery.developmentCode ? { developmentCode: delivery.developmentCode } : {}),
  expiresInSeconds: delivery.expiresInSeconds || OTP_TTL_SECONDS,
  resendAfterSeconds: delivery.resendAfterSeconds || OTP_RESEND_SECONDS,
});

const registerUser = async (req, res, next) => {
  try {
    console.info('[Auth OTP] Signup request received');
    const cleanName = String(req.body.name || '').trim();
    const cleanEmail = normalizeEmail(req.body.email);
    const cleanPhone = normalizePhone(req.body.phone);
    const password = req.body.password;

    if (!cleanName || !cleanEmail || !cleanPhone || !password) {
      console.info('[Auth OTP] Signup validation rejected', { reason: 'missing_fields' });
      return res.status(400).json({ success: false, message: 'Name, email, phone and password are required' });
    }
    if (cleanName.length > 80 || !isValidEmail(cleanEmail)) {
      console.info('[Auth OTP] Signup email validation', { valid: false, reason: 'invalid_email_or_name' });
      return res.status(400).json({ success: false, message: 'Enter a valid name and email address' });
    }
    if (!isThaparEmail(cleanEmail)) {
      console.info('[Auth OTP] Signup email validation', { valid: false, reason: 'college_domain_required' });
      return res.status(400).json({ success: false, message: 'Use your @thapar.edu email address to register.' });
    }
    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid phone number in international format or a 10-digit Indian number' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain 8–128 characters, at least one letter and one number' });
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      console.info('[Auth OTP] Signup duplicate check rejected', { field: 'email' });
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Sign in or contact support if it is unverified.' });
    }
    const existingPhones = await findUsersByPhone(cleanPhone);
    if (existingPhones.length) {
      console.info('[Auth OTP] Signup duplicate check rejected', { field: 'phone' });
      return res.status(409).json({
        success: false,
        message: existingPhones.length > 1
          ? PHONE_ACCOUNT_CONFLICT_MESSAGE
          : 'An account with this phone number already exists',
      });
    }

    const delivery = await emailOtpService.requestCode({
      email: cleanEmail,
      purpose: 'SIGNUP',
      pendingRegistration: {
        name: cleanName,
        phone: cleanPhone,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    console.info('[Auth OTP] Signup OTP request completed', { provider: delivery.provider });
    return res.status(201).json(otpRequestPayload(delivery, 'Check your email for a verification code.'));
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    if (!email || email.length > 254 || !password || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!validPassword || !isAccountVerified(user)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if ((req.adminLoginOnly || process.env.GOOGLE_CLIENT_ID) && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Students must continue with their Thapar Google account.' });
    }

    return res.json({ success: true, token: generateToken(user._id), user: authUserPayload(user) });
  } catch (error) {
    next(error);
  }
};

// Development-only one-click administrator demo. This never exposes a password
// to the client and is unavailable outside NODE_ENV=development.
const demoAdminStatus = (req, res) => {
  res.json({ success: true, enabled: demoAdminEnabled() });
};

const demoAdminLogin = async (req, res, next) => {
  if (!demoAdminEnabled()) {
    return res.status(404).json({ success: false, message: 'Demo admin sign-in is not enabled on this server.' });
  }
  try {
    const { email } = demoAdminProfile();
    const user = await User.findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: `Demo admin ${email} is not seeded. Restart the backend with ENABLE_ADMIN_DEMO=true in development.`,
      });
    }
    if (!isAccountVerified(user)) {
      return res.status(409).json({
        success: false,
        message: 'Demo admin exists but is not verified. Restart the backend so the demo seeder can repair it.',
      });
    }
    return res.json({ success: true, token: generateToken(user._id), user: authUserPayload(user) });
  } catch (error) {
    next(error);
  }
};

const sendOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const purpose = req.body.purpose || 'LOGIN';
    console.info('[Auth OTP] OTP request received', { purpose });
    if (!isValidEmail(email)) {
      console.info('[Auth OTP] OTP email validation', { valid: false });
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    console.info('[Auth OTP] OTP email validation', { valid: true, purpose });
    if (!['LOGIN', 'EMAIL_VERIFY', 'SIGNUP'].includes(purpose)) {
      return res.status(400).json({ success: false, message: 'Invalid verification purpose.' });
    }
    if (purpose === 'SIGNUP' && !isThaparEmail(email)) {
      return res.status(400).json({ success: false, message: 'Use your @thapar.edu email address to register.' });
    }
    if (!isEmailOtpConfigured()) return otpUnavailable(res);

    if (purpose === 'SIGNUP') {
      const challenge = await EmailOtpChallenge.findOne({ email, purpose: 'SIGNUP' })
        .select('+pendingRegistration +pendingRegistration.passwordHash');
      if (!challenge?.pendingRegistration) {
        return res.status(404).json({ success: false, message: 'Start registration again to request a new code.' });
      }
      const delivery = await emailOtpService.requestCode({
        email,
        purpose,
        pendingRegistration: challenge.pendingRegistration,
      });
      return res.json(otpRequestPayload(delivery, 'If registration is pending for this email, check its inbox for a verification code.'));
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.info('[Auth OTP] OTP account lookup', { found: false, purpose });
      return res.json({
        success: true,
        message: 'If an account matches this email, check its inbox for a verification code.',
        expiresInSeconds: OTP_TTL_SECONDS,
        resendAfterSeconds: OTP_RESEND_SECONDS,
      });
    }

    console.info('[Auth OTP] OTP account lookup', { found: true, purpose });
    const delivery = await emailOtpService.requestCode({ email, userId: user._id, purpose });
    return res.json(otpRequestPayload(delivery, 'If an account matches this email, check its inbox for a verification code.'));
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const purpose = req.body.purpose || 'LOGIN';
    const code = String(req.body.code || '').trim();
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address and 6-digit code.' });
    }
    if (!['LOGIN', 'EMAIL_VERIFY', 'SIGNUP'].includes(purpose)) {
      return res.status(400).json({ success: false, message: 'Invalid verification purpose.' });
    }

    const verified = await emailOtpService.verifyCode({ email, purpose, code });
    let user;
    if (purpose === 'SIGNUP') {
      const pending = verified.pendingRegistration;
      if (!pending) return res.status(401).json({ success: false, message: 'Invalid or expired verification code.' });
      const duplicatePhone = await findUsersByPhone(pending.phone);
      if (duplicatePhone.length) {
        return res.status(409).json({ success: false, message: 'This phone number is already linked to an account. Contact support.' });
      }
      user = await User.create({
        name: pending.name,
        email: verified.email,
        emailVerified: true,
        phone: pending.phone,
        passwordHash: pending.passwordHash,
        role: 'student',
        phoneVerified: false,
      });
    } else {
      user = await User.findOne({ _id: verified.userId, email: verified.email });
    }
    if (!user) return res.status(401).json({ success: false, message: 'Invalid or expired verification code.' });

    if (purpose !== 'SIGNUP') {
      user.emailVerified = true;
      await user.save();
    }
    console.info('[Auth OTP] OTP verification succeeded', { purpose });
    return res.json({ success: true, token: generateToken(user._id), user: authUserPayload(user) });
  } catch (error) {
    console.warn('[Auth OTP] OTP verification failed', { status: error.statusCode || error.status || 500 });
    next(error);
  }
};

const sendPasswordResetOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    if (!isEmailOtpConfigured()) return otpUnavailable(res);

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account matches this email, check its inbox for a recovery code.',
        expiresInSeconds: OTP_TTL_SECONDS,
        resendAfterSeconds: OTP_RESEND_SECONDS,
      });
    }

    const delivery = await emailOtpService.requestCode({ email, userId: user._id, purpose: 'PASSWORD_RESET' });
    return res.json(otpRequestPayload(delivery, 'If an account matches this email, check its inbox for a recovery code.'));
  } catch (error) {
    next(error);
  }
};

const resetPasswordWithOtp = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();
    const password = req.body.password;
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address and 6-digit recovery code.' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain 8–128 characters, at least one letter and one number.' });
    }

    const verified = await emailOtpService.verifyCode({ email, purpose: 'PASSWORD_RESET', code });
    const passwordHash = await bcrypt.hash(password, 12);
    const update = await User.updateOne(
      { _id: verified.userId, email: verified.email },
      { $set: { passwordHash, emailVerified: true } }
    );
    if (!update.matchedCount) return res.status(401).json({ success: false, message: 'This account is no longer available.' });
    return res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('favourites');
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, pushToken } = req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName || cleanName.length > 80) {
        return res.status(400).json({ success: false, message: 'Name must be between 1 and 80 characters' });
      }
      user.name = cleanName;
    }
    if (pushToken !== undefined) {
      if (pushToken !== null && (typeof pushToken !== 'string' || pushToken.length > 512 || !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(pushToken))) {
        return res.status(400).json({ success: false, message: 'Push token must be a valid token or null' });
      }
      if (pushToken) {
        await User.updateMany({ _id: { $ne: user._id }, pushToken }, { $set: { pushToken: null } });
      }
      user.pushToken = pushToken;
    }

    await user.save();
    res.json({ success: true, message: 'Profile updated successfully', user: authUserPayload(user) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  demoAdminLogin,
  demoAdminStatus,
  sendOtp,
  verifyOtp,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  getMe,
  updateProfile,
};
