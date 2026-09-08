import { Router } from 'express';
import crypto from 'node:crypto';
import { canTransition, allowedTransitions } from '../services/tripState.js';

const router = Router();
const trips = new Map();

const estimate = (pickup) => {
  const distanceKm = Math.max(1.2, Math.min(100, Number(pickup?.distanceKm ?? 6.4)));
  const durationMin = Math.round(distanceKm * 3.4 + 4);
  const base = 3500;
  const perKm = 900;
  return { distanceKm: Number(distanceKm.toFixed(1)), durationMin, currency: 'SYP', estimatedFare: Math.round(base + distanceKm * perKm) };
};

router.get('/', (req, res) => {
  const customerId = req.query.customerId ? String(req.query.customerId) : null;
  const data = [...trips.values()]
    .filter((trip) => !customerId || trip.customerId === customerId)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ success: true, data });
});

router.get('/estimate', (req, res) => {
  const pickup = req.query?.pickup ? JSON.parse(req.query.pickup) : {};
  res.json({ success: true, data: estimate(pickup) });
});

router.get('/:id', (req, res) => {
  const trip = trips.get(req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
  res.json({ success: true, data: trip });
});

router.post('/', (req, res) => {
  const { customerId = 'guest', pickup, destination, vehicleType = 'economy', paymentMethod = 'cash', scheduledAt = null } = req.body ?? {};
  if (!pickup || !destination) return res.status(400).json({ success: false, message: 'موقع الانطلاق والوجهة مطلوبان' });
  const id = `W-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const trip = {
    id, customerId: String(customerId), pickup, destination, vehicleType, paymentMethod, scheduledAt,
    ...estimate(pickup), status: 'searching', driver: null, createdAt: Date.now(), updatedAt: Date.now()
  };
  trips.set(id, trip);
  res.status(201).json({ success: true, data: trip });
});

router.patch('/:id/status', (req, res) => {
  const trip = trips.get(req.params.id);
  const next = String(req.body?.status ?? '');
  if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
  if (!canTransition(trip.status, next)) {
    return res.status(409).json({ success: false, message: 'انتقال حالة الرحلة غير مسموح', currentStatus: trip.status, allowed: allowedTransitions(trip.status) });
  }
  trip.status = next;
  trip.updatedAt = Date.now();
  trips.set(trip.id, trip);
  res.json({ success: true, data: trip });
});

router.post('/:id/assign-driver', (req, res) => {
  const trip = trips.get(req.params.id);
  const { driverId, driver } = req.body || {};
  if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
  if (trip.status !== 'searching') return res.status(409).json({ success: false, message: 'الرحلة ليست بمرحلة البحث' });
  trip.driver = driver || { id: driverId || 'unknown' };
  trip.status = 'driver_assigned';
  trip.updatedAt = Date.now();
  trips.set(trip.id, trip);
  res.json({ success: true, data: trip });
});

router.post('/:id/cancel', (req, res) => {
  const trip = trips.get(req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
  if (!canTransition(trip.status, 'cancelled')) return res.status(409).json({ success: false, message: 'لا يمكن إلغاء هذه الرحلة حالياً' });
  trip.status = 'cancelled';
  trip.cancelReason = String(req.body?.reason || 'customer_request').slice(0, 120);
  trip.updatedAt = Date.now();
  trips.set(trip.id, trip);
  res.json({ success: true, data: trip });
});

export default router;
