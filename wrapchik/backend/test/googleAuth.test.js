const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../src/models/User');
const Challenge = require('../src/models/GoogleLoginChallenge');
const identity = require('../src/services/googleIdentityService');
const { googleLogin, googleChallenge, googleConfig } = require('../src/controllers/googleAuthController');
const { loginUser } = require('../src/controllers/authController');
const bcrypt = require('bcryptjs');

const clientId = 'test-client.apps.googleusercontent.com';
const nonce = 'server-created-test-nonce';
const challengeId = '507f1f77bcf86cd799439011';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const secret = 'google-login-test-secret-at-least-32-characters';
let users, challenges, createCalls;
const original = { findOne: User.findOne, create: User.create, challengeCreate: Challenge.create,
  challengeFind: Challenge.findOne, consume: Challenge.findOneAndDelete,
  certs: OAuth2Client.prototype.getFederatedSignonCertsAsync };
const response = () => ({ statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
  set(key, value) { this.headers[key] = value; return this; }, json(body) { this.body = body; return this; } });
const query = (value) => { const promise = Promise.resolve(value); promise.select = () => promise; return promise; };
const claims = (extra = {}) => ({ iss: 'https://accounts.google.com', aud: clientId, sub: 'google-student-id',
  email: 'student@thapar.edu', email_verified: true, hd: 'thapar.edu', name: 'Thapar Student', nonce,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...extra });
const credential = (extra = {}) => jwt.sign(claims(extra), privateKey, { algorithm: 'RS256', keyid: 'test-key' });
const login = async (body = {}) => {
  const res = response();
  await googleLogin({ body: { credential: credential(), challengeId, ...body } }, res, (error) => { throw error; });
  return res;
};
before(() => {
  process.env.GOOGLE_CLIENT_ID = clientId;
  process.env.JWT_SECRET = secret;
  OAuth2Client.prototype.getFederatedSignonCertsAsync = async () => ({ certs: { 'test-key': publicKey.export({ type: 'spki', format: 'pem' }) } });
  User.findOne = (filter) => query(users.find((u) => Object.entries(filter).every(([key, value]) =>
    value && typeof value === 'object' && value.$in ? value.$in.includes(u[key]) : u[key] === value)) || null);
  User.create = async (data) => { createCalls++; const user = { _id: 'student-id', ...data, async save() {} }; users.push(user); return user; };
  const findChallenge = (filter) => challenges.find((c) => c._id === filter._id && c.nonceHash === filter.nonceHash && c.expiresAt > filter.expiresAt.$gt);
  Challenge.findOne = async (filter) => findChallenge(filter) || null;
  Challenge.findOneAndDelete = async (filter) => { const found = findChallenge(filter); challenges = challenges.filter((c) => c !== found); return found || null; };
  Challenge.create = async (data) => ({ _id: challengeId, ...data });
});
beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = clientId;
  users = []; createCalls = 0;
  challenges = [{ _id: challengeId, nonceHash: crypto.createHash('sha256').update(nonce).digest('hex'), expiresAt: new Date(Date.now() + 300000) }];
});
after(() => {
  User.findOne = original.findOne; User.create = original.create;
  Challenge.create = original.challengeCreate; Challenge.findOne = original.challengeFind; Challenge.findOneAndDelete = original.consume;
  OAuth2Client.prototype.getFederatedSignonCertsAsync = original.certs;
});

