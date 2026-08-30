const User = require('../models/User');
const Captain = require('../models/Captain');
const { signToken } = require('../middleware/auth');

async function register(req, res, next) {
  try {
    const { name, phone, password, role } = req.body;
    if (!name || !phone || !password) { const e = new Error('name, phone and password are required'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e; }
    if (password.length < 6) { const e = new Error('Password must be at least 6 characters'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e; }
    const normalizedPhone = String(phone).trim();
    if (await User.exists({ phone: normalizedPhone })) { const e = new Error('Phone is already registered'); e.statusCode = 409; e.code = 'PHONE_EXISTS'; throw e; }
    const safeRole = role === 'captain' ? 'captain' : 'customer';
    const user = await User.create({ name, phone: normalizedPhone, password, role: safeRole });
    if (safeRole === 'captain') await Captain.create({ user: user._id });
    return res.status(201).json({ success: true, data: { user, token: signToken(user) } });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone: String(phone || '').trim() }).select('+password');
    if (!user || !(await user.comparePassword(password || ''))) { const e = new Error('Invalid phone or password'); e.statusCode = 401; e.code = 'INVALID_CREDENTIALS'; throw e; }
    res.json({ success: true, data: { user, token: signToken(user) } });
  } catch (err) { next(err); }
}
module.exports = { register, login };
