const isValidUpiId = (value) => typeof value === 'string' && /^[\w.-]{2,100}@[\w.-]{2,60}$/.test(value.trim());
const isSupportedNewPaymentMethod = (method) => method === 'COUNTER' || method === 'UPI_QR';

const MAX_QR_IMAGE_BYTES = 512 * 1024;
const isValidUpiQrImage = (value) => {
  if (value === '') return true;
  if (typeof value !== 'string') return false;
  if (value.startsWith('https://') && value.length <= 1000) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  }
  if (value.length > 700000) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_QR_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return false;
  if (match[1] === 'png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (match[1] === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
};

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

module.exports = { isValidUpiId, isUpiConfigured, isSupportedNewPaymentMethod, createUpiPaymentUri, isValidUpiQrImage, MAX_QR_IMAGE_BYTES };
