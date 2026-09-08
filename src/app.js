import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import catalogRoutes from './routes/catalog.js';
import driverRoutes from './routes/drivers.js';
import ratingRoutes from './routes/ratings.js';
import pricingRoutes from './routes/pricing.js';
import notificationRoutes from './routes/notifications.js';
import supportRoutes from './routes/support.js';

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',').map((v) => v.trim()).filter(Boolean) || true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.get('/health', (_req, res) => res.json({ success: true, service: 'waslha-backend', version: '1.3.0', status: 'ready' }));
app.get('/api/v1', (_req, res) => res.json({ success: true, service: 'Waslha Taxi API', version: 'v1', mode: 'taxi-only' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/ratings', ratingRoutes);
app.use('/api/v1/pricing', pricingRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/support', supportRoutes);

app.use((_req, res) => res.status(404).json({ success: false, message: 'المسار غير موجود' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'حدث خطأ داخلي في الخادم' });
});

export default app;
