const { env, validation } = require('../config/env');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');

let appPromise = null;
let databaseReadyPromise = null;

function getApp() {
  if (!appPromise) appPromise = Promise.resolve().then(() => require('../server'));
  return appPromise;
}

function safeDbError(error) {
  if (!error) return null;
  const message = String(error.message || 'Unknown database error');
  return {
    name: error.name || 'Error',
    code: error.code || null,
    message: message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[redacted-mongodb-uri]')
  };
}

function ensureDatabase() {
  if (!databaseReadyPromise) {
    databaseReadyPromise = connectDatabase().catch(error => {
      databaseReadyPromise = null;
      console.error('DATABASE_CONNECTION_FAILED', JSON.stringify(safeDbError(error)));
      throw error;
    });
  }
  return databaseReadyPromise;
}

function healthPayload() {
  const database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const missing = validation.errors.filter(name => !name.endsWith('_TOO_SHORT'));
  const healthy = validation.valid && database === 'connected';
  return {
    success: healthy,
    data: {
      service: 'waslha-backend',
      status: healthy ? 'ok' : 'degraded',
      database,
      environment: env.nodeEnv,
      configuration: { valid: validation.valid, missing }
    },
    ...(healthy ? {} : {
      error: {
        code: database !== 'connected' && missing.includes('MONGO_URI') ? 'CONFIGURATION_REQUIRED' : 'SERVICE_NOT_READY',
        message: 'Backend configuration or database is not ready'
      }
    })
  };
}

module.exports = async function handler(req, res) {
  const path = req.url?.split('?')[0] || '/';

  if (path === '/') {
    return res.status(200).json({ success: true, data: { service: 'Waslha Backend', version: '2.8.0', runtime: 'vercel' } });
  }

  if (path === '/health') {
    try {
      await ensureDatabase();
    } catch (error) {
      const payload = healthPayload();
      payload.error = {
        code: error.code || error.name || 'DATABASE_CONNECTION_FAILED',
        message: safeDbError(error)?.message || 'Database connection failed'
      };
      return res.status(503).json(payload);
    }
    return res.status(healthPayload().success ? 200 : 503).json(healthPayload());
  }

  try {
    await ensureDatabase();
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error('Vercel handler initialization failed:', JSON.stringify(safeDbError(error)));
    return res.status(503).json({
      success: false,
      error: {
        code: error.code || error.name || 'SERVICE_UNAVAILABLE',
        message: safeDbError(error)?.message || 'Backend service is temporarily unavailable'
      }
    });
  }
};
