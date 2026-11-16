const isValidUpiId = (value) => typeof value === 'string' && /^[\w.-]{2,100}@[\w.-]{2,60}$/.test(value.trim());
const isSupportedNewPaymentMethod = (method) => method === 'COUNTER' || method === 'UPI_QR';

const isUpiConfigured = (settings) => Boolean(
  settings?.upiEnabled === true
  && isValidUpiId(settings.upiId)
  && typeof settings.upiPayeeName === 'string'
  && settings.upiPayeeName.trim().length > 0
);

const createUpiPaymentUri = ({ upiId, payeeName, amount, orderId, orderNumber }) => {
  if (!isValidUpiId(upiId) || !payeeName?.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !orderId) {
    throw new Error('Valid outlet UPI settings, amount, and order reference are required.');
  }
  const params = new URLSearchParams({
    pa: upiId.trim(),
    pn: payeeName.trim(),
    mc: '',
    tr: String(orderId),
    tn: `Wrapchik order ${orderNumber || orderId}`,
    am: Number(amount).toFixed(2),
    cu: 'INR',
  });
  params.delete('mc');
  return `upi://pay?${params.toString()}`;
};

module.exports = { isValidUpiId, isUpiConfigured, isSupportedNewPaymentMethod, createUpiPaymentUri };
