import { Router } from 'express';
import { canTransition, allowedTransitions } from '../services/tripState.js';
import { createTrip, getTrip, listTrips, updateTrip } from '../services/tripRepository.js';
import { normalizeTripRequest, assertEnum, TRIP_STATUSES, VEHICLE_TYPES } from '../domain/trip-contract.js';
import { getDriver, getNearestAvailableDriver, reserveDriver, releaseDriver } from '../services/driverRegistry.js';
import { calculateFare, cancellationPolicy } from '../services/pricing.js';
import { createNotification } from '../services/notificationRepository.js';

const router = Router();

const toRadians = (value) => (Number(value) * Math.PI) / 180;
const coordinateDistanceKm = (a, b) => {
  const lat1 = Number(a?.lat); const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat); const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const dLat = toRadians(lat2 - lat1); const dLng = toRadians(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const estimate = (pickup, destination = null, vehicleType = 'economy') => {
  const straightLine = destination ? coordinateDistanceKm(pickup, destination) : null;
  const distanceKm = Math.max(1.2, Math.min(100, Number((straightLine ?? pickup?.distanceKm ?? 6.4))));
  return calculateFare(vehicleType, distanceKm);
};

const trackingEta = (distanceKm) => Number.isFinite(distanceKm) ? Math.max(1, Math.round(distanceKm * 3.2 + 1)) : null;
const appendStatusHistory = (trip, status, actor, metadata = null) => [
  ...(Array.isArray(trip.statusHistory) ? trip.statusHistory : []),
  { status, actor: String(actor || 'system').slice(0, 80), at: Date.now(), metadata }
];

const statusNotification = (status) => {
  const messages = {
    searching: ['بدأ البحث عن كابتن', 'جاري البحث عن كابتن مناسب لرحلتك.'],
    driver_assigned: ['تم العثور على كابتن', 'تم تعيين كابتن لرحلتك.'],
    arriving: ['الكابتن في الطريق', 'الكابتن متجه إلى نقطة الانطلاق.'],
    in_progress: ['بدأت الرحلة', 'رحلتك الآن قيد التنفيذ.'],
    completed: ['اكتملت الرحلة', 'انتهت رحلتك بنجاح.']
  };
  return messages[status] || null;
};

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
    const result = estimate(pickup, destination, vehicleType);
    if (!result) return res.status(400).json({ success: false, message: 'المسافة غير صالحة' });
    res.json({ success: true, data: result });
  } catch (error) { return res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
});

router.get('/:id/tracking', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    const driver = trip.driver || null;
    const active = ['searching', 'driver_assigned', 'arriving', 'in_progress'].includes(trip.status);
    const distanceToPickupKm = driver && active ? coordinateDistanceKm(driver, trip.pickup) : null;
    res.json({ success: true, data: {
      tripId: trip.id, status: trip.status, driver,
      etaMinutes: active ? trackingEta(distanceToPickupKm) : null,
      distanceToPickupKm: Number.isFinite(distanceToPickupKm) ? Number(distanceToPickupKm.toFixed(2)) : null,
      updatedAt: trip.updatedAt
    }});
  } catch (error) { next(error); }
});

router.get('/:id/cancellation-policy', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    res.json({ success: true, data: cancellationPolicy(trip.status) });
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
    const fare = estimate(normalized.pickup, normalized.destination, normalized.vehicleType);
    if (!fare) return res.status(400).json({ success: false, message: 'تعذر حساب أجرة الرحلة' });
    const now = Date.now();
    const trip = await createTrip({
      ...normalized, ...fare,
      status: TRIP_STATUSES[0], driver: null,
      statusChangedAt: now, statusActor: 'customer',
      statusHistory: [{ status: TRIP_STATUSES[0], actor: 'customer', at: now, metadata: null }]
    });
    await createNotification({ userId: normalized.customerId, tripId: trip.id, type: 'trip', title: 'تم استلام طلب الرحلة', body: 'جاري البحث عن كابتن لرحلتك.' });
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
    const notice = statusNotification(nextStatus);
    if (notice) await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: notice[0], body: notice[1] });
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
    await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: 'تم العثور على كابتن', body: `${reserved.name || 'الكابتن'} في طريقه لاستلام الرحلة.` });
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
    await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: 'تم العثور على كابتن', body: `${reserved.name || 'الكابتن'} تم تعيينه لرحلتك.` });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    const policy = cancellationPolicy(trip.status);
    if (!policy.allowed || !canTransition(trip.status, 'cancelled')) return res.status(409).json({ success: false, message: 'لا يمكن إلغاء هذه الرحلة حالياً', cancellation: policy });
    const reason = String(req.body?.reason || 'customer_request').slice(0, 120);
    const now = Date.now();
    const updated = await updateTrip(trip.id, {
      status: 'cancelled', statusChangedAt: now, statusActor: 'customer',
      cancelReason: reason, cancellationFee: policy.fee,
      statusHistory: appendStatusHistory(trip, 'cancelled', 'customer', { reason, fee: policy.fee })
    });
    if (trip.driver?.id) releaseDriver(String(trip.driver.id));
    await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: 'تم إلغاء الرحلة', body: policy.fee > 0 ? `تم إلغاء الرحلة. رسوم الإلغاء: ${policy.fee} ل.س.` : 'تم إلغاء الرحلة بدون رسوم.' });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

export default router;
