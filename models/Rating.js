const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true, unique: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  captain: { type: mongoose.Schema.Types.ObjectId, ref: 'Captain', required: true, index: true },
  score: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Rating', ratingSchema);
