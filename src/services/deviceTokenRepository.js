import crypto from 'node:crypto';
import { getDatabase } from '../db/mongo.js';

const memory = new Map();
const collection = () => getDatabase()?.collection('deviceTokens');

export async function registerDeviceToken(userId, token) {
  const uid = String(userId).trim();
  const value = String(token).trim();
  if (!uid || !value || value.length > 4096) return { registered: false, tokenCount: 0 };
  const c = collection();
  const now = Date.now();
  if (c) {
    await c.updateOne(
      { userId: uid, token: value },
      { $set: { userId: uid, token: value, updatedAt: now }, $setOnInsert: { _id: crypto.randomUUID(), createdAt: now } },
      { upsert: true }
    );
    const tokenCount = await c.countDocuments({ userId: uid });
    return { registered: true, tokenCount };
  }
  const items = memory.get(uid) || new Set();
  items.add(value);
  while (items.size > 8) items.delete(items.values().next().value);
  memory.set(uid, items);
  return { registered: true, tokenCount: items.size };
}

export async function getDeviceTokens(userId) {
  const uid = String(userId);
  const c = collection();
  if (c) return (await c.find({ userId: uid }).project({ token: 1, _id: 0 }).toArray()).map((item) => item.token).filter(Boolean);
  return Array.from(memory.get(uid) || []);
}

export async function removeDeviceTokens(userId, tokens) {
  const uid = String(userId);
  const values = tokens.map((item) => String(item)).filter(Boolean);
  if (!values.length) return;
  const c = collection();
  if (c) {
    await c.deleteMany({ userId: uid, token: { $in: values } });
    return;
  }
  const set = memory.get(uid);
  if (set) values.forEach((value) => set.delete(value));
}
