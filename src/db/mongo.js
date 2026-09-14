import { MongoClient } from 'mongodb';

let client;
let db;
let connecting;

export async function connectDatabase() {
  if (db) return db;
  if (connecting) return connecting;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  connecting = (async () => {
    const nextClient = new MongoClient(url, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 10000,
    });
    try {
      await nextClient.connect();
      const nextDb = nextClient.db(process.env.DATABASE_NAME || 'waslha');
      client = nextClient;
      db = nextDb;
      try {
        await ensureIndexes(nextDb);
      } catch (indexError) {
        console.error('MongoDB index setup warning:', indexError.message);
      }
      return db;
    } catch (error) {
      await nextClient.close().catch(() => {});
      throw error;
    }
  })();

  try {
    return await connecting;
  } finally {
    connecting = undefined;
  }
}

export async function ensureDatabase() {
  if (db) return db;
  return connectDatabase();
}

export function getDatabase() {
  return db;
}

async function ensureIndexes(database) {
  if (!database) return;
  await Promise.all([
    database.collection('users').createIndex({ phone: 1 }, { unique: true }),
    database.collection('trips').createIndex({ customerId: 1, createdAt: -1 }),
    database.collection('trips').createIndex({ status: 1, createdAt: -1 }),
    database.collection('drivers').createIndex({ available: 1, vehicleType: 1 }),
    database.collection('ratings').createIndex({ driverId: 1, createdAt: -1 }),
    database.collection('notifications').createIndex({ userId: 1, createdAt: -1 }),
    database.collection('deviceTokens').createIndex({ userId: 1, updatedAt: -1 }),
    database.collection('deviceTokens').createIndex({ userId: 1, token: 1 }, { unique: true })
  ]);
}

export async function closeDatabase() {
  if (client) await client.close().catch(() => {});
  client = undefined;
  db = undefined;
  connecting = undefined;
}
