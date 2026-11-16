const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidUpiId, isUpiConfigured, isSupportedNewPaymentMethod, createUpiPaymentUri } = require('../src/utils/upiPayment');
const RestaurantSettings = require('../src/models/RestaurantSettings');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');

test('outlet UPI is enabled only with explicit valid outlet configuration', () => {
  assert.equal(isUpiConfigured({ upiId: 'wrapchik@bank', upiPayeeName: 'Wrapchik TIET', upiEnabled: true }), true);
  assert.equal(isUpiConfigured({ upiId: 'wrapchik@bank', upiPayeeName: 'Wrapchik TIET', upiEnabled: false }), false);
  assert.equal(isUpiConfigured({ upiId: '', upiPayeeName: 'Wrapchik TIET', upiEnabled: true }), false);
  assert.equal(isUpiConfigured({ upiId: 'wrapchik@bank', upiPayeeName: '', upiEnabled: true }), false);
  assert.equal(isValidUpiId('not an upi id'), false);
});

test('new orders support only UPI and cash while gateway methods remain historical', () => {
  assert.equal(isSupportedNewPaymentMethod('COUNTER'), true);
  assert.equal(isSupportedNewPaymentMethod('UPI_QR'), true);
  assert.equal(isSupportedNewPaymentMethod('CASHFREE'), false);
  assert.equal(isSupportedNewPaymentMethod('RAZORPAY'), false);
});

test('per-order UPI URI encodes the backend amount, payee, order reference, note and INR currency', () => {
  const uri = createUpiPaymentUri({
    upiId: 'wrapchik@bank', payeeName: 'Wrapchik TIET', amount: 123.4,
    orderId: '64b000000000000000000001', orderNumber: 'WRP-123456',
  });
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, 'upi:');
  assert.equal(parsed.hostname, 'pay');
  assert.equal(parsed.searchParams.get('pa'), 'wrapchik@bank');
  assert.equal(parsed.searchParams.get('pn'), 'Wrapchik TIET');
  assert.equal(parsed.searchParams.get('am'), '123.40');
  assert.equal(parsed.searchParams.get('tr'), '64b000000000000000000001');
  assert.equal(parsed.searchParams.get('tn'), 'Wrapchik order WRP-123456');
  assert.equal(parsed.searchParams.get('cu'), 'INR');
});

test('payment settings default safely and historical payment methods remain readable', () => {
  assert.equal(RestaurantSettings.schema.path('upiEnabled').defaultValue, false);
  assert.equal(RestaurantSettings.schema.path('cashEnabled').defaultValue, true);
  assert.deepEqual(Order.schema.path('paymentMethod').enumValues, ['COUNTER', 'UPI_QR', 'CASHFREE', 'RAZORPAY']);
  assert.ok(Payment.schema.path('gateway').enumValues.includes('CASHFREE'));
  assert.ok(Payment.schema.path('gateway').enumValues.includes('RAZORPAY'));
});

test('cash and UPI order creation keep pending payment and use only server-calculated totals', async () => {
  const orderPricing = require('../src/utils/orderPricing');
  const socketManager = require('../src/config/socketManager');
  const notifications = require('../src/controllers/notificationController');
  const originals = {
    calculateVerifiedItems: orderPricing.calculateVerifiedItems,
    getSettings: RestaurantSettings.getSettings,
    create: Order.create,
    emitOrderUpdate: socketManager.emitOrderUpdate,
    emitNewOrder: socketManager.emitNewOrder,
    createNotification: notifications.createNotification,
    notifyAdmins: notifications.notifyAdmins,
  };
  const persisted = [];
  orderPricing.calculateVerifiedItems = async () => ({ verifiedItems: [{ productId: '64b000000000000000000001', name: 'Wrap', quantity: 1, priceAtPurchase: 100, itemTotal: 100 }], subtotal: 100 });
  RestaurantSettings.getSettings = async () => ({
    acceptingOrders: true, takeawayEnabled: true, estimatedPrepMinutes: 15, cashEnabled: true,
    upiEnabled: true, upiId: 'wrapchik@bank', upiPayeeName: 'Wrapchik TIET',
  });
  Order.create = async (document) => {
    persisted.push(document);
    return { ...document, userId: { _id: document.userId, name: 'Student', email: 'student@thapar.edu' }, async populate() { return this; } };
  };
  socketManager.emitOrderUpdate = () => {};
  socketManager.emitNewOrder = () => {};
  notifications.createNotification = async () => {};
  notifications.notifyAdmins = async () => {};
  try {
    const { createOrder } = require('../src/controllers/orderController');
    for (const method of ['COUNTER', 'UPI_QR']) {
      let statusCode;
      let payload;
      const res = { status(code) { statusCode = code; return this; }, json(body) { payload = body; return this; } };
      await createOrder({
        body: { paymentMethod: method, items: [{ productId: '64b000000000000000000001', quantity: 1, price: 999999 }] },
        user: { _id: '64b000000000000000000002', name: 'Student', email: 'student@thapar.edu' },
      }, res, error => { throw error; });
      assert.equal(statusCode, 201);
      assert.equal(payload.order.totalAmount, 105);
      assert.equal(payload.order.paymentStatus, 'PENDING');
      assert.equal(payload.order.paymentMethod, method);
    }
    assert.equal(persisted.length, 2);
  } finally {
    orderPricing.calculateVerifiedItems = originals.calculateVerifiedItems;
    RestaurantSettings.getSettings = originals.getSettings;
    Order.create = originals.create;
    socketManager.emitOrderUpdate = originals.emitOrderUpdate;
    socketManager.emitNewOrder = originals.emitNewOrder;
    notifications.createNotification = originals.createNotification;
    notifications.notifyAdmins = originals.notifyAdmins;
  }
});

