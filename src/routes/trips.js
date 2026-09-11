import { Router } from 'express';
import { canTransition, allowedTransitions } from '../services/tripState.js';
import { createTrip, getTrip, listTrips, updateTrip } from '../services/tripRepository.js';
import { normalizeTripRequest, assertEnum, TRIP_STATUSES, VEHICLE_TYPES } from '../domain/trip-contract.js';
import { getDriver, getNearestAvailableDriver, reserveDriver, releaseDriver } from '../services/driverRegistry.js';

const router = Router();

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const coordinateDistanceKm = (a, b) => {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const radiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const vehicleMultipliers = { economy: 1, comfort: 1.2, family: 1.35 };

const estimate = (pickup, destination = null, vehicleType = 'economy') => {
  const straightLine = destination ? coordinateDistanceKm(pickup, destination) : null;
  const distanceKm = Math.max(1.2, Math.min(100, Number((straightLine ?? pickup?.distanceKm ?? 6.4))));
  const durationMin = Math.max(4, Math.round(distanceKm * 3.4 + 4));
  const base = 3500;
  const perKm = 900;
  const multiplier = vehicleMultipliers[vehicleType] ?? 1;
  const rawFare = (base + distanceKm * perKm) * multiplier;
  return { distanceKm: Number(distanceKm.toFixed(1)), durationMin, currency: 'SYP', estimatedFare: Math.round(rawFare / 250) * 250 };
};

const trackingEta = (distanceKm) => Number.isFinite(distanceKm) ? Math.max(1, Math.round(distanceKm * 3.2 + 1)) : null;
const appendStatusHistory = (trip, status, actor, metadata = null) => [
  ...(Array.isArray(trip.statusHistory) ? trip.statusHistory : []),
  { status, actor: String(actor || 'system').slice(0, 80), at: Date.now(), metadata }
];

router.get('/', async (req, res, next) => {
  try {
    const customerId = req.query.customerId ? String(req.query.customerId).trim() : null;
    res.json({ success: true, data: await listTrips(customerId) });
  } catch (error) { next(error); }
});

router.get('/estimate', (req, res) => {
  let payload = {};
  try { payload = req.query?.pickup ? JSON.parse(req.query.pickup) : {}; }
  catch { return res.status(400).json({ success: false, message: 'صيغة الموقع غير صالحة' }); }
  try {
    const pickup = payload.pickup ?? payload;
    const destination = payload.destination ?? null;
    const vehicleType = String(payload.vehicleType || 'economy').toLowerCase();
    assertEnum(vehicleType, VEHICLE_TYPES, 'نوع السيارة');
    return res.json({ success: true, data: estimate(pickup, destination, vehicleType) });
  } catch (error) { return res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
});

router.get('/:id/tracking', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    const driver = trip.driver || null;
    const active = ['searching', 'driver_assigned', 'arriving', 'in_progress'].includes(trip.status);
    const distanceToPickupKm = driver && active ? coordinateDistanceKm(driver, trip.pickup) : null;
    res.json({
      success: true,
      data: {
        tripId: trip.id,
        status: trip.status,
        driver,
        etaMinutes: active ? trackingEta(distanceToPickupKm) : null,
        distanceToPickupKm: Number.isFinite(distanceToPickupKm) ? Number(distanceToPickupKm.toFixed(2)) : null,
        updatedAt: trip.updatedAt
      }
    });
  } catch (error) { next(error); }
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
    const normalized = normalizeTripRequest(req.body ?? {});
    const now = Date.now();
    const trip = await createTrip({
      ...normalized,
      ...estimate(normalized.pickup, normalized.destination, normalized.vehicleType),
      status: TRIP_STATUSES[0], driver: null, statusChangedAt: now, statusActor: 'customer',
      statusHistory: [{ status: TRIP_STATUSES[0], actor: 'customer', at: now, metadata: null }]
    });
    res.status(201).json({ success: true, data: trip });
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    const nextStatus = String(req.body?.status ?? '').toLowerCase();
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    assertEnum(nextStatus, TRIP_STATUSES, 'حالة الرحلة');
    if (!canTransition(trip.status, nextStatus)) return res.status(409).json({ success: false, message: 'انتقال حالة الرحلة غير مسموح', currentStatus: trip.status, allowed: allowedTransitions(trip.status) });
    const actor = String(req.body?.actor || 'system').slice(0, 80);
    const now = Date.now();
    const updated = await updateTrip(trip.id, { status: nextStatus, statusChangedAt: now, statusActor: actor, statusHistory: appendStatusHistory(trip, nextStatus, actor) });
    if (nextStatus === 'completed' || nextStatus === 'cancelled') if (trip.driver?.id) releaseDriver(String(trip.driver.id));
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
});

router.post('/:id/dispatch', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (trip.status !== 'searching') return res.status(409).json({ success: false, message: 'الرحلة ليست بمرحلة البحث عن كابتن' });
    const preferredDriverId = req.body?.driverId ? String(req.body.driverId) : null;
    let driver = preferredDriverId ? getDriver(preferredDriverId) : null;
    if (driver && (!driver.available || driver.type !== trip.vehicleType)) driver = null;
    if (!driver) driver = getNearestAvailableDriver(trip.pickup, trip.vehicleType);
    if (!driver) return res.status(409).json({ success: false, message: 'لا يوجد كابتن متاح حاليًا' });
    const reserved = reserveDriver(driver.id);
    if (!reserved) return res.status(409).json({ success: false, message: 'الكابتن لم يعد متاحًا، حاول مرة أخرى' });
    const now = Date.now();
    const updated = await updateTrip(trip.id, { driver: reserved, status: 'driver_assigned', statusChangedAt: now, statusActor: 'dispatch', statusHistory: appendStatusHistory(trip, 'driver_assigned', 'dispatch', { driverId: reserved.id }) });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.post('/:id/assign-driver', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (trip.status !== 'searching') return res.status(409).json({ success: false, message: 'الرحلة ليست بمرحلة البحث' });
    const driverId = String(req.body?.driverId || req.body?.driver?.id || '');
    if (!driverId) return res.status(400).json({ success: false, message: 'معرّف الكابتن مطلوب' });
    const driver = getDriver(driverId);
    if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
    if (!driver.available || driver.type !== trip.vehicleType) return res.status(409).json({ success: false, message: 'الكابتن غير متاح لهذا الطلب' });
    const reserved = reserveDriver(driver.id);
    if (!reserved) return res.status(409).json({ success: false, message: 'الكابتن لم يعد متاحًا' });
    const now = Date.now();
    const updated = await updateTrip(trip.id, { driver: reserved, status: 'driver_assigned', statusChangedAt: now, statusActor: 'dispatch', statusHistory: appendStatusHistory(trip, 'driver_assigned', 'dispatch', { driverId: reserved.id }) });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (!canTransition(trip.status, 'cancelled')) return res.status(409).json({ success: false, message: 'لا يمكن إلغاء هذه الرحلة حالياً' });
    const reason = String(req.body?.reason || 'customer_request').slice(0, 120);
    const now = Date.now();
    const updated = await updateTrip(trip.id, { status: 'cancelled', statusChangedAt: now, statusActor: 'customer', cancelReason: reason, statusHistory: appendStatusHistory(trip, 'cancelled', 'customer', { reason }) });
    if (trip.driver?.id) releaseDriver(String(trip.driver.id));
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

export default router;
