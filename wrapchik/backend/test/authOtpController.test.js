const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const EmailOtpChallenge = require('../src/models/EmailOtpChallenge');
const { sendOtp, verifyOtp, registerUser } = require('../src/controllers/authController');

const secret = 'controller-test-secret-with-at-least-32-characters';
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const makeQuery = (value) => {
  const promise = Promise.resolve(value);
  promise.select = () => promise;
  return promise;
};

const setupMocks = () => {
  const original = {
    userFindOne: User.findOne,
    userFind: User.find,
    create: User.create,
    init: EmailOtpChallenge.init,
    findOneAndUpdate: EmailOtpChallenge.findOneAndUpdate,
    challengeFindOne: EmailOtpChallenge.findOne,
    updateOne: EmailOtpChallenge.updateOne,
  };
  let row = null;

  const matches = (candidate, filter) => Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((condition) => matches(candidate, condition));
    const actual = candidate[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$lte' in expected) return actual && new Date(actual) <= expected.$lte;
      if ('$lt' in expected) return actual < expected.$lt;
      if ('$gte' in expected) return actual >= expected.$gte;
      if ('$gt' in expected) return actual && new Date(actual) > expected.$gt;
      if ('$exists' in expected) return (actual !== undefined) === expected.$exists;
    }
    return actual === expected;
  });
  const apply = (candidate, update) => {
    Object.assign(candidate, update.$set || {});
    for (const [key, amount] of Object.entries(update.$inc || {})) candidate[key] = (candidate[key] || 0) + amount;
    for (const key of Object.keys(update.$unset || {})) delete candidate[key];
  };

  EmailOtpChallenge.init = async () => {};
  EmailOtpChallenge.findOneAndUpdate = (filter, update, options = {}) => {
    if (!row || !matches(row, filter)) {
      if (row && options.upsert) {
        const error = Object.assign(new Error('duplicate key'), { code: 11000 });
        const rejected = Promise.reject(error);
        rejected.select = () => Promise.reject(error);
        return rejected;
      }
      if (!options.upsert) {
        const empty = Promise.resolve(null);
        empty.select = () => empty;
        return empty;
      }
      row = { _id: 'email-challenge-1', email: filter.email, purpose: filter.purpose, attempts: 0, generation: 0, consumed: false };
    }
    apply(row, update);
    const resolved = Promise.resolve({ ...row });
    resolved.select = () => resolved;
    return resolved;
  };
  EmailOtpChallenge.findOne = (filter) => makeQuery(row && matches(row, filter) ? { ...row } : null);
  EmailOtpChallenge.updateOne = async (filter, update) => {
    if (!row || !matches(row, filter)) return { matchedCount: 0 };
    apply(row, update);
    return { matchedCount: 1 };
  };

  process.env.NODE_ENV = 'development';
  process.env.LOCAL_OTP_ENABLED = 'true';
  process.env.JWT_SECRET = secret;
  return {
    get row() { return row; },
    restore() {
      User.findOne = original.userFindOne;
      User.find = original.userFind;
      User.create = original.create;
      EmailOtpChallenge.init = original.init;
      EmailOtpChallenge.findOneAndUpdate = original.findOneAndUpdate;
      EmailOtpChallenge.findOne = original.challengeFindOne;
      EmailOtpChallenge.updateOne = original.updateOne;
    },
  };
};

test('email OTP request and verification issue a JWT without changing an existing admin role', async () => {
  const mocks = setupMocks();
  const originalFindOne = User.findOne;
  const admin = {
    _id: 'admin-user', name: 'Existing Admin', email: 'admin@example.com', phone: '+911234567890',
    emailVerified: false, phoneVerified: true, role: 'admin', pushToken: null,
    async save() {},
  };
  User.findOne = () => makeQuery(admin);
  try {
    const sendResponse = response();
    await sendOtp({ body: { email: admin.email } }, sendResponse, (error) => { throw error; });
    assert.equal(sendResponse.statusCode, 200);
    assert.equal(sendResponse.body.success, true);
    assert.match(sendResponse.body.developmentCode, /^\d{6}$/);

    const verifyResponse = response();
    await verifyOtp({ body: { email: admin.email, code: sendResponse.body.developmentCode, purpose: 'LOGIN' } }, verifyResponse, (error) => { throw error; });
    assert.equal(verifyResponse.statusCode, 200);
    assert.equal(verifyResponse.body.user.role, 'admin');
    assert.equal(verifyResponse.body.user.emailVerified, true);
    assert.equal(admin.phoneVerified, true);
    assert.equal(jwt.verify(verifyResponse.body.token, secret).id, 'admin-user');
    assert.equal(mocks.row.consumed, true);
  } finally {
    User.findOne = originalFindOne;
    mocks.restore();
  }
});