test('new order creation rejects legacy gateway methods', async () => {
  const { createOrder } = require('../src/controllers/orderController');
  let statusCode;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };
  await createOrder({
    body: { paymentMethod: 'CASHFREE', items: [{ productId: '64b000000000000000000001', quantity: 1 }] },
    user: { _id: '64b000000000000000000002' },
  }, res, error => { throw error; });
  assert.equal(statusCode, 400);
  assert.match(payload.message, /UPI or cash at counter/i);
});

test('UPI cannot enter kitchen acceptance while unpaid', async () => {
  const originalFindById = Order.findById;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  let updateAttempted = false;
  const pendingOrder = {
    _id: '64b000000000000000000001', orderStatus: 'PLACED', orderType: 'TAKEAWAY',
    paymentMethod: 'UPI_QR', paymentStatus: 'PENDING', userId: { name: 'Student' },
  };
  Order.findById = () => ({ populate: async () => pendingOrder });
  Order.findOneAndUpdate = () => { updateAttempted = true; throw new Error('Should not attempt a transition'); };
  try {
    const { updateOrderStatus } = require('../src/controllers/adminController');
    let statusCode;
    let payload;
    const res = { status(code) { statusCode = code; return this; }, json(body) { payload = body; return this; } };
    await updateOrderStatus({ params: { id: pendingOrder._id }, body: { status: 'ACCEPTED' } }, res, error => { throw error; });
    assert.equal(statusCode, 409);
    assert.match(payload.message, /until payment is confirmed/i);
    assert.equal(updateAttempted, false);
  } finally {
    Order.findById = originalFindById;
    Order.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('settings API refuses to enable UPI without a valid outlet ID and payee', async () => {
  const originalGetSettings = RestaurantSettings.getSettings;
  let saveCalled = false;
  RestaurantSettings.getSettings = async () => ({
    upiEnabled: false, upiId: '', upiPayeeName: '', openTime: '09:00', closeTime: '23:00',
    async save() { saveCalled = true; },
  });
  try {
    const { updateSettings } = require('../src/controllers/settingsController');
    let statusCode;
    let payload;
    const res = { status(code) { statusCode = code; return this; }, json(body) { payload = body; return this; } };
    await updateSettings({ body: { upiEnabled: true, upiId: 'wrapchik@bank', upiPayeeName: '' } }, res, error => { throw error; });
    assert.equal(statusCode, 400);
    assert.match(payload.message, /valid outlet UPI ID and payee name/i);
    assert.equal(saveCalled, false);
  } finally {
    RestaurantSettings.getSettings = originalGetSettings;
  }
});

test('UPI admin review requires a rejection reason and records verifier audit fields', async () => {
  const { updateOrderPaymentStatus } = require('../src/controllers/paymentController');
  const originalUpdateOrderPaymentStatus = updateOrderPaymentStatus;
  const originalFindOne = Payment.findOne;
  const originalFindOneAndUpdate = Payment.findOneAndUpdate;
  const originalOrderFindById = Order.findById;
  const paymentController = require.cache[require.resolve('../src/controllers/paymentController')].exports;
  const adminId = '64b000000000000000000003';
  const order = { _id: '64b000000000000000000001', paymentMethod: 'UPI_QR', paymentStatus: 'PENDING', orderStatus: 'PLACED', totalAmount: 105 };
  const payment = { _id: '64b000000000000000000004', orderId: order._id, method: 'UPI_QR', amount: 105, status: 'PENDING' };
  const applied = [];
  paymentController.updateOrderPaymentStatus = async (_order, status, paymentId) => { applied.push({ status, paymentId }); };
  Payment.findOne = async () => payment;
  Payment.findOneAndUpdate = async (_query, update) => Object.assign(payment, update.$set);
  Order.findById = async () => order;
  try {
    const { reviewUpiPayment } = require('../src/controllers/manualPaymentController');
    const call = async body => {
      let statusCode;
      let payload;
      const res = { status(code) { statusCode = code; return this; }, json(value) { payload = value; return this; } };
      await reviewUpiPayment({ params: { id: payment._id }, body, user: { _id: adminId } }, res, error => { throw error; });
      return { statusCode, payload };
    };
    const missingReason = await call({ action: 'REJECT' });
    assert.equal(missingReason.statusCode, 400);
    assert.equal(applied.length, 0);

    const approved = await call({ action: 'VERIFY' });
    assert.equal(approved.payload.paymentStatus, 'SUCCESS');
    assert.equal(payment.verifiedBy, adminId);
    assert.ok(payment.verifiedAt instanceof Date);
    assert.equal(applied[0].status, 'SUCCESS');

    Object.assign(payment, { status: 'PENDING', verifiedBy: null, verifiedAt: null });
    const rejected = await call({ action: 'REJECT', reason: 'No matching receipt found' });
    assert.equal(rejected.payload.paymentStatus, 'FAILED');
    assert.equal(payment.verificationReason, 'No matching receipt found');
    assert.equal(payment.verifiedBy, adminId);
    assert.ok(payment.verifiedAt instanceof Date);
    assert.equal(applied[1].status, 'FAILED');
  } finally {
    paymentController.updateOrderPaymentStatus = originalUpdateOrderPaymentStatus;
    Payment.findOne = originalFindOne;
    Payment.findOneAndUpdate = originalFindOneAndUpdate;
    Order.findById = originalOrderFindById;
  }
});

test('cash confirmation records payment only through the administrator confirmation handler', async () => {
  const socketManager = require('../src/config/socketManager');
  const notifications = require('../src/controllers/notificationController');
  const originals = {
    orderFindById: Order.findById, orderFindOneAndUpdate: Order.findOneAndUpdate,
    paymentFindOne: Payment.findOne, paymentCreate: Payment.create,
    emitOrderUpdate: socketManager.emitOrderUpdate,
    createNotification: notifications.createNotification,
  };
  const adminId = '64b000000000000000000003';
  const order = { _id: '64b000000000000000000001', userId: '64b000000000000000000002', orderNumber: 'WRP-123456', paymentMethod: 'COUNTER', paymentStatus: 'PENDING', orderStatus: 'PLACED', totalAmount: 105 };
  let savedPayment;
  Order.findById = async () => order;
  Payment.findOne = async () => null;
  Payment.create = async document => { savedPayment = { ...document, async save() {} }; return savedPayment; };
  Order.findOneAndUpdate = (_filter, update) => ({ populate: async () => ({ ...order, ...update.$set }) });
  socketManager.emitOrderUpdate = () => {};
  notifications.createNotification = async () => {};
  try {
    const { confirmCounterPayment } = require('../src/controllers/paymentController');
    let payload;
    const res = { status() { return this; }, json(value) { payload = value; return this; } };
    await confirmCounterPayment({ body: { orderId: order._id }, user: { _id: adminId, role: 'admin' } }, res, error => { throw error; });
    assert.equal(payload.success, true);
    assert.equal(savedPayment.method, 'CASH');
    assert.equal(savedPayment.amount, order.totalAmount);
    assert.equal(savedPayment.status, 'SUCCESS');
    assert.equal(savedPayment.verifiedBy, adminId);
    assert.ok(savedPayment.verifiedAt instanceof Date);
  } finally {
    Order.findById = originals.orderFindById;
    Order.findOneAndUpdate = originals.orderFindOneAndUpdate;
    Payment.findOne = originals.paymentFindOne;
    Payment.create = originals.paymentCreate;
    socketManager.emitOrderUpdate = originals.emitOrderUpdate;
    notifications.createNotification = originals.createNotification;
  }
});
