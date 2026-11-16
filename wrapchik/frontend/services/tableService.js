import api from './api';

const tableService = {
  getTables: () => api.get('/tables'),
  getAvailableTables: () => api.get('/tables/available'),
  createTable: data => api.post('/tables', data),
  updateTable: (id, data) => api.put(`/tables/${id}`, data),
};

export default tableService;
