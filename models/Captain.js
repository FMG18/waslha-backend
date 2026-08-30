const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: {
    type: [Number],
    required: true,
    validate: { validator: value => value.length === 2, message: 'Location must contain [lng, lat]' }
  },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const captainSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending', index: true },
  availability: { type: String, enum: ['offline', 'online', 'busy'], default: 'offline', index: true },
  currentLocation: { type: locationSchema, default: null },
  vehicle: {
    type: { type: String, enum: ['taxi', 'motorcycle', 'delivery'], default: 'taxi' },
    make: { type: String, trim: true, maxlength: 80 },
    model: { type: String, trim: true, maxlength: 80 },
    plateNumber: { type: String, trim: true, maxlength: 30 }
  },
  rating: { average: { type: Number, min: 0, max: 5, default: 0 }, count: { type: Number, min: 0, default: 0 } },
  documentsStatus: { type: String, enum: ['not_submitted', 'pending', 'approved', 'rejected'], default: 'not_submitted' }
}, { timestamps: true, versionKey: false });

captainSchema.index({ currentLocation: '2dsphere' });
captainSchema.index({ status: 1, availability: 1, 'vehicle.type': 1 });

module.exports = mongoose.model('Captain', captainSchema);
