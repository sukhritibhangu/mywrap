import api from './api';

const adminService = {
  getAllOrders: (params = {}) => {
    return api.get('/admin/orders', { params });
  },

  updateOrderStatus: (id, status, rejectionReason) => {
    return api.put(`/admin/orders/${id}/status`, { status, rejectionReason });
  },

  confirmCounterPayment: (orderId) => api.post('/payment/counter-confirm', { orderId }),
  getPendingUpiPayments: () => api.get('/payment/upi/pending'),
  reviewUpiPayment: (paymentId, action, reason) => api.post(`/payment/upi/${paymentId}/review`, { action, reason }),

  getAnalytics: (params = {}) => {
    return api.get('/admin/analytics', { params });
  },

  updateSettings: (data) => {
    return api.put('/settings', data);
  },
};

export default adminService;
