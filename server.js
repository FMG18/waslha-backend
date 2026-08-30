const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { env, validateProductionEnv } = require('./config/env');
const { connectDatabase } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorHandler');

validateProductionEnv();

const app = express();
const server = http.createServer(app);

const allowedOrigins = env.corsOrigin === '*'
  ? '*'
  : env.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: allowedOrigins !== '*'
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' }
  }
});
app.use('/api', apiLimiter);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: allowedOrigins !== '*'
  }
});

app.get('/', (req, res) => {
  res.json({ success: true, data: { service: 'Waslha Backend', version: '2.0.0' } });
});

app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const databaseState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const healthy = env.nodeEnv !== 'production' || databaseState === 'connected';

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      service: 'waslha-backend',
      status: healthy ? 'ok' : 'degraded',
      database: databaseState,
      environment: env.nodeEnv
    }
  });
});

// Database connection is shared by local Node and serverless invocations.
connectDatabase().catch((error) => {
  console.error('MongoDB connection failed:', error.message);
});

// Realtime events are intentionally kept minimal in Phase 1.
// Authentication and ride-scoped rooms will be introduced in the Socket.IO phase.
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

app.use(notFound);
app.use(errorHandler);

if (require.main === module && !process.env.VERCEL) {
  server.listen(env.port, () => {
    console.log(`Waslha backend listening on port ${env.port}`);
  });
}

module.exports = { app, server, io };
