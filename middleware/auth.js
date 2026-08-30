const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: '7d' });
}

async function auth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) {
      const err = new Error('Authentication required'); err.statusCode = 401; err.code = 'AUTH_REQUIRED'; throw err;
    }
    const payload = jwt.verify(header.slice(7), env.jwtSecret);
    const user = await User.findById(payload.sub).select('+password');
    if (!user || !user.isActive) {
      const err = new Error('Invalid or inactive account'); err.statusCode = 401; err.code = 'INVALID_TOKEN'; throw err;
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') { err.statusCode = 401; err.code = 'INVALID_TOKEN'; err.message = 'Invalid or expired token'; }
    next(err);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const err = new Error('Insufficient permissions'); err.statusCode = 403; err.code = 'FORBIDDEN'; return next(err);
    }
    next();
  };
}

module.exports = { signToken, auth, authorize };
