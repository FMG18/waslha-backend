import { getDatabase } from '../db/mongo.js';

const memory = new Map();
const collection = () => getDatabase()?.collection('users');

export async function upsertUser({ phone, role = 'customer' }) {
  const c = collection();
  const existing = c ? await c.findOne({ phone }) : memory.get(phone);
  const user = {
    id: existing?.id || `usr_${Buffer.from(phone).toString('hex').slice(0, 20)}`,
    phone,
    role: existing?.role || role,
    name: existing?.name || '',
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  if (c) await c.updateOne({ phone }, { $set: user, $setOnInsert: { _id: user.id } }, { upsert: true });
  else memory.set(phone, user);
  return user;
}
