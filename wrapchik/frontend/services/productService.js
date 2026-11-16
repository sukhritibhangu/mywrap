import api from './api';

const productService = {
  getPopularProducts: () => api.get('/products/popular'),
  getProducts: (params = {}) => {
    return api.get('/products', { params });
  },

  getProductById: (id) => {
    return api.get(`/products/${id}`);
  },

  createProduct: (productData) => {
    return api.post('/products', productData);
  },

  updateProduct: (id, productData) => {
    return api.put(`/products/${id}`, productData);
  },

  toggleAvailability: (id, available) => {
    return api.patch(`/products/${id}/availability`, { available });
  },

  deleteProduct: (id) => {
    return api.delete(`/products/${id}`);
  },
};

export default productService;
