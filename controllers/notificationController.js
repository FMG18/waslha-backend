const mongoose = require('mongoose');
const Notification = require('../models/Notification');

async function list(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const notifications = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, data: notifications });
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { const e = new Error('Notification not found'); e.statusCode = 404; e.code = 'NOTIFICATION_NOT_FOUND'; throw e; }
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { $set: { readAt: new Date() } }, { new: true });
    if (!notification) { const e = new Error('Notification not found'); e.statusCode = 404; e.code = 'NOTIFICATION_NOT_FOUND'; throw e; }
    res.json({ success: true, data: notification });
  } catch (err) { next(err); }
}
module.exports = { list, markRead };
