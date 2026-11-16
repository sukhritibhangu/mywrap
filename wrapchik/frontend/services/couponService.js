import api from './api';

const couponService = { validate: data => api.post('/coupons/validate', data), getAvailable: () => api.get('/coupons/available'), getAll: () => api.get('/coupons'), create: data => api.post('/coupons', data), update: (id, data) => api.put(`/coupons/${id}`, data) };
export default couponService;
