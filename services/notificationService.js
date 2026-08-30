const Notification = require('../models/Notification');

async function createNotification({ recipient, type, title, message, ride = null, data = {} }) {
  return Notification.create({ recipient, type, title, message, ride, data });
}

module.exports = { createNotification };
