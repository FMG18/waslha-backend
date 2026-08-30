const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  phone: { type: String, required: true, unique: true, index: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ['customer', 'captain', 'admin'], default: 'customer', index: true },
  profile: { avatarUrl: { type: String, default: '' } },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true, versionKey: false });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', { transform: (_, ret) => { delete ret.password; return ret; } });

module.exports = mongoose.model('User', userSchema);
