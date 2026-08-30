const dotenv = require('dotenv');
dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  mapboxToken: process.env.MAPBOX_TOKEN || '',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

function validateProductionEnv() {
  if (env.nodeEnv === 'production') {
    const required = ['mongoUri', 'jwtSecret'];
    const missing = required.filter(key => !env[key]);
    if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    if (env.jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production');
    if (env.corsOrigin === '*') throw new Error('CORS_ORIGIN must be explicitly configured in production');
  }
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) throw new Error('PORT must be a valid TCP port');
}

module.exports = { env, validateProductionEnv };
