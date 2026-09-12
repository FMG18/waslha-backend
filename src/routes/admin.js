import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { getTrip, listTrips, updateTrip } from '../services/tripRepository.js';
import { listDrivers, getDriver, reserveDriver, releaseDriver, setDriverAvailability } from '../services/driverRegistry.js';
import { canTransition } from '../services/tripState.js';
import { createNotification } from '../services/notificationRepository.js';

const router = Router();
router.use(requireAuth, allowRoles('admin'));

const appendHistory = (trip, status, actor, metadata = null) => [
  ...(Array.isArray(trip.statusHistory) ? trip.statusHistory : []),
  { status, actor, at: Date.now(), metadata }
];

router.get('/overview', async (_req, res, next) => {
  try {
    const trips = await listTrips();
    const drivers = listDrivers();
    const completed = trips.filter((t) => t.status === 'completed');
    const active = trips.filter((t) => ['searching', 'driver_assigned', 'arriving', 'in_progress'].includes(t.status));
    const waiting = trips.filter((t) => t.status === 'searching');
    const revenue = completed.reduce((sum, trip) => sum + Number(trip.estimatedFare || 0), 0);
    res.json({ success: true, data: { totals: { trips: trips.length, activeTrips: active.length, waitingTrips: waiting.length, completedTrips: completed.length, drivers: drivers.length, onlineDrivers: drivers.filter((d) => d.available).length, revenue }, latestTrips: trips.slice(0, 20) } });
  } catch (error) { next(error); }
});

router.get('/trips', async (_req, res, next) => {
  try { res.json({ success: true, data: await listTrips() }); }
  catch (error) { next(error); }
});

router.get('/trips/:id', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    res.json({ success: true, data: trip });
  } catch (error) { next(error); }
});

router.post('/trips/:id/assign-driver', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (trip.status !== 'searching') return res.status(409).json({ success: false, message: 'الرحلة ليست بانتظار كابتن' });
    const driverId = String(req.body?.driverId || '');
    if (!driverId) return res.status(400).json({ success: false, message: 'معرّف الكابتن مطلوب' });
    const driver = getDriver(driverId);
    if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
    if (!driver.available || driver.type !== trip.vehicleType) return res.status(409).json({ success: false, message: 'الكابتن غير متاح أو نوع المركبة غير مطابق' });
    const reserved = reserveDriver(driver.id);
    if (!reserved) return res.status(409).json({ success: false, message: 'الكابتن لم يعد متاحاً' });
    const now = Date.now();
    const updated = await updateTrip(trip.id, { driver: reserved, status: 'driver_assigned', statusChangedAt: now, statusActor: 'admin', statusHistory: appendHistory(trip, 'driver_assigned', 'admin', { driverId: reserved.id }) });
    await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: 'تم تعيين كابتن', body: `${reserved.name || 'الكابتن'} تم تعيينه لرحلتك.` });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.patch('/trips/:id/status', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    const status = String(req.body?.status || '').toLowerCase();
    if (!['arriving', 'in_progress', 'completed'].includes(status)) return res.status(400).json({ success: false, message: 'حالة غير صالحة للإدارة' });
    if (!canTransition(trip.status, status)) return res.status(409).json({ success: false, message: 'انتقال حالة الرحلة غير مسموح' });
    const now = Date.now();
    const updated = await updateTrip(trip.id, { status, statusChangedAt: now, statusActor: 'admin', statusHistory: appendHistory(trip, status, 'admin') });
    if (status === 'completed' && trip.driver?.id) releaseDriver(String(trip.driver.id));
    await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: 'تحديث الرحلة', body: `تم تحديث حالة الرحلة إلى ${status}.` });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.post('/trips/:id/cancel', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (['completed', 'cancelled'].includes(trip.status)) return res.status(409).json({ success: false, message: 'لا يمكن إلغاء هذه الرحلة' });
    if (!canTransition(trip.status, 'cancelled')) return res.status(409).json({ success: false, message: 'لا يمكن إلغاء الرحلة في حالتها الحالية' });
    const reason = String(req.body?.reason || 'admin_cancel').slice(0, 120);
    const now = Date.now();
    const updated = await updateTrip(trip.id, { status: 'cancelled', statusChangedAt: now, statusActor: 'admin', cancelReason: reason, statusHistory: appendHistory(trip, 'cancelled', 'admin', { reason }) });
    if (trip.driver?.id) releaseDriver(String(trip.driver.id));
    await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: 'تم إلغاء الرحلة', body: 'تم إلغاء الرحلة من الإدارة.' });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.get('/drivers', (_req, res) => {
  const drivers = listDrivers();
  res.json({ success: true, data: drivers, meta: { count: drivers.length, online: drivers.filter((d) => d.available).length } });
});

router.get('/drivers/:id', (req, res) => {
  const driver = getDriver(req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
});

router.patch('/drivers/:id/availability', (req, res) => {
  const driver = setDriverAvailability(req.params.id, Boolean(req.body?.available));
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
});

export default router;
