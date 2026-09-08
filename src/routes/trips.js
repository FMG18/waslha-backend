import { Router } from 'express';
import crypto from 'node:crypto';

const router = Router();
const trips = new Map();

const validStatuses = new Set(['searching', 'driver_assigned', 'arriving', 'in_progress', 'completed', 'cancelled']);
const estimate = (pickup, destination) => {
  const distanceKm = Math.max(1.2, Math.min(35, Number(pickup?.distanceKm ?? 6.4)));
  const durationMin = Math.round(distanceKm * 3.4 + 4);
  const base = 3500;
  const perKm = 900;
  return { distanceKm: Number(distanceKm.toFixed(1)), durationMin, currency: 'SYP', estimatedFare: Math.round(base + distanceKm * perKm) };
};

router.get('/', (_req, res) => {
  res.json({ success: true, data: [...trips.values()].sort((a, b) => b.createdAt - a.createdAt) });
});

router.get('/estimate', (req, res) => {
  const data = estimate(req.query?.pickup ? JSON.parse(req.query.pickup) : {}, req.query?.destination ? JSON.parse(req.query.destination) : {});
  res.json({ success: true, data });
});

router.get('/:id', (req, res) => {
  const trip = trips.get(req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
  res.json({ success: true, data: trip });
});

router.post('/', (req, res) => {
  const { customerId = 'guest', pickup, destination, vehicleType = 'economy', paymentMethod = 'cash' } = req.body ?? {};
  if (!pickup || !destination) return res.status(400).json({ success: false, message: 'موقع الانطلاق والوجهة مطلوبان' });

  const id = `W-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const pricing = estimate(pickup, destination);
  const trip = { id, customerId, pickup, destination, vehicleType, paymentMethod, ...pricing, status: 'searching', driver: null, createdAt: Date.now(), updatedAt: Date.now() };
  trips.set(id, trip);
  res.status(201).json({ success: true, data: trip });
});

router.patch('/:id/status', (req, res) => {
  const trip = trips.get(req.params.id);
  const status = String(req.body?.status ?? '');
  if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
  if (!validStatuses.has(status)) return res.status(400).json({ success: false, message: 'حالة الرحلة غير صالحة' });
  trip.status = status;
  trip.updatedAt = Date.now();
  trips.set(trip.id, trip);
  res.json({ success: true, data: trip });
});

router.post('/:id/cancel', (req, res) => {
  const trip = trips.get(req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
  if (['completed', 'cancelled'].includes(trip.status)) return res.status(409).json({ success: false, message: 'لا يمكن إلغاء هذه الرحلة' });
  trip.status = 'cancelled';
  trip.cancelReason = req.body?.reason || 'customer_request';
  trip.updatedAt = Date.now();
  trips.set(trip.id, trip);
  res.json({ success: true, data: trip });
});

export default router;
