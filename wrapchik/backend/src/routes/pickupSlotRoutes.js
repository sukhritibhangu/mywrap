const express = require('express');
const router = express.Router();
const { listPickupSlots } = require('../controllers/pickupSlotController');

router.get('/', listPickupSlots);

module.exports = router;
