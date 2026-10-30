const express = require('express');

const router = express.Router();

const {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
} = require('../controllers/authController');

const {
  getFavourites,
  addFavourite,
  removeFavourite,
} = require('../controllers/favouritesController');

const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);


router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

router.get('/favourites', protect, getFavourites);
router.post('/favourites/:productId', protect, addFavourite);
router.delete('/favourites/:productId', protect, removeFavourite);

module.exports = router;