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

export async function upsertGoogleUser({ googleSub, email, name = '', picture = '', role = 'customer' }) {
  const c = collection();
  const normalizedEmail = String(email).toLowerCase();
  const query = { $or: [{ googleSub }, { email: normalizedEmail }] };
  const existing = c ? await c.findOne(query) : [...memory.values()].find((user) => user.googleSub === googleSub || user.email === normalizedEmail);

  const user = {
    id: existing?.id || `usr_google_${Buffer.from(googleSub).toString('hex').slice(0, 20)}`,
    phone: existing?.phone || '',
    role: existing?.role || role,
    name: existing?.name || name,
    email: normalizedEmail,
    emailVerified: true,
    googleSub,
    picture: existing?.picture || picture,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  if (c) {
    await c.updateOne(
      existing ? { _id: existing._id || existing.id } : { googleSub },
      { $set: user, $setOnInsert: { _id: user.id } },
      { upsert: true }
    );
  } else {
    if (existing && existing.id !== user.id) memory.delete(existing.email || existing.googleSub);
    memory.set(user.id, user);
    memory.set(user.googleSub, user);
    memory.set(user.email, user);
  }

  return user;
}
