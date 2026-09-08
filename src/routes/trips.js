import { Router } from 'express';
import { canTransition, allowedTransitions } from '../services/tripState.js';
import { createTrip, getTrip, listTrips, updateTrip } from '../services/tripRepository.js';

const router = Router();

const estimate = (pickup) => {
  const distanceKm = Math.max(1.2, Math.min(100, Number(pickup?.distanceKm ?? 6.4)));
  const durationMin = Math.round(distanceKm * 3.4 + 4);
  const base = 3500;
  const perKm = 900;
  return { distanceKm: Number(distanceKm.toFixed(1)), durationMin, currency: 'SYP', estimatedFare: Math.round(base + distanceKm * perKm) };
};

router.get('/', async (req, res, next) => {
  try { res.json({ success: true, data: await listTrips(req.query.customerId ? String(req.query.customerId) : null) }); }
  catch (error) { next(error); }
});

router.get('/estimate', (req, res) => {
  let pickup = {};
  try { pickup = req.query?.pickup ? JSON.parse(req.query.pickup) : {}; } catch { return res.status(400).json({ success: false, message: 'صيغة الموقع غير صالحة' }); }
  res.json({ success: true, data: estimate(pickup) });
});

router.get('/:id', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    res.json({ success: true, data: trip });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { customerId = 'guest', pickup, destination, vehicleType = 'economy', paymentMethod = 'cash', scheduledAt = null } = req.body ?? {};
    if (!pickup || !destination) return res.status(400).json({ success: false, message: 'موقع الانطلاق والوجهة مطلوبان' });
    const trip = await createTrip({ customerId: String(customerId), pickup, destination, vehicleType, paymentMethod, scheduledAt, ...estimate(pickup), status: 'searching', driver: null });
    res.status(201).json({ success: true, data: trip });
  } catch (error) { next(error); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    const nextStatus = String(req.body?.status ?? '');
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (!canTransition(trip.status, nextStatus)) return res.status(409).json({ success: false, message: 'انتقال حالة الرحلة غير مسموح', currentStatus: trip.status, allowed: allowedTransitions(trip.status) });
    const updated = await updateTrip(trip.id, { status: nextStatus });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.post('/:id/assign-driver', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (trip.status !== 'searching') return res.status(409).json({ success: false, message: 'الرحلة ليست بمرحلة البحث' });
    const driver = req.body?.driver || { id: String(req.body?.driverId || 'unknown') };
    const updated = await updateTrip(trip.id, { driver, status: 'driver_assigned' });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (!canTransition(trip.status, 'cancelled')) return res.status(409).json({ success: false, message: 'لا يمكن إلغاء هذه الرحلة حالياً' });
    const updated = await updateTrip(trip.id, { status: 'cancelled', cancelReason: String(req.body?.reason || 'customer_request').slice(0, 120) });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

export default router;
