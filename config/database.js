const mongoose = require('mongoose');
const { env } = require('./env');

let connectionPromise = null;

async function connectDatabase() {
  if (!env.mongoUri) {
    if (env.nodeEnv === 'production') {
      throw new Error('MONGO_URI is required in production');
    }
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000
    }).then(() => mongoose.connection);
  }

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

module.exports = { connectDatabase };
