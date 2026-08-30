const mongoose = require('mongoose');

const captainSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending', index: true },
  availability: { type: String, enum: ['offline', 'online', 'busy'], default: 'offline', index: true },
  currentLocation: { lat: Number, lng: Number, updatedAt: Date },
  vehicle: { type: { type: String, enum: ['taxi', 'motorcycle', 'delivery'], default: 'taxi' }, make: String, model: String, plateNumber: String },
  rating: { average: { type: Number, min: 0, max: 5, default: 0 }, count: { type: Number, min: 0, default: 0 } },
  documentsStatus: { type: String, enum: ['not_submitted', 'pending', 'approved', 'rejected'], default: 'not_submitted' }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Captain', captainSchema);
