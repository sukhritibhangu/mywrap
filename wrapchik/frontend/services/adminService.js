import api from './api';

const adminService = {
  getAllOrders: (params = {}) => {
    return api.get('/admin/orders', { params });
  },

  updateOrderStatus: (id, status, rejectionReason) => {
    return api.put(`/admin/orders/${id}/status`, { status, rejectionReason });
  },

  getAnalytics: () => {
    return api.get('/admin/analytics');
  },

  getSettings: () => api.get('/settings'),

  updateSettings: (data) => {
    return api.put('/settings', data);
  },
};

export default adminService;
