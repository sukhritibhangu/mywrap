import api from './api';

const authService = {
  register: (name, email, phone, password) => api.post('/auth/register', { name, email, phone, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
};

export default authService;
