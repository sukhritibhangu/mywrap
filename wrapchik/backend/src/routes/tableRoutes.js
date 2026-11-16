const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { getTables, getAvailableTables, createTable, updateTable } = require('../controllers/tableController');

router.get('/', protect, adminOnly, getTables);
router.get('/available', getAvailableTables);
router.post('/', protect, adminOnly, createTable);
router.put('/:id', protect, adminOnly, updateTable);

module.exports = router;