test('OTP send responses are consistent for known and unknown login emails', async () => {
  const mocks = setupMocks();
  const originalFindOne = User.findOne;
  try {
    User.findOne = () => makeQuery(null);
    const unknown = response();
    await sendOtp({ body: { email: 'missing@example.com' } }, unknown, (error) => { throw error; });

    User.findOne = () => makeQuery({ _id: 'student-id', email: 'student@example.com', role: 'student' });
    const known = response();
    await sendOtp({ body: { email: 'student@example.com' } }, known, (error) => { throw error; });
    assert.equal(unknown.statusCode, known.statusCode);
    assert.equal(unknown.body.message, known.body.message);
  } finally {
    User.findOne = originalFindOne;
    mocks.restore();
  }
});

test('missing email provider configuration returns the same response before account lookup', async () => {
  const originalFindOne = User.findOne;
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    LOCAL_OTP_ENABLED: process.env.LOCAL_OTP_ENABLED,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  };
  let lookups = 0;
  process.env.NODE_ENV = 'production';
  process.env.LOCAL_OTP_ENABLED = 'false';
  delete process.env.RESEND_API_KEY;
  User.findOne = () => { lookups += 1; return makeQuery(null); };
  try {
    const unknown = response();
    const known = response();
    await sendOtp({ body: { email: 'missing@example.com' } }, unknown, (error) => { throw error; });
    await sendOtp({ body: { email: 'known@example.com' } }, known, (error) => { throw error; });
    assert.equal(unknown.statusCode, 503);
    assert.equal(known.statusCode, 503);
    assert.equal(unknown.body.message, known.body.message);
    assert.equal(lookups, 0);
  } finally {
    User.findOne = originalFindOne;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('signup rejects an existing verified email without changing its role or credentials', async () => {
  const mocks = setupMocks();
  const originalFindOne = User.findOne;
  const admin = { _id: 'admin-id', email: 'admin@thapar.edu', phone: '+911234567890', phoneVerified: true, emailVerified: true, role: 'admin' };
  User.findOne = () => makeQuery(admin);
  try {
    const res = response();
    await registerUser({ body: { name: 'Admin', email: 'admin@thapar.edu', phone: '1234567890', password: 'Password123' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.equal(admin.role, 'admin');
    assert.equal(mocks.row, null);
  } finally {
    User.findOne = originalFindOne;
    mocks.restore();
  }
});

test('signup requires @thapar.edu and does not create an account before OTP verification', async () => {
  const mocks = setupMocks();
  const originalFindOne = User.findOne;
  const originalFind = User.find;
  const originalCreate = User.create;
  let creates = 0;
  const createdUser = {
    _id: 'new-student', name: 'Student', email: 'student@thapar.edu', emailVerified: true,
    phone: '+919876543210', role: 'student', phoneVerified: false, pushToken: null,
  };
  User.findOne = () => makeQuery(null);
  User.find = () => {
    const query = Promise.resolve([]);
    query.limit = () => query;
    return query;
  };
  User.create = async () => { creates += 1; throw new Error('User.create must wait for OTP verification'); };
  try {
    const rejected = response();
    await registerUser({ body: { name: 'Student', email: 'student@gmail.com', phone: '9876543210', password: 'Password123' } }, rejected, (error) => { throw error; });
    assert.equal(rejected.statusCode, 400);
    assert.equal(creates, 0);
    assert.equal(mocks.row, null);

    const accepted = response();
    await registerUser({ body: { name: 'Student', email: ' Student@THAPAR.EDU ', phone: '9876543210', password: 'Password123' } }, accepted, (error) => { throw error; });
    assert.equal(accepted.statusCode, 201);
    assert.equal(creates, 0);
    assert.equal(mocks.row.userId, undefined);
    assert.equal(mocks.row.purpose, 'SIGNUP');
    assert.equal(mocks.row.pendingRegistration.name, 'Student');
    assert.match(mocks.row.pendingRegistration.passwordHash, /^\$2[aby]\$/);

    User.create = async (user) => {
      creates += 1;
      assert.equal(user.emailVerified, true);
      assert.equal(user.role, 'student');
      assert.match(user.passwordHash, /^\$2[aby]\$/);
      return createdUser;
    };
    const verified = response();
    await verifyOtp({ body: { email: 'student@thapar.edu', purpose: 'SIGNUP', code: accepted.body.developmentCode } }, verified, (error) => { throw error; });
    assert.equal(verified.statusCode, 200);
    assert.equal(creates, 1);
    assert.equal(verified.body.user.role, 'student');
    assert.equal(jwt.verify(verified.body.token, secret).id, 'new-student');
  } finally {
    User.findOne = originalFindOne;
    User.find = originalFind;
    User.create = originalCreate;
    mocks.restore();
  }
});
