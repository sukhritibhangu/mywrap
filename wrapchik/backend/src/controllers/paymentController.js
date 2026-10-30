const crypto = require('crypto');
const Razorpay = require('razorpay');

const Order = require('../models/Order');
const Payment = require('../models/Payment');

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('[Payment] Razorpay credentials are not configured');
}

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (
      order.userId.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (order.paymentStatus === 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid',
      });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'Online payment is not configured',
      });
    }

    const existingPayment = await Payment.findOne({
      orderId: order._id,
      status: 'PENDING',
    });

    if (existingPayment) {
      return res.json({
        success: true,
        razorpayOrder: {
          id: existingPayment.gatewayOrderId,
          amount: Math.round(order.totalAmount * 100),
          currency: 'INR',
          key: process.env.RAZORPAY_KEY_ID,
        },
        orderId: order._id,
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.totalAmount * 100),
      currency: 'INR',
      receipt: `receipt_${order.orderNumber}`,
      notes: {
        orderId: order._id.toString(),
        userId: req.user._id.toString(),
      },
    });

    const payment = await Payment.create({
      orderId: order._id,
      userId: req.user._id,
      gatewayOrderId: razorpayOrder.id,
      amount: order.totalAmount,
      currency: 'INR',
      status: 'PENDING',
    });

    order.paymentId = payment._id;
    await order.save();

    res.json({
      success: true,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
      orderId: order._id,
    });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !orderId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: 'Incomplete payment verification data',
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (
      order.userId.toString() !==
        req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (order.paymentStatus === 'SUCCESS') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        orderNumber: order.orderNumber,
      });
    }

    const payment = await Payment.findOne({
      orderId: order._id,
      gatewayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(400).json({
        success: false,
        message: 'Payment session not found',
      });
    }

    const generatedSignature = crypto
      .createHmac(
        'sha256',
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${payment.gatewayOrderId}|${razorpay_payment_id}`
      )
      .digest('hex');

    const valid =
      crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(razorpay_signature)
      );

    if (!valid) {
      payment.status = 'FAILED';
      await payment.save();

      order.paymentStatus = 'FAILED';
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }

    payment.gatewayPaymentId = razorpay_payment_id;
    payment.gatewaySignature = razorpay_signature;
    payment.status = 'SUCCESS';

    await payment.save();

    order.paymentStatus = 'SUCCESS';
    order.orderStatus = 'PLACED';
    order.paymentId = payment._id;

    await order.save();

    res.json({
      success: true,
      message: 'Payment verified successfully',
      orderNumber: order.orderNumber,
      order,
    });
  } catch (error) {
    next(error);
  }
};

const confirmCounterPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.paymentStatus === 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid',
      });
    }

    const payment = await Payment.create({
      orderId: order._id,
      userId: order.userId,
      amount: order.totalAmount,
      currency: 'INR',
      status: 'SUCCESS',
      method: 'CASH',
      gatewayOrderId: `CASH_${Date.now()}`,
    });

    order.paymentId = payment._id;
    order.paymentStatus = 'SUCCESS';
    order.orderStatus = 'PLACED';

    await order.save();

    res.json({
      success: true,
      message: 'Counter payment confirmed',
      order,
    });
  } catch (error) {
    next(error);
  }
};

const handleWebhook = async (req, res) => {
  try {
    const signature =
      req.headers['x-razorpay-signature'];

    if (!signature) {
      return res.status(400).send('Missing signature');
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body);

    const expectedSignature = crypto
      .createHmac(
        'sha256',
        process.env.RAZORPAY_WEBHOOK_SECRET
      )
      .update(rawBody)
      .digest('hex');

    if (
      !crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      )
    ) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(
      rawBody.toString('utf8')
    );

    if (
      event.event === 'payment.captured' ||
      event.event === 'order.paid'
    ) {
      const paymentEntity =
        event.payload?.payment?.entity;

      if (!paymentEntity) {
        return res.status(200).send('OK');
      }

      const payment = await Payment.findOne({
        gatewayOrderId: paymentEntity.order_id,
      });

      if (payment) {
        payment.status = 'SUCCESS';
        payment.gatewayPaymentId = paymentEntity.id;
        payment.method = paymentEntity.method || 'Razorpay';

        await payment.save();

        const order = await Order.findById(
          payment.orderId
        );

        if (
          order &&
          order.paymentStatus !== 'SUCCESS'
        ) {
          order.paymentStatus = 'SUCCESS';
          order.orderStatus = 'PLACED';
          order.paymentId = payment._id;

          await order.save();
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook Error]', error);
    return res.status(500).send('Webhook error');
  }
};

module.exports = {
  createRazorpayOrder,
  verifyPayment,
  confirmCounterPayment,
  handleWebhook,
};