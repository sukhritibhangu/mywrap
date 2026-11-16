const crypto = require('node:crypto');

const API_VERSION = process.env.CASHFREE_API_VERSION || '2026-01-01';
const baseUrl = () => 'https://sandbox.cashfree.com/pg';
const isConfigured = () => Boolean(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET)
  && (!process.env.CASHFREE_ENV || process.env.CASHFREE_ENV === 'sandbox');

const request = async (path, { method = 'GET', body, idempotencyKey } = {}) => {
  if (!isConfigured()) throw new Error('Cashfree sandbox credentials are not configured, or Cashfree is set to a non-sandbox environment');
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-api-version': API_VERSION,
      'x-client-id': process.env.CASHFREE_CLIENT_ID,
      'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
      ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Cashfree API request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
};

const createOrder = (body, idempotencyKey) => request('/orders', { method: 'POST', body, idempotencyKey });
const getOrder = (orderId) => request(`/orders/${encodeURIComponent(orderId)}`);
const getPayments = (orderId) => request(`/orders/${encodeURIComponent(orderId)}/payments`);

const verifyWebhookSignature = (rawBody, timestamp, received, secret = process.env.CASHFREE_WEBHOOK_SECRET) => {
  if (!secret || !Buffer.isBuffer(rawBody) || typeof timestamp !== 'string' || typeof received !== 'string') return false;
  const expected = crypto.createHmac('sha256', secret).update(timestamp).update(rawBody).digest('base64');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

module.exports = { API_VERSION, isConfigured, createOrder, getOrder, getPayments, verifyWebhookSignature };
