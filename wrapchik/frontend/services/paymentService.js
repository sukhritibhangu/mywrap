import api from './api';

const paymentService = {
  getUpiInstructions: (orderId) => api.get(`/payment/upi/${orderId}/instructions`),
  submitUpiReference: (orderId, transactionReference) => api.post('/payment/upi/submit', { orderId, transactionReference }),
};

export default paymentService;
