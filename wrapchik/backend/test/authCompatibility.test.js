const test = require('node:test');
// This suite covers legacy behavior before Google student sign-in is configured.
delete process.env.GOOGLE_CLIENT_ID;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const { loginUser } = require('../src/controllers/authController');
const { protect, adminOnly } = require('../src/middleware/authMiddleware');

const secret = 'auth-compatibility-test-secret-long-enough-123';
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const queryResult = (value) => {
  const promise = Promise.resolve(value);
  promise.select = () => promise;
  return promise;
};

test('legacy administrator password login still succeeds and preserves administrator role', async () => {
  const original = User.findOne;
  process.env.JWT_SECRET = secret;
  const passwordHash = await bcrypt.hash('AdminPass123', 4);
  User.findOne = () => queryResult({
    _id: 'admin-id',
    name: 'Test Admin',
    email: 'admin@example.com',
    phone: '+911234567890',
    passwordHash,
    phoneVerified: true,
    emailVerified: false,
    role: 'admin',
    pushToken: null,
  });
  try {
    const res = response();
    await loginUser({ body: { email: ' ADMIN@example.com ', password: 'AdminPass123' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.role, 'admin');
    assert.equal(res.body.user.emailVerified, false);
    assert.equal(jwt.verify(res.body.token, secret).id, 'admin-id');
  } finally {
    User.findOne = original;
  }
});

test('new email-verified students can retain password login without changing role', async () => {
  const original = User.findOne;
  process.env.JWT_SECRET = secret;
  const passwordHash = await bcrypt.hash('StudentPass123', 4);
  User.findOne = () => queryResult({
    _id: 'student-id', name: 'Test Student', email: 'student@example.com', phone: '+911234567891',
    passwordHash, phoneVerified: false, emailVerified: true, role: 'student', pushToken: null,
  });
  try {
    const res = response();
    await loginUser({ body: { email: 'student@example.com', password: 'StudentPass123' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.role, 'student');
    assert.equal(res.body.user.emailVerified, true);
  } finally {
    User.findOne = original;
  }
});

test('unverified users cannot use password login', async () => {
  const original = User.findOne;
  process.env.JWT_SECRET = secret;
  const passwordHash = await bcrypt.hash('PendingPass123', 4);
  User.findOne = () => queryResult({
    _id: 'pending-id', email: 'pending@example.com', passwordHash,
    phoneVerified: false, emailVerified: false, role: 'student',
  });
  try {
    const res = response();
    await loginUser({ body: { email: 'pending@example.com', password: 'PendingPass123' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  } finally {
    User.findOne = original;
  }
});

test('protected routes accept email-verified and legacy phone-verified accounts, reject unverified users', async () => {
  const original = User.findById;
  process.env.JWT_SECRET = secret;
  const cases = [
    { user: { _id: 'email-user', emailVerified: true, phoneVerified: false, role: 'student' }, expected: 200 },
    { user: { _id: 'legacy-user', emailVerified: false, phoneVerified: true, role: 'admin' }, expected: 200 },
    { user: { _id: 'pending-user', emailVerified: false, phoneVerified: false, role: 'student' }, expected: 403 },
  ];
  try {
    for (const item of cases) {
      User.findById = () => queryResult(item.user);
      const req = { headers: { authorization: `Bearer ${jwt.sign({ id: item.user._id }, secret, { algorithm: 'HS256' })}` } };
      const res = response();
      let nextCalled = false;
      await protect(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled ? 200 : res.statusCode, item.expected);
    }
  } finally {
    User.findById = original;
  }
});

test('adminOnly continues to reject a student account', () => {
  const res = response();
  let nextCalled = false;
  adminOnly({ user: { role: 'student' } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('user schema retains required phone/email and unique email while adding email verification compatibly', () => {
  assert.equal(User.schema.path('phone').isRequired, true);
  assert.equal(User.schema.path('email').isRequired, true);
  assert.equal(User.schema.path('emailVerified').defaultValue, false);
  assert.ok(User.schema.indexes().some(([keys, options]) => keys.email === 1 && options.unique === true));
});

test('admin recovery remains local-only, exact-target, hidden-input and password-only', () => {
  const recoveryPath = path.join(__dirname, '../src/scripts/recoverAdmin.js');
  const source = fs.readFileSync(recoveryPath, 'utf8');
  assert.match(source, /NODE_ENV !== 'development'/);
  assert.match(source, /isLocalMongoUri/);
  assert.match(source, /input\.isTTY/);
  assert.match(source, /findOneAndUpdate\(\s*\{ _id: user\._id, role: 'admin' \}/);
  assert.match(source, /\$set: \{ passwordHash \}/);
  assert.doesNotMatch(source, /\$set: \{[^}]*role\s*:/);
});
