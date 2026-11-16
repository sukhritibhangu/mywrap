const crypto = require('crypto');
const EmailOtpChallenge = require('../models/EmailOtpChallenge');
const { createResendEmailService } = require('./resendEmailService');
const { createGmailSmtpEmailService } = require('./gmailSmtpEmailService');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const createOtpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isThaparEmail = (email) => {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@thapar\.edu$/.test(normalized);
};
const isValidEmail = (email) => typeof email === 'string'
  && email.length <= 254
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const hashOtp = (email, purpose, nonce, code, secret = process.env.JWT_SECRET) => {
  if (!secret) throw createOtpError('OTP security is not configured.', 503);
  return crypto.createHmac('sha256', secret)
    .update(`wrapchik-email-otp:v1:${email}:${purpose}:${nonce}:${code}`)
    .digest('hex');
};

const sameHash = (left, right) => {
  if (!/^[a-f0-9]{64}$/i.test(left || '') || !/^[a-f0-9]{64}$/i.test(right || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
};

const isDuplicateKey = (error) => error?.code === 11000;

const createEmailOtpService = ({
  Challenge = EmailOtpChallenge,
  emailService,
  getEnv = () => process.env,
  now = () => Date.now(),
  randomInt = crypto.randomInt,
  randomUUID = crypto.randomUUID,
} = {}) => {
  const resendEmailService = createResendEmailService({ getEnv });
  const gmailSmtpEmailService = createGmailSmtpEmailService({ getEnv });
  const requestCode = async ({ email: rawEmail, userId, purpose, pendingRegistration }) => {
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) throw createOtpError('Enter a valid email address.', 400);
    if (!['LOGIN', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'SIGNUP'].includes(purpose)) {
      throw createOtpError('Invalid verification purpose.', 400);
    }
    if (purpose === 'SIGNUP') {
      if (!isThaparEmail(email)) throw createOtpError('Use your @thapar.edu email address to register.', 400);
      if (!pendingRegistration?.name || !pendingRegistration?.phone || !pendingRegistration?.passwordHash) {
        throw createOtpError('Registration details are incomplete.', 400);
      }
    } else if (!userId) {
      throw createOtpError('The account could not be verified.', 404);
    }

    const env = getEnv();
    const localMode = env.NODE_ENV === 'development' && env.LOCAL_OTP_ENABLED === 'true';
    const smtpConfigured = Boolean(env.SMTP_USER && env.SMTP_APP_PASSWORD);
    const resendTestSender = /@resend\.dev\s*>?$/i.test(env.EMAIL_FROM || '');
    const resendConfigured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM && !resendTestSender);
    if (!localMode && !emailService && !smtpConfigured && !resendConfigured) {
      console.warn('[Auth OTP] Email provider not invoked', { purpose, reason: 'missing_smtp_or_verified_resend' });
      throw createOtpError('Gmail SMTP is not configured. Set SMTP_USER and SMTP_APP_PASSWORD in backend/.env, then restart the backend.', 503);
    }
    const provider = smtpConfigured ? 'gmail' : 'resend';
    const selectedEmailService = emailService || (provider === 'gmail' ? gmailSmtpEmailService : resendEmailService);

    await Challenge.init();
    const timestamp = now();
    const expiresAt = new Date(timestamp + OTP_TTL_MS);
    const resendAt = new Date(timestamp + OTP_RESEND_COOLDOWN_MS);
    const code = String(randomInt(100000, 1000000));
    const challengeNonce = randomUUID();
    const otpHash = hashOtp(email, purpose, challengeNonce, code, env.JWT_SECRET);

    let challenge;
    try {
      const fields = {
        email,
        purpose,
        otpHash,
        challengeNonce,
        expiresAt,
        resendAt,
        attempts: 0,
        state: 'SENDING',
        consumed: false,
        providerMessageId: null,
      };
      if (userId) fields.userId = userId;
      if (pendingRegistration) fields.pendingRegistration = pendingRegistration;
      const clear = {};
      if (!userId) clear.userId = 1;
      if (!pendingRegistration) clear.pendingRegistration = 1;
      challenge = await Challenge.findOneAndUpdate(
        {
          email,
          purpose,
          $or: [
            { resendAt: { $lte: new Date(timestamp) } },
            { state: 'FAILED' },
            { resendAt: { $exists: false } },
          ],
        },
        {
          $set: fields,
          ...(Object.keys(clear).length ? { $unset: clear } : {}),
          $inc: { generation: 1 },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (isDuplicateKey(error)) throw createOtpError('Please wait 60 seconds before requesting another code.', 429);
      throw error;
    }

    if (!challenge) throw createOtpError('A verification request is already being processed.', 429);

    if (localMode) {
      console.info('[Auth OTP] Local development OTP selected', { purpose });
      const sent = await Challenge.updateOne(
        { _id: challenge._id, challengeNonce, state: 'SENDING', consumed: false },
        { $set: { state: 'SENT' } }
      );
      if (!sent.matchedCount) throw createOtpError('The verification request expired. Request another code.', 409);
      return { provider: 'local', developmentCode: code, expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 };
    }

    try {
      console.info('[Auth OTP] Email service invoked', { provider, purpose });
      const providerMessage = await selectedEmailService.sendOtpEmail({ to: email, code, purpose });
      const sent = await Challenge.updateOne(
        { _id: challenge._id, challengeNonce, state: 'SENDING', consumed: false },
        { $set: { state: 'SENT', providerMessageId: providerMessage?.id || null } }
      );
      if (!sent.matchedCount) throw createOtpError('The verification request expired. Request another code.', 409);
    } catch (error) {
      const unset = { otpHash: 1, challengeNonce: 1, userId: 1 };
      if (purpose !== 'SIGNUP') unset.pendingRegistration = 1;
      await Challenge.updateOne(
        { _id: challenge._id, challengeNonce, state: 'SENDING', consumed: false },
        { $set: { state: 'FAILED', consumed: true, resendAt: new Date(now()) }, $unset: unset }
      );
      const message = error.statusCode === 503
        ? error.message
        : provider === 'gmail'
          ? 'The verification email could not be sent through Gmail. Check the Gmail app password and server network access, then try again.'
          : 'The verification email could not be sent through Resend. Check the sender configuration and try again.';
      throw createOtpError(message, error.statusCode || 502);
    }

    return { provider, expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 };
  };

  const verifyCode = async ({ email: rawEmail, purpose, code: rawCode }) => {
    const email = normalizeEmail(rawEmail);
    const code = String(rawCode || '').trim();
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      throw createOtpError('Enter a valid email address and 6-digit code.', 400);
    }
    if (!['LOGIN', 'EMAIL_VERIFY', 'PASSWORD_RESET', 'SIGNUP'].includes(purpose)) {
      throw createOtpError('Invalid verification purpose.', 400);
    }
    if (purpose === 'SIGNUP' && !isThaparEmail(email)) {
      throw createOtpError('Use your @thapar.edu email address to register.', 400);
    }

    const timestamp = new Date(now());
    const challenge = await Challenge.findOne({
      email,
      purpose,
      state: 'SENT',
      consumed: false,
      expiresAt: { $gt: timestamp },
    }).select('+otpHash +challengeNonce +pendingRegistration +pendingRegistration.passwordHash');
    if (!challenge) throw createOtpError('Invalid or expired verification code. Request a new code.', 401);

    const claimed = await Challenge.findOneAndUpdate(
      { _id: challenge._id, state: 'SENT', consumed: false, expiresAt: { $gt: timestamp }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    ).select('+otpHash +challengeNonce +pendingRegistration +pendingRegistration.passwordHash');
    if (!claimed) {
      await Challenge.updateOne(
        { _id: challenge._id, state: 'SENT', consumed: false, attempts: { $gte: OTP_MAX_ATTEMPTS } },
        { $set: { state: 'CONSUMED', consumed: true }, $unset: { otpHash: 1, challengeNonce: 1 } }
      );
      throw createOtpError('Too many incorrect codes. Request a new verification code.', 429);
    }

    const expectedHash = hashOtp(email, purpose, claimed.challengeNonce, code, getEnv().JWT_SECRET);
    if (!sameHash(claimed.otpHash, expectedHash)) {
      if (claimed.attempts >= OTP_MAX_ATTEMPTS) {
        await Challenge.updateOne(
          { _id: claimed._id, challengeNonce: claimed.challengeNonce, state: 'SENT', consumed: false },
          { $set: { state: 'CONSUMED', consumed: true }, $unset: { otpHash: 1, challengeNonce: 1 } }
        );
      }
      throw createOtpError('Invalid or expired verification code.', 401);
    }

    const consumed = await Challenge.findOneAndUpdate(
      { _id: claimed._id, challengeNonce: claimed.challengeNonce, state: 'SENT', consumed: false, attempts: claimed.attempts, expiresAt: { $gt: new Date(now()) } },
      { $set: { state: 'CONSUMED', consumed: true }, $unset: { otpHash: 1, challengeNonce: 1, pendingRegistration: 1 } },
      { new: true }
    );
    if (!consumed) throw createOtpError('Invalid or expired verification code. Request a new code.', 401);

    if (purpose === 'SIGNUP') {
      if (!claimed.pendingRegistration?.name || !claimed.pendingRegistration?.phone || !claimed.pendingRegistration?.passwordHash) {
        throw createOtpError('Registration verification could not be completed. Request a new code.', 409);
      }
      return { email, purpose, pendingRegistration: claimed.pendingRegistration };
    }
    return { userId: claimed.userId, email, purpose };
  };

  return { requestCode, verifyCode };
};

module.exports = {
  createEmailOtpService,
  normalizeEmail,
  isThaparEmail,
  isValidEmail,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
};
