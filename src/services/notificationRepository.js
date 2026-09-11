import crypto from 'node:crypto';
import { getDatabase } from '../db/mongo.js';
import { getDeviceTokens, removeDeviceTokens } from './deviceTokenRepository.js';
import { sendPushToUser } from './fcm.js';

const memory = new Map();
const collection = () => getDatabase()?.collection('notifications');

export async function createNotification({ userId, title, body, type = 'trip', tripId = null }) {
  const notification = {
    id: crypto.randomUUID(),
    userId: String(userId),
    title: String(title).slice(0, 120),
    body: String(body).slice(0, 500),
    type: String(type).slice(0, 32),
    tripId: tripId ? String(tripId) : null,
    read: false,
    createdAt: Date.now()
  };
  const c = collection();
  if (c) await c.insertOne({ ...notification, _id: notification.id });
  else {
    const list = memory.get(notification.userId) || [];
    list.unshift(notification);
    memory.set(notification.userId, list.slice(0, 100));
  }

  const tokens = await getDeviceTokens(notification.userId);
  if (tokens.length) {
    void sendPushToUser({
      tokens,
      title: notification.title,
      body: notification.body,
      data: { notificationId: notification.id, type: notification.type, tripId: notification.tripId || '' }
    }).then(({ invalidTokens }) => removeDeviceTokens(notification.userId, invalidTokens)).catch((error) => {
      console.warn('Push notification failed:', error.message);
    });
  }

  return notification;
}

export async function listNotifications(userId, limit = 50) {
  const normalized = String(userId);
  const c = collection();
  if (c) return c.find({ userId: normalized }).sort({ createdAt: -1 }).limit(limit).toArray();
  return (memory.get(normalized) || []).slice(0, limit);
}

export async function markNotificationRead(userId, id) {
  const normalized = String(userId);
  const c = collection();
  if (c) {
    const result = await c.updateOne({ _id: String(id), userId: normalized }, { $set: { read: true, readAt: Date.now() } });
    return result.matchedCount > 0;
  }
  const item = (memory.get(normalized) || []).find((entry) => entry.id === String(id));
  if (!item) return false;
  item.read = true;
  item.readAt = Date.now();
  return true;
}
