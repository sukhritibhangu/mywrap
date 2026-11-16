const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidUpiQrImage, MAX_QR_IMAGE_BYTES } = require('../src/utils/upiPayment');
const Settings = require('../src/models/RestaurantSettings');
const Order = require('../src/models/Order');
const { updateSettings } = require('../src/controllers/settingsController');
const { getUpiInstructions } = require('../src/controllers/manualPaymentController');
const { adminOnly } = require('../src/middleware/authMiddleware');
const User = require('../src/models/User');
const express = require('express');
const jwt = require('jsonwebtoken');

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1QAAAAASUVORK5CYII=';
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const next = (error) => { if (error) throw error; };

test('QR accepts supported raster uploads or HTTPS image links and permits clearing', () => {
  assert.equal(isValidUpiQrImage(png), true);
  assert.equal(isValidUpiQrImage('https://example.com/qr.png'), true);
  assert.equal(isValidUpiQrImage(''), true);
});
test('QR rejects SVG/script data, mismatched MIME, bad base64, credential URLs and oversize images', () => {
  for (const value of [null, {}, 'javascript:alert(1)', 'http://example.com/qr.png',
    'https://user:password@example.com/qr.png', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:image/jpeg;base64,' + png.split(',')[1], 'data:image/png;base64,%%%%',
    'data:image/png;base64,' + Buffer.alloc(MAX_QR_IMAGE_BYTES + 1).toString('base64')]) {
    assert.equal(isValidUpiQrImage(value), false);
  }
});
test('admin settings persist uploaded QR, preserve UPI validation and allow replacement/removal', async () => {
  const original = Settings.getSettings;
  const settings = { upiEnabled: true, upiId: 'outlet@bank', upiPayeeName: 'Wrapchik', openTime: '09:00', closeTime: '23:00', saved: 0, async save() { this.saved++; } };
  Settings.getSettings = async () => settings;
  try {
    const uploaded = response(); await updateSettings({ body: { upiQrImageUrl: png } }, uploaded, next);
    assert.equal(uploaded.statusCode, 200); assert.equal(settings.upiQrImageUrl, png);
    const invalid = response(); await updateSettings({ body: { upiQrImageUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } }, invalid, next);
    assert.equal(invalid.statusCode, 400); assert.equal(settings.saved, 1);
    const noPayee = response(); await updateSettings({ body: { upiPayeeName: '' } }, noPayee, next);
    assert.equal(noPayee.statusCode, 400); assert.equal(settings.saved, 1);
    const removed = response(); await updateSettings({ body: { upiQrImageUrl: '' } }, removed, next);
    assert.equal(removed.statusCode, 200); assert.equal(settings.upiQrImageUrl, '');
  } finally { Settings.getSettings = original; }
});
test('non-admin cannot pass the QR/settings write guard; administrator can', () => {
  for (const role of [undefined, 'student', 'admin']) {
    const res = response(); let called = false;
    adminOnly({ user: role ? { role } : undefined }, res, () => { called = true; });
    assert.equal(called, role === 'admin');
    if (role !== 'admin') assert.equal(res.statusCode, 403);
  }
});
test('preset QR instructions use admin image and saved order total, never a client payee or amount', async () => {
  const originalSettings = Settings.getSettings, originalOrder = Order.findById;
  const orderId = '507f1f77bcf86cd799439011';
  const order = { _id: orderId, userId: 'customer-id', paymentMethod: 'UPI_QR', totalAmount: 126, orderNumber: 'WRP-TEST', paymentStatus: 'PENDING', orderStatus: 'PLACED' };
  Settings.getSettings = async () => ({ upiEnabled: true, upiId: 'outlet@bank', upiPayeeName: 'Wrapchik', upiQrImageUrl: png });
  Order.findById = async () => order;
  try {
    const res = response();
    await getUpiInstructions({ params: { orderId }, user: { _id: 'customer-id', role: 'student' }, body: { amount: 1, upiQrImageUrl: 'https://attacker.example/qr.png' } }, res, next);
    assert.equal(res.body.instructions.qrMode, 'ADMIN_IMAGE'); assert.equal(res.body.instructions.qrImageUrl, png);
    assert.equal(res.body.instructions.upiUri, null); assert.equal(res.body.instructions.amount, 126);
    assert.equal(order.paymentStatus, 'PENDING');
    const denied = response(); await getUpiInstructions({ params: { orderId }, user: { _id: 'other-customer', role: 'student' } }, denied, next);
    assert.equal(denied.statusCode, 403);
    Settings.getSettings = async () => ({ upiEnabled: true, upiId: 'outlet@bank', upiPayeeName: 'Wrapchik', upiQrImageUrl: '' });
    const generated = response(); await getUpiInstructions({ params: { orderId }, user: { _id: 'customer-id' } }, generated, next);
    assert.equal(generated.body.instructions.qrMode, 'GENERATED'); assert.match(generated.body.instructions.upiUri, /am=126\.00/);
  } finally { Settings.getSettings = originalSettings; Order.findById = originalOrder; }
});

test('real settings route permits QR writes only with an authenticated administrator session', async () => {
  const originalUser = User.findById, originalSettings = Settings.getSettings;
  const secret = 'admin-qr-route-test-secret-at-least-32-characters';
  process.env.JWT_SECRET = secret;
  let writes = 0;
  User.findById = (id) => ({ select: async () => ({ _id: id, role: id === 'admin-id' ? 'admin' : 'student', emailVerified: true }) });
  Settings.getSettings = async () => ({ upiEnabled: true, upiId: 'outlet@bank', upiPayeeName: 'Wrapchik', openTime: '09:00', closeTime: '23:00', async save() { writes++; } });
  const app = express(); app.use(express.json({ limit: '1mb' })); app.use('/settings', require('../src/routes/settingsRoutes'));
  const server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try {
    for (const id of [null, 'student-id', 'admin-id']) {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/settings`, { method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(id ? { Authorization: `Bearer ${jwt.sign({ id }, secret, { algorithm: 'HS256' })}` } : {}) },
        body: JSON.stringify({ upiQrImageUrl: png }) });
      assert.equal(res.status, id === null ? 401 : id === 'student-id' ? 403 : 200);
    }
    assert.equal(writes, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve)); User.findById = originalUser; Settings.getSettings = originalSettings;
  }
});
