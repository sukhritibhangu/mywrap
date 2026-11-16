const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const WebhookEvent = require('../src/models/WebhookEvent');
const { signaturesMatch, stableReceiptForOrder, isValidWebhookEventId } = require('../src/controllers/paymentController');

test('stable Razorpay receipt stays unique to the Wrapchik order and within the provider limit', () => {
  const orderId = '64b000000000000000000001';
  const receipt = stableReceiptForOrder(orderId);
  assert.equal(receipt, 'wrap_64b000000000000000000001');
  assert.equal(stableReceiptForOrder(orderId), receipt);
  assert.ok(receipt.length <= 40);
});

test('webhook event identifiers are bounded and restricted to safe characters', () => {
  assert.equal(isValidWebhookEventId('evt_123-abc:1'), true);
  assert.equal(isValidWebhookEventId(''), false);
  assert.equal(isValidWebhookEventId('a'.repeat(129)), false);
  assert.equal(isValidWebhookEventId('bad event id'), false);
});

test('payment signatures require valid SHA-256 hex and timing-safe equality', () => {
  const expected = crypto.createHmac('sha256', 'test-secret').update('order|payment').digest('hex');
  assert.equal(signaturesMatch(expected, expected), true);
  assert.equal(signaturesMatch(expected, '0'.repeat(64)), false);
  assert.equal(signaturesMatch(expected, 'not-a-signature'), false);
});

test('schema declares atomic per-order checkout locking and durable webhook event uniqueness', () => {
  assert.equal(Order.schema.path('paymentCreateLockToken').instance, 'String');
  assert.equal(Order.schema.path('paymentCreateLockUntil').instance, 'Date');
  assert.ok(Payment.schema.path('gatewayPaymentIds'));
  const eventIndex = WebhookEvent.schema.indexes().find(([keys]) => keys.eventId === 1);
  assert.equal(eventIndex?.[1]?.unique, true);
});
