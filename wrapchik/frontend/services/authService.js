import api from './api';

const authService = {
  register: (name, email, phone, password) => api.post('/auth/register', { name, email, phone, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  // Render's free API may need a minute to wake after inactivity.
  adminLogin: (email, password) => api.post('/auth/admin/login', { email, password }, { timeout: 90000 }),
  googleConfig: () => api.get('/auth/google/config', { timeout: 90000 }),
  googleChallenge: () => api.post('/auth/google/challenge', {}, { timeout: 90000 }),
  googleLogin: (credential, challengeId, phone) => api.post('/auth/google', { credential, challengeId, phone }, { timeout: 90000 }),
  requestOtp: (email, purpose = 'LOGIN') => api.post('/auth/otp/send', { email, purpose }),
  verifyOtp: (email, code, purpose = 'LOGIN') => api.post('/auth/otp/verify', { email, code, purpose }),
  requestPasswordResetOtp: (email) => api.post('/auth/password/reset/otp/send', { email }),
  resetPasswordWithOtp: (email, code, password) => api.post('/auth/password/reset/otp/verify', { email, code, password }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
};

export default authService;
