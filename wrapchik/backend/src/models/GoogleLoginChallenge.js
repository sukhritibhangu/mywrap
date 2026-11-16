const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  nonceHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model('GoogleLoginChallenge', schema);
