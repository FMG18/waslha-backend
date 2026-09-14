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
    });
    await nextClient.connect();
    const nextDb = nextClient.db(process.env.DATABASE_NAME || 'waslha');
    await ensureIndexes(nextDb);
    client = nextClient;
    db = nextDb;
    return db;
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
  if (client) await client.close();
  client = undefined;
  db = undefined;
  connecting = undefined;
}
