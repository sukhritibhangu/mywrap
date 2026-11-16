import api from './api';

const authService = {
  register: (name, email, phone, password) => api.post('/auth/register', { name, email, phone, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  requestOtp: (email, purpose = 'LOGIN') => api.post('/auth/otp/send', { email, purpose }),
  verifyOtp: (email, code, purpose = 'LOGIN') => api.post('/auth/otp/verify', { email, code, purpose }),
  requestPasswordResetOtp: (email) => api.post('/auth/password/reset/otp/send', { email }),
  resetPasswordWithOtp: (email, code, password) => api.post('/auth/password/reset/otp/verify', { email, code, password }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
};

export default authService;
