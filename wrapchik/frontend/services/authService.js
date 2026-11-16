import api from './api';

const authService = {
  register: (name, email, phone, password) => api.post('/auth/register', { name, email, phone, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  adminLogin: (email, password) => api.post('/auth/admin/login', { email, password }),
  googleConfig: () => api.get('/auth/google/config'),
  googleChallenge: () => api.post('/auth/google/challenge'),
  googleLogin: (credential, challengeId, phone) => api.post('/auth/google', { credential, challengeId, phone }),
  requestOtp: (email, purpose = 'LOGIN') => api.post('/auth/otp/send', { email, purpose }),
  verifyOtp: (email, code, purpose = 'LOGIN') => api.post('/auth/otp/verify', { email, code, purpose }),
  requestPasswordResetOtp: (email) => api.post('/auth/password/reset/otp/send', { email }),
  resetPasswordWithOtp: (email, code, password) => api.post('/auth/password/reset/otp/verify', { email, code, password }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
};

export default authService;
