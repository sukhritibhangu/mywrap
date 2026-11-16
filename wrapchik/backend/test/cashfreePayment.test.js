const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const { verifyWebhookSignature } = require('../src/services/cashfreeService');
const { stableCashfreeOrderId, stableCashfreeIdempotencyKey } = require('../src/controllers/cashfreeController');
const cashfreeService = require('../src/services/cashfreeService');

test('Cashfree order IDs are stable and scoped to an existing Wrapchik order', () => {
  const id = '64b000000000000000000001';
  assert.equal(stableCashfreeOrderId(id), 'wrapchik_64b000000000000000000001');
  assert.equal(stableCashfreeOrderId(id), stableCashfreeOrderId(id));
  assert.ok(stableCashfreeOrderId(id).length <= 45);
});

test('Cashfree create-order retries reuse the same RFC 4122 UUID idempotency key', () => {
  const id = '64b000000000000000000001';
  const key = stableCashfreeIdempotencyKey(id);
  assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(stableCashfreeIdempotencyKey(id), key);
});

test('Cashfree webhook signature binds timestamp and exact raw bytes', () => {
  const body = Buffer.from('{"type":"PAYMENT_SUCCESS_WEBHOOK","data":{"order":{"order_id":"wrapchik_1"}}}');
  const timestamp = '1770000000';
  const secret = 'sandbox-webhook-secret';
  const signature = crypto.createHmac('sha256', secret).update(timestamp).update(body).digest('base64');
  assert.equal(verifyWebhookSignature(body, timestamp, signature, secret), true);
  assert.equal(verifyWebhookSignature(Buffer.from(`${body.toString()} `), timestamp, signature, secret), false);
  assert.equal(verifyWebhookSignature(body, '1770000001', signature, secret), false);
  assert.equal(verifyWebhookSignature(body, timestamp, signature, ''), false);
});

test('payment schemas retain legacy methods while adding Cashfree and UPI audit data', () => {
  assert.deepEqual(Order.schema.path('paymentMethod').enumValues, ['COUNTER', 'UPI_QR', 'CASHFREE', 'RAZORPAY']);
  assert.equal(Payment.schema.path('verifiedBy').instance, 'ObjectId');
  assert.equal(Payment.schema.path('verifiedAt').instance, 'Date');
  assert.equal(Payment.schema.path('upiTransactionReference').instance, 'String');
  assert.equal(Payment.schema.path('paymentSessionId').options.select, false);
  assert.equal(Payment.schema.path('gateway').instance, 'String');
});

test('Cashfree API requests use sandbox credentials, current API version, and deterministic idempotency', async () => {
  const old = {
    id: process.env.CASHFREE_CLIENT_ID,
    secret: process.env.CASHFREE_CLIENT_SECRET,
    environment: process.env.CASHFREE_ENV,
    fetch: global.fetch,
  };
  process.env.CASHFREE_CLIENT_ID = 'sandbox-app';
  process.env.CASHFREE_CLIENT_SECRET = 'sandbox-secret';
  process.env.CASHFREE_ENV = 'sandbox';
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ order_id: 'wrapchik_1', payment_session_id: 'session_test', order_amount: 42, order_currency: 'INR' }) };
  };
  try {
    await cashfreeService.createOrder({ order_amount: 42 }, '12345678-1234-5123-8123-123456789012');
    assert.equal(captured.url, 'https://sandbox.cashfree.com/pg/orders');
    assert.equal(captured.options.headers['x-client-id'], 'sandbox-app');
    assert.equal(captured.options.headers['x-client-secret'], 'sandbox-secret');
    assert.equal(captured.options.headers['x-api-version'], cashfreeService.API_VERSION);
    assert.equal(captured.options.headers['x-idempotency-key'], '12345678-1234-5123-8123-123456789012');
    assert.equal(cashfreeService.API_VERSION, '2026-01-01');
  } finally {
    global.fetch = old.fetch;
    if (old.id === undefined) delete process.env.CASHFREE_CLIENT_ID; else process.env.CASHFREE_CLIENT_ID = old.id;
    if (old.secret === undefined) delete process.env.CASHFREE_CLIENT_SECRET; else process.env.CASHFREE_CLIENT_SECRET = old.secret;
    if (old.environment === undefined) delete process.env.CASHFREE_ENV; else process.env.CASHFREE_ENV = old.environment;
  }
});

test('Cashfree service refuses production-mode credentials', () => {
  const old = { id: process.env.CASHFREE_CLIENT_ID, secret: process.env.CASHFREE_CLIENT_SECRET, environment: process.env.CASHFREE_ENV };
  process.env.CASHFREE_CLIENT_ID = 'test';
  process.env.CASHFREE_CLIENT_SECRET = 'test';
  process.env.CASHFREE_ENV = 'production';
  try { assert.equal(cashfreeService.isConfigured(), false); }
  finally {
    if (old.id === undefined) delete process.env.CASHFREE_CLIENT_ID; else process.env.CASHFREE_CLIENT_ID = old.id;
    if (old.secret === undefined) delete process.env.CASHFREE_CLIENT_SECRET; else process.env.CASHFREE_CLIENT_SECRET = old.secret;
    if (old.environment === undefined) delete process.env.CASHFREE_ENV; else process.env.CASHFREE_ENV = old.environment;
  }
});