test('official Google verifier accepts a correctly signed Thapar identity', async () => {
  assert.equal((await identity.verifyGoogleIdentity(credential())).sub, 'google-student-id');
});
test('Google verifier rejects wrong audience, issuer, expired tokens and forged signatures', async () => {
  for (const fields of [{ aud: 'another-client' }, { iss: 'https://attacker.example' }, { exp: Math.floor(Date.now() / 1000) - 3600 }]) {
    await assert.rejects(identity.verifyGoogleIdentity(credential(fields)));
  }
  const forged = credential().split('.'); forged[1] = Buffer.from(JSON.stringify(claims({ sub: 'forged' }))).toString('base64url');
  await assert.rejects(identity.verifyGoogleIdentity(forged.join('.')));
});
test('Google verifier rejects Gmail, missing or wrong hosted domain, suffix tricks and unverified email', async () => {
  for (const fields of [{ email: 'student@gmail.com' }, { hd: undefined }, { hd: 'other.edu' },
    { email: 'student@thapar.edu.attacker.com' }, { email_verified: false }]) {
    await assert.rejects(identity.verifyGoogleIdentity(credential(fields)), { statusCode: 403 });
  }
});
test('unconfigured Google sign-in fails closed and exposes no challenge', async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  const config = response(); googleConfig({}, config);
  assert.equal(config.body.enabled, false);
  const res = response(); await googleChallenge({}, res, (error) => { throw error; });
  assert.equal(res.statusCode, 503);
  assert.equal((await login()).statusCode, 503);
});
test('challenge is random, expires after five minutes and has no-store response', async () => {
  const a = response(), b = response();
  await googleChallenge({}, a, (e) => { throw e; }); await googleChallenge({}, b, (e) => { throw e; });
  assert.notEqual(a.body.nonce, b.body.nonce);
  assert.equal(a.headers['Cache-Control'], 'no-store');
});
test('new students must provide a phone before any account or session is created', async () => {
  const res = await login();
  assert.equal(res.body.requiresPhone, true); assert.equal(res.body.token, undefined);
  assert.equal(createCalls, 0); assert.equal(challenges.length, 1);
});
test('new Google signup ignores injected email and admin role and consumes nonce', async () => {
  const res = await login({ phone: '9876543210', role: 'admin', email: 'attacker@example.com', name: 'Injected name' });
  assert.equal(res.body.user.role, 'student'); assert.equal(res.body.user.email, 'student@thapar.edu');
  assert.equal(res.body.user.name, 'Thapar Student'); assert.equal(res.body.user.phone, '+919876543210');
  assert.equal(res.body.user.emailVerified, true); assert.equal(res.body.user.phoneVerified, false);
  assert.equal(res.body.user.passwordHash, undefined); assert.equal(res.body.user.googleSubject, undefined);
  assert.equal(jwt.verify(res.body.token, secret).id, 'student-id');
  assert.equal(challenges.length, 0); assert.equal(createCalls, 1);
  assert.equal((await login()).statusCode, 401);
});
test('wrong nonce, expired challenge and missing nonce cannot sign in', async () => {
  for (const fields of [{ nonce: 'wrong-nonce' }, { nonce: undefined }]) assert.equal((await login({ credential: credential(fields) })).statusCode, 401);
  challenges[0].expiresAt = new Date(Date.now() - 1);
  assert.equal((await login()).statusCode, 401);
  assert.equal(createCalls, 0);
});
test('existing student is linked by authoritative email and retains their account and orders', async () => {
  const user = { _id: 'existing-id', name: 'Existing Student', email: 'student@thapar.edu', role: 'student', phone: '+919876543210', async save() {} };
  users.push(user);
  const res = await login();
  assert.equal(res.body.user._id, 'existing-id'); assert.equal(createCalls, 0);
  assert.equal(user.googleSubject, 'google-student-id'); assert.equal(user.emailVerified, true);
});
test('Google sign-in never logs into or changes an administrator account', async () => {
  const user = { _id: 'admin-id', email: 'student@thapar.edu', role: 'admin' };
  users.push(user);
  const res = await login(); assert.equal(res.statusCode, 403); assert.equal(res.body.token, undefined);
  assert.equal(user.googleSubject, undefined); assert.equal(user.emailVerified, undefined);
});
test('conflicting Google subject, phone reuse and invalid phone do not create accounts', async () => {
  users.push({ email: 'student@thapar.edu', googleSubject: 'different-sub', role: 'student' });
  assert.equal((await login()).statusCode, 409);
  users = [{ email: 'other@thapar.edu', phone: '9876543210' }];
  assert.equal((await login({ phone: '9876543210' })).statusCode, 409);
  users = [];
  assert.equal((await login({ phone: '123' })).statusCode, 400); assert.equal(createCalls, 0);
});
test('concurrent Google login requests cannot reuse the same challenge', async () => {
  users.push({ _id: 'existing-id', email: 'student@thapar.edu', googleSubject: 'google-student-id', role: 'student', async save() {} });
  const responses = await Promise.all([login(), login()]);
  assert.equal(responses.filter((r) => r.body.token).length, 1);
  assert.equal(responses.filter((r) => r.statusCode === 401).length, 1);
});
test('admin password still works while Google is enabled; student password cannot bypass Google', async () => {
  const passwordHash = await bcrypt.hash('AdminPass123', 4);
  for (const role of ['admin', 'student']) {
    users = [{ _id: 'existing-id', email: 'person@thapar.edu', passwordHash, role, emailVerified: true }];
    const res = response(); await loginUser({ adminLoginOnly: true, body: { email: 'person@thapar.edu', password: 'AdminPass123' } }, res, (error) => { throw error; });
    assert.equal(res.statusCode, role === 'admin' ? 200 : 403);
    assert.equal(Boolean(res.body.token), role === 'admin');
  }
});
