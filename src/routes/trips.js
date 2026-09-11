import { Router } from 'express';
import { canTransition, allowedTransitions } from '../services/tripState.js';
import { createTrip, getTrip, listTrips, updateTrip } from '../services/tripRepository.js';
import { normalizeTripRequest, assertEnum, TRIP_STATUSES, VEHICLE_TYPES, PAYMENT_METHODS } from '../domain/trip-contract.js';

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
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const vehicleMultipliers = {
  economy: 1,
  comfort: 1.2,
  family: 1.35
};

const estimate = (pickup, destination = null, vehicleType = 'economy') => {
  const straightLine = destination ? coordinateDistanceKm(pickup, destination) : null;
  const distanceKm = Math.max(
    1.2,
    Math.min(100, Number((straightLine ?? pickup?.distanceKm ?? 6.4)))
  );
  const durationMin = Math.max(4, Math.round(distanceKm * 3.4 + 4));
  const base = 3500;
  const perKm = 900;
  const multiplier = vehicleMultipliers[vehicleType] ?? 1;
  const rawFare = (base + distanceKm * perKm) * multiplier;

  return {
    distanceKm: Number(distanceKm.toFixed(1)),
    durationMin,
    currency: 'SYP',
    estimatedFare: Math.round(rawFare / 250) * 250
  };
};

router.get('/', async (req, res, next) => {
  try {
    const customerId = req.query.customerId ? String(req.query.customerId).trim() : null;
    res.json({ success: true, data: await listTrips(customerId) });
  } catch (error) { next(error); }
});

router.get('/estimate', (req, res) => {
  let payload = {};
  try {
    payload = req.query?.pickup ? JSON.parse(req.query.pickup) : {};
  } catch {
    return res.status(400).json({ success: false, message: 'صيغة الموقع غير صالحة' });
  }

  try {
    const pickup = payload.pickup ?? payload;
    const destination = payload.destination ?? null;
    const vehicleType = String(payload.vehicleType || 'economy').toLowerCase();
    assertEnum(vehicleType, VEHICLE_TYPES, 'نوع السيارة');
    if (destination) {
      return res.json({ success: true, data: estimate(pickup, destination, vehicleType) });
    }
    return res.json({ success: true, data: estimate(pickup, null, vehicleType) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
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
    const trip = await createTrip({
      ...normalized,
      ...estimate(normalized.pickup, normalized.destination, normalized.vehicleType),
      status: TRIP_STATUSES[0],
      driver: null,
      statusHistory: [{ status: TRIP_STATUSES[0], actor: 'customer', at: Date.now(), metadata: null }]
    });

    res.status(201).json({ success: true, data: trip });
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    const nextStatus = String(req.body?.status ?? '').toLowerCase();
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    assertEnum(nextStatus, TRIP_STATUSES, 'حالة الرحلة');
    if (!canTransition(trip.status, nextStatus)) {
      return res.status(409).json({
        success: false,
        message: 'انتقال حالة الرحلة غير مسموح',
        currentStatus: trip.status,
        allowed: allowedTransitions(trip.status)
      });
    }
    const updated = await updateTrip(trip.id, {
      status: nextStatus,
      statusChangedAt: Date.now(),
      statusActor: String(req.body?.actor || 'system').slice(0, 80)
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

router.post('/:id/assign-driver', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (trip.status !== 'searching') return res.status(409).json({ success: false, message: 'الرحلة ليست بمرحلة البحث' });
    const driver = req.body?.driver || { id: String(req.body?.driverId || 'unknown') };
    const updated = await updateTrip(trip.id, {
      driver,
      status: 'driver_assigned',
      statusChangedAt: Date.now(),
      statusActor: 'dispatch'
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (!canTransition(trip.status, 'cancelled')) return res.status(409).json({ success: false, message: 'لا يمكن إلغاء هذه الرحلة حالياً' });
    const updated = await updateTrip(trip.id, {
      status: 'cancelled',
      statusChangedAt: Date.now(),
      statusActor: 'customer',
      cancelReason: String(req.body?.reason || 'customer_request').slice(0, 120)
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

export default router;
