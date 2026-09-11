import { Router } from 'express';
import { getTrip, listTrips, updateTrip } from '../services/tripRepository.js';
import { getDriver, reserveDriver, releaseDriver, setDriverAvailability } from '../services/driverRegistry.js';
import { canTransition } from '../services/tripState.js';
import { createNotification } from '../services/notificationRepository.js';
import { requireApiAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireApiAuth, allowRoles('driver'));

const appendHistory = (trip, status, actor, metadata = null) => [
  ...(Array.isArray(trip.statusHistory) ? trip.statusHistory : []),
  { status, actor, at: Date.now(), metadata }
];

const driverId = (req) => String(req.auth.userId);

router.get('/me', async (req, res, next) => {
  try {
    const driver = getDriver(driverId(req));
    if (!driver) return res.status(404).json({ success: false, message: 'بيانات الكابتن غير موجودة' });
    res.json({ success: true, data: driver });
  } catch (error) { next(error); }
});

router.patch('/availability', async (req, res, next) => {
  try {
    const driver = setDriverAvailability(driverId(req), Boolean(req.body?.available));
    if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
    res.json({ success: true, data: driver });
  } catch (error) { next(error); }
});

router.get('/trips/available', async (req, res, next) => {
  try {
    const driver = getDriver(driverId(req));
    if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
    if (!driver.available) return res.json({ success: true, data: [] });
    const trips = await listTrips();
    const data = trips.filter((trip) => trip.status === 'searching' && trip.vehicleType === driver.type).slice(0, 20);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.get('/trips', async (req, res, next) => {
  try {
    const id = driverId(req);
    const trips = await listTrips();
    const data = trips.filter((trip) => String(trip.driver?.id || '') === id);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.post('/trips/:id/accept', async (req, res, next) => {
  try {
    const id = driverId(req);
    const driver = getDriver(id);
    if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
    if (!driver.available) return res.status(409).json({ success: false, message: 'الكابتن غير متصل' });
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (trip.status !== 'searching') return res.status(409).json({ success: false, message: 'الطلب لم يعد متاحاً' });
    if (trip.vehicleType !== driver.type) return res.status(409).json({ success: false, message: 'نوع السيارة لا يطابق الطلب' });
    const reserved = reserveDriver(id);
    if (!reserved) return res.status(409).json({ success: false, message: 'الكابتن غير متاح حالياً' });
    const now = Date.now();
    const updated = await updateTrip(trip.id, {
      driver: reserved,
      status: 'driver_assigned',
      statusChangedAt: now,
      statusActor: id,
      statusHistory: appendHistory(trip, 'driver_assigned', id, { driverId: id, source: 'captain_accept' })
    });
    await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: 'قبل الكابتن رحلتك', body: `${reserved.name || 'الكابتن'} متجه إليك الآن.` });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.patch('/trips/:id/status', async (req, res, next) => {
  try {
    const id = driverId(req);
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (String(trip.driver?.id || '') !== id) return res.status(403).json({ success: false, message: 'هذه الرحلة ليست مسندة إليك' });
    const status = String(req.body?.status || '').toLowerCase();
    const allowed = new Set(['arriving', 'in_progress', 'completed']);
    if (!allowed.has(status) || !canTransition(trip.status, status)) return res.status(409).json({ success: false, message: 'انتقال حالة الرحلة غير مسموح' });
    const now = Date.now();
    const updated = await updateTrip(trip.id, {
      status,
      statusChangedAt: now,
      statusActor: id,
      statusHistory: appendHistory(trip, status, id)
    });
    if (status === 'completed') {
      releaseDriver(id);
      await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: 'اكتملت الرحلة', body: 'انتهت الرحلة بنجاح.' });
    }
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

export default router;
