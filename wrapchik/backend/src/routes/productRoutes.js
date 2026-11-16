const express = require('express');
const router = express.Router();
const {
  getPopularProducts,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductAvailability,
  deleteProduct,
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', getProducts);
router.get('/popular', getPopularProducts);
router.get('/:id', getProductById);
router.post('/', protect, adminOnly, createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.patch('/:id/availability', protect, adminOnly, toggleProductAvailability);
router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;
