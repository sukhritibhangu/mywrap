const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmailOtpService } = require('../src/services/emailOtpService');
const { createResendEmailService } = require('../src/services/resendEmailService');

const snapshot = (value) => value && ({ ...value, expiresAt: value.expiresAt && new Date(value.expiresAt), resendAt: value.resendAt && new Date(value.resendAt) });
const comparisonMatches = (actual, expected) => {
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    if ('$lte' in expected) return new Date(actual).getTime() <= expected.$lte.getTime();
    if ('$lt' in expected) return actual < expected.$lt;
    if ('$gte' in expected) return actual >= expected.$gte;
    if ('$gt' in expected) return new Date(actual).getTime() > expected.$gt.getTime();
    if ('$exists' in expected) return (actual !== undefined) === expected.$exists;
  }
  if (expected instanceof Date) return new Date(actual).getTime() === expected.getTime();
  return actual === expected;
};

class FakeChallenge {
  static rows = [];
  static nextId = 0;
  static async init() {}

  static matches(row, filter) {
    return Object.entries(filter).every(([key, expected]) => {
      if (key === '$or') return expected.some((condition) => FakeChallenge.matches(row, condition));
      return comparisonMatches(row[key], expected);
    });
  }

  static apply(row, update) {
    Object.assign(row, update.$set || {});
    for (const [key, amount] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + amount;
    for (const key of Object.keys(update.$unset || {})) delete row[key];
  }

  static findOneAndUpdate(filter, update, options = {}) {
    let row = this.rows.find((candidate) => this.matches(candidate, filter));
    if (!row && options.upsert) {
      const duplicate = this.rows.some((candidate) => candidate.email === filter.email && candidate.purpose === filter.purpose);
      if (duplicate) return Object.assign(Promise.reject(Object.assign(new Error('duplicate key'), { code: 11000 })), { select: () => Promise.reject(Object.assign(new Error('duplicate key'), { code: 11000 })) });
      row = { _id: `challenge-${++this.nextId}`, email: filter.email, purpose: filter.purpose, attempts: 0, generation: 0, consumed: false };
      this.rows.push(row);
    }
    if (!row) return Object.assign(Promise.resolve(null), { select: () => Promise.resolve(null) });
    this.apply(row, update);
    const result = snapshot(row);
    return Object.assign(Promise.resolve(result), { select: () => Promise.resolve(result) });
  }

  static findOne(filter) {
    const result = snapshot(this.rows.find((candidate) => this.matches(candidate, filter)) || null);
    return Object.assign(Promise.resolve(result), { select: () => Promise.resolve(result) });
  }

  static async updateOne(filter, update) {
    const row = this.rows.find((candidate) => this.matches(candidate, filter));
    if (!row) return { matchedCount: 0 };
    this.apply(row, update);
    return { matchedCount: 1 };
  }
}

const resetFake = () => {
  FakeChallenge.rows = [];
  FakeChallenge.nextId = 0;
};

const env = (values = {}) => ({
  NODE_ENV: 'development',
  LOCAL_OTP_ENABLED: 'true',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  EMAIL_FROM: 'Wrapchik <auth@verified.example>',
  ...values,
});

const localService = ({ nowRef = { value: 1_800_000_000_000 }, randomCodes = [123456, 654321], emailService } = {}) => {
  let codeIndex = 0;
  let nonceIndex = 0;
  return createEmailOtpService({
    Challenge: FakeChallenge,
    emailService: emailService || { sendOtpEmail: async () => ({ id: 'mock-email-id' }) },
    getEnv: () => env(),
    now: () => nowRef.value,
    randomInt: () => randomCodes[codeIndex++ % randomCodes.length],
    randomUUID: () => `nonce-${++nonceIndex}`,
  });
};

test('OTP is generated as six digits, stored only as an HMAC, and expires in ten minutes', async () => {
  resetFake();
  const service = localService();
  const result = await service.requestCode({ email: ' Student@Example.com ', userId: 'user-1', purpose: 'LOGIN' });
  const challenge = FakeChallenge.rows[0];
  assert.equal(result.developmentCode, '123456');
  assert.equal(result.expiresInSeconds, 600);
  assert.equal(result.resendAfterSeconds, 60);
  assert.equal(challenge.email, 'student@example.com');
  assert.match(challenge.otpHash, /^[a-f0-9]{64}$/);
  assert.notEqual(challenge.otpHash, '123456');
  assert.equal(challenge.state, 'SENT');
  assert.equal(challenge.providerMessageId, null);
  assert.equal(challenge.expiresAt.getTime() - 1_800_000_000_000, 600_000);
});

test('email validation rejects malformed or oversized addresses', async () => {
  resetFake();
  const service = localService();
  await assert.rejects(service.requestCode({ email: 'bad-email', userId: 'user-1', purpose: 'LOGIN' }), { statusCode: 400 });
  await assert.rejects(service.requestCode({ email: `${'a'.repeat(250)}@example.com`, userId: 'user-1', purpose: 'LOGIN' }), { statusCode: 400 });
});

test('signup OTP accepts only the exact Thapar domain after normalization', async () => {
  resetFake();
  const service = localService();
  const pendingRegistration = { name: 'Student', phone: '+911234567890', passwordHash: 'bcrypt-hash' };
  const result = await service.requestCode({ email: ' Student@THAPAR.EDU ', purpose: 'SIGNUP', pendingRegistration });
  assert.equal(result.provider, 'local');
  assert.equal(FakeChallenge.rows[0].email, 'student@thapar.edu');
  assert.equal(FakeChallenge.rows[0].pendingRegistration.passwordHash, 'bcrypt-hash');
  for (const email of ['student@dept.thapar.edu', 'student@thapar.edu.example', 'student@gmail.com']) {
    await assert.rejects(service.requestCode({ email, purpose: 'SIGNUP', pendingRegistration }), { statusCode: 400 });
  }
});

test('resend cooldown blocks another request and a later code supersedes the previous code', async () => {
  resetFake();
  const nowRef = { value: 1_800_000_000_000 };
  const service = localService({ nowRef, randomCodes: [123456, 111111, 654321] });
  await service.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' });
  await assert.rejects(service.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' }), { statusCode: 429 });
  nowRef.value += 60_000;
  const next = await service.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' });
  assert.equal(next.developmentCode, '654321');
  await assert.rejects(service.verifyCode({ email: 'student@example.com', purpose: 'LOGIN', code: '123456' }), { statusCode: 401 });
  assert.deepEqual(await service.verifyCode({ email: 'student@example.com', purpose: 'LOGIN', code: '654321' }), {
    userId: 'user-1', email: 'student@example.com', purpose: 'LOGIN',
  });
});

test('concurrent requests for the same email and purpose cannot bypass the cooldown', async () => {
  resetFake();
  const service = localService();
  const results = await Promise.allSettled([
    service.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' }),
    service.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' }),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(results.filter((item) => item.status === 'rejected' && item.reason.statusCode === 429).length, 1);
  assert.equal(FakeChallenge.rows.length, 1);
});

test('concurrent verification can consume a code only once', async () => {
  resetFake();
  const service = localService({ randomCodes: [234567] });
  await service.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' });
  const attempts = await Promise.allSettled([
    service.verifyCode({ email: 'student@example.com', purpose: 'LOGIN', code: '234567' }),
    service.verifyCode({ email: 'student@example.com', purpose: 'LOGIN', code: '234567' }),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
  assert.equal(FakeChallenge.rows[0].consumed, true);
});

test('expired OTPs, incorrect codes, and reused codes are rejected; five attempts consume a challenge', async () => {
  resetFake();
  const nowRef = { value: 1_800_000_000_000 };
  const service = localService({ nowRef, randomCodes: [234567] });
  await service.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(service.verifyCode({ email: 'student@example.com', purpose: 'LOGIN', code: '000000' }), { statusCode: 401 });
  }
  assert.equal(FakeChallenge.rows[0].consumed, true);
  await assert.rejects(service.verifyCode({ email: 'student@example.com', purpose: 'LOGIN', code: '234567' }), { statusCode: 401 });

  nowRef.value += 60_000;
  await service.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' });
  nowRef.value += 600_001;
  await assert.rejects(service.verifyCode({ email: 'student@example.com', purpose: 'LOGIN', code: '234567' }), { statusCode: 401 });
});

test('provider rejection invalidates the challenge and allows an immediate retry', async () => {
  resetFake();
  let fail = true;
  const emailService = {
    sendOtpEmail: async () => {
      if (fail) throw Object.assign(new Error('private provider detail'), { statusCode: 502 });
      return { id: 'mock-email-id' };
    },
  };
  const resendService = createEmailOtpService({
    Challenge: FakeChallenge,
    emailService,
    getEnv: () => env({ NODE_ENV: 'production', LOCAL_OTP_ENABLED: 'false', RESEND_API_KEY: 'test-key' }),
    randomInt: () => 345678,
    randomUUID: () => 'provider-failure-nonce',
  });
  await assert.rejects(
    resendService.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' }),
    (error) => error.statusCode === 502 && !error.message.includes('private provider detail')
  );
  assert.equal(FakeChallenge.rows[0].state, 'FAILED');
  assert.equal(FakeChallenge.rows[0].consumed, true);
  assert.equal(FakeChallenge.rows[0].otpHash, undefined);

  fail = false;
  const retry = await resendService.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' });
  assert.equal(retry.provider, 'resend');
  assert.equal(FakeChallenge.rows[0].state, 'SENT');
  assert.equal(FakeChallenge.rows[0].providerMessageId, 'mock-email-id');
});

test('failed signup delivery retains pending form data only for a safe retry, not an account', async () => {
  resetFake();
  const service = createEmailOtpService({
    Challenge: FakeChallenge,
    emailService: { sendOtpEmail: async () => { throw Object.assign(new Error('provider unavailable'), { statusCode: 502 }); } },
    getEnv: () => env({ NODE_ENV: 'production', LOCAL_OTP_ENABLED: 'false', RESEND_API_KEY: 'test-key' }),
    randomInt: () => 345678,
    randomUUID: () => 'signup-provider-failure',
  });
  const pendingRegistration = { name: 'Student', phone: '+911234567890', passwordHash: 'bcrypt-hash' };
  await assert.rejects(service.requestCode({ email: 'student@thapar.edu', purpose: 'SIGNUP', pendingRegistration }), { statusCode: 502 });
  assert.equal(FakeChallenge.rows[0].state, 'FAILED');
  assert.equal(FakeChallenge.rows[0].userId, undefined);
  assert.equal(FakeChallenge.rows[0].pendingRegistration.passwordHash, 'bcrypt-hash');
  assert.equal(FakeChallenge.rows[0].otpHash, undefined);
});

test('local OTP fallback cannot be enabled outside development', async () => {
  resetFake();
  const service = createEmailOtpService({
    Challenge: FakeChallenge,
    getEnv: () => env({ NODE_ENV: 'production', LOCAL_OTP_ENABLED: 'true', RESEND_API_KEY: '' }),
  });
  await assert.rejects(service.requestCode({ email: 'student@example.com', userId: 'user-1', purpose: 'LOGIN' }), { statusCode: 503 });
  assert.equal(FakeChallenge.rows.length, 0);
});

test('Resend SDK receives branded six-digit email and provider errors are sanitized', async () => {
  let sentEmail;
  class MockResend {
    constructor(key) { assert.equal(key, 're_test_key'); this.emails = { send: async (payload) => { sentEmail = payload; return { data: { id: 'email-1' } }; } }; }
  }
  const service = createResendEmailService({ ResendClient: MockResend, getEnv: () => ({ RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'Wrapchik <auth@wrapchik.example>' }) });
  await service.sendOtpEmail({ to: 'student@example.com', code: '123456', purpose: 'EMAIL_VERIFY' });
  assert.equal(sentEmail.from, 'Wrapchik <auth@wrapchik.example>');
  assert.deepEqual(sentEmail.to, ['student@example.com']);
  assert.match(sentEmail.html, /WRAPCHIK/);
  assert.match(sentEmail.html, /123456/);
  assert.match(sentEmail.text, /10 minutes/);

  class RejectedResend {
    constructor() { this.emails = { send: async () => ({ data: null, error: { message: 'private recipient detail' } }) }; }
  }
  const rejected = createResendEmailService({ ResendClient: RejectedResend, getEnv: () => ({ RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'Wrapchik <auth@wrapchik.example>' }) });
  await assert.rejects(rejected.sendOtpEmail({ to: 'student@example.com', code: '123456', purpose: 'LOGIN' }), (error) => {
    assert.equal(error.statusCode, 502);
    assert.equal(error.message, 'The email provider could not accept the verification email.');
    return true;
  });
});

test('Resend diagnostics redact recipients, API keys and six-digit codes', async () => {
  const originalError = console.error;
  let diagnostic = '';
  console.error = (...parts) => { diagnostic += parts.map((part) => typeof part === 'string' ? part : JSON.stringify(part)).join(' '); };
  try {
    class RejectedResend {
      constructor() {
        this.emails = { send: async () => ({ data: null, error: {
          name: 'validation_error', code: 'invalid_sender', statusCode: 422,
          message: 'Invalid sender auth@wrapchik.example for key re_1234567890 and OTP 123456',
        } }) };
      }
    }
    const service = createResendEmailService({
      ResendClient: RejectedResend,
      getEnv: () => ({ RESEND_API_KEY: 're_private_test_key', EMAIL_FROM: 'Wrapchik <auth@wrapchik.example>' }),
    });
    await assert.rejects(service.sendOtpEmail({ to: 'student@thapar.edu', code: '123456', purpose: 'SIGNUP' }), { statusCode: 502 });
  } finally {
    console.error = originalError;
  }
  assert.match(diagnostic, /invalid_sender/);
  assert.match(diagnostic, /422/);
  assert.doesNotMatch(diagnostic, /auth@wrapchik\.example|re_1234567890|123456/);
});

test('Resend network exceptions are awaited, sanitized and returned as delivery failures', async () => {
  class NetworkFailureResend {
    constructor() { this.emails = { send: async () => { throw new Error('socket timed out for student@thapar.edu code 654321'); } }; }
  }
  const service = createResendEmailService({
    ResendClient: NetworkFailureResend,
    getEnv: () => ({ RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'Wrapchik <auth@wrapchik.example>' }),
  });
  await assert.rejects(service.sendOtpEmail({ to: 'student@thapar.edu', code: '654321', purpose: 'SIGNUP' }), (error) => {
    assert.equal(error.statusCode, 502);
    assert.equal(error.message, 'The email provider could not accept the verification email.');
    return true;
  });
});

test('Resend requires both an API key and an explicitly configured sender', async () => {
  const missingKey = createResendEmailService({ getEnv: () => ({ EMAIL_FROM: 'Wrapchik <auth@wrapchik.example>' }) });
  await assert.rejects(missingKey.sendOtpEmail({ to: 'student@example.com', code: '123456', purpose: 'LOGIN' }), { statusCode: 503 });
  const missingSender = createResendEmailService({ getEnv: () => ({ RESEND_API_KEY: 're_test_key' }) });
  await assert.rejects(missingSender.sendOtpEmail({ to: 'student@example.com', code: '123456', purpose: 'LOGIN' }), { statusCode: 503 });
});

test('student signup will not send with Resend test sender or create a challenge', async () => {
  resetFake();
  const service = createEmailOtpService({
    Challenge: FakeChallenge,
    getEnv: () => env({ NODE_ENV: 'production', LOCAL_OTP_ENABLED: 'false', RESEND_API_KEY: 'test-key', EMAIL_FROM: 'Wrapchik <onboarding@resend.dev>' }),
  });
  await assert.rejects(service.requestCode({
    email: 'student@thapar.edu',
    purpose: 'SIGNUP',
    pendingRegistration: { name: 'Student', phone: '+911234567890', passwordHash: 'bcrypt-hash' },
  }), (error) => error.statusCode === 503 && /verified in Resend|Gmail SMTP is not configured/.test(error.message));
  assert.equal(FakeChallenge.rows.length, 0);
});
