const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');

async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('Authentication required'));
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).select('_id name phone role isActive');
    if (!user || !user.isActive) return next(new Error('Invalid or inactive account'));
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Invalid or expired token'));
  }
}

module.exports = { socketAuth };
