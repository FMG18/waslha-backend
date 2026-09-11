import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  client = new MongoClient(url);
  await client.connect();
  db = client.db(process.env.DATABASE_NAME || 'waslha');
  await ensureIndexes();
  return db;
}

export function getDatabase() {
  return db;
}

async function ensureIndexes() {
  if (!db) return;
  await Promise.all([
    db.collection('users').createIndex({ phone: 1 }, { unique: true }),
    db.collection('trips').createIndex({ customerId: 1, createdAt: -1 }),
    db.collection('trips').createIndex({ status: 1, createdAt: -1 }),
    db.collection('drivers').createIndex({ available: 1, vehicleType: 1 }),
    db.collection('ratings').createIndex({ driverId: 1, createdAt: -1 }),
    db.collection('notifications').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('deviceTokens').createIndex({ userId: 1, updatedAt: -1 }),
    db.collection('deviceTokens').createIndex({ userId: 1, token: 1 }, { unique: true })
  ]);
}

export async function closeDatabase() {
  if (client) await client.close();
  client = undefined;
  db = undefined;
}
