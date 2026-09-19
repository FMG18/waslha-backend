import { Router } from 'express';
import crypto from 'node:crypto';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { getTrip, listTrips, updateTrip } from '../services/tripRepository.js';
import { getDatabase } from '../db/mongo.js';
import { upsertDriverProfile } from '../services/driverRegistry.js';
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
    const drivers = await listDrivers();
    const completed = trips.filter((t) => t.status === 'completed');
    const active = trips.filter((t) => ['searching', 'driver_assigned', 'arriving', 'in_progress'].includes(t.status));
    const waiting = trips.filter((t) => t.status === 'searching');
    const revenue = completed.reduce((sum, trip) => sum + Number(trip.estimatedFare || 0), 0);
    res.json({ success: true, data: { totals: { trips: trips.length, activeTrips: active.length, waitingTrips: waiting.length, completedTrips: completed.length, drivers: drivers.length, onlineDrivers: drivers.filter((d) => d.available).length, revenue }, latestTrips: trips.slice(0, 20) } });
  } catch (error) { next(error); }
});

router.get('/map', async (_req, res, next) => {
  try {
    const trips = await listTrips();
    const activeTrips = trips.filter((trip) => trip.pickup && trip.destination && !['completed', 'cancelled'].includes(trip.status));
    const drivers = (await listDrivers()).map((driver) => ({
      ...driver,
      lat: Number.isFinite(Number(driver.lat)) ? Number(driver.lat) : null,
      lng: Number.isFinite(Number(driver.lng)) ? Number(driver.lng) : null,
      lastLocationAt: driver.lastLocationAt || null
    }));
    res.json({ success: true, data: { updatedAt: Date.now(), trips: activeTrips, drivers } });
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
    const driver = await getDriver(driverId);
    if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
    if (!driver.available || driver.type !== trip.vehicleType) return res.status(409).json({ success: false, message: 'الكابتن غير متاح أو نوع المركبة غير مطابق' });
    const reserved = await reserveDriver(driver.id);
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
    if (status === 'completed' && trip.driver?.id) await releaseDriver(String(trip.driver.id));
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
    if (trip.driver?.id) await releaseDriver(String(trip.driver.id));
    await createNotification({ userId: trip.customerId, tripId: trip.id, type: 'trip', title: 'تم إلغاء الرحلة', body: 'تم إلغاء الرحلة من الإدارة.' });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.post('/drivers', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });

    const phone = String(req.body?.phone || '').replace(/\s+/g, '').trim();
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const type = String(req.body?.type || 'economy').toLowerCase();
    const vehicle = String(req.body?.vehicle || '').trim().slice(0, 80);
    const plate = String(req.body?.plate || '').trim().slice(0, 30);

    if (!/^\+?[0-9]{8,15}$/.test(phone)) return res.status(400).json({ success: false, message: 'رقم الهاتف غير صالح' });
    if (!name) return res.status(400).json({ success: false, message: 'اسم الكابتن مطلوب' });
    if (!['economy', 'comfort', 'family'].includes(type)) return res.status(400).json({ success: false, message: 'نوع المركبة غير صالح' });

    let user = await db.collection('users').findOne({ phone });
    if (user && user.role !== 'driver') return res.status(409).json({ success: false, message: 'رقم الهاتف مرتبط بحساب ليس كابتناً' });

    if (!user) {
      const id = `usr_driver_${crypto.randomUUID()}`;
      user = { _id: id, id, phone, role: 'driver', name, createdAt: Date.now(), updatedAt: Date.now() };
      await db.collection('users').insertOne(user);
    } else {
      await db.collection('users').updateOne({ _id: user._id }, { $set: { name, updatedAt: Date.now() } });
    }

    const driver = await upsertDriverProfile(user.id, { name, phone, type, vehicle, plate, available: false });
    res.status(201).json({ success: true, data: { ...driver, userId: user.id } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'رقم الهاتف مستخدم مسبقاً' });
    next(error);
  }
});

router.patch('/drivers/:id/profile', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });

    const id = String(req.params.id);
    const user = await db.collection('users').findOne({ $or: [{ id }, { _id: id }] });
    if (!user || user.role !== 'driver') return res.status(404).json({ success: false, message: 'حساب الكابتن غير موجود' });

    const patch = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim().slice(0, 80);
      if (!name) return res.status(400).json({ success: false, message: 'اسم الكابتن غير صالح' });
      patch.name = name;
    }
    if (req.body?.phone !== undefined) {
      const phone = String(req.body.phone).replace(/\s+/g, '').trim();
      if (!/^\+?[0-9]{8,15}$/.test(phone)) return res.status(400).json({ success: false, message: 'رقم الهاتف غير صالح' });
      const duplicate = await db.collection('users').findOne({ phone, id: { $ne: id } });
      if (duplicate) return res.status(409).json({ success: false, message: 'رقم الهاتف مستخدم مسبقاً' });
      patch.phone = phone;
    }
    if (Object.keys(patch).length) await db.collection('users').updateOne({ _id: user._id }, { $set: { ...patch, updatedAt: Date.now() } });

    const driverPatch = {};
    if (patch.name !== undefined) driverPatch.name = patch.name;
    if (patch.phone !== undefined) driverPatch.phone = patch.phone;
    if (req.body?.type !== undefined) {
      const type = String(req.body.type).toLowerCase();
      if (!['economy', 'comfort', 'family'].includes(type)) return res.status(400).json({ success: false, message: 'نوع المركبة غير صالح' });
      driverPatch.type = type;
    }
    if (req.body?.vehicle !== undefined) driverPatch.vehicle = String(req.body.vehicle).trim().slice(0, 80);
    if (req.body?.plate !== undefined) driverPatch.plate = String(req.body.plate).trim().slice(0, 30);

    const driver = await upsertDriverProfile(id, driverPatch);
    if (!driver) return res.status(404).json({ success: false, message: 'ملف الكابتن غير موجود' });
    res.json({ success: true, data: driver });
  } catch (error) { next(error); }
});

router.get('/drivers', async (_req, res, next) => {
  try {
  const drivers = await listDrivers();
  res.json({ success: true, data: drivers, meta: { count: drivers.length, online: drivers.filter((d) => d.available).length } });
  } catch (error) { next(error); }
});

router.get('/drivers/:id', async (req, res, next) => {
  try {
    const driver = await getDriver(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
    const trips = await listTrips();
    const driverTrips = trips.filter((trip) => String(trip.driver?.id || '') === String(driver.id));
    res.json({ success: true, data: { ...driver, tripsCount: driverTrips.length, activeTripsCount: driverTrips.filter((trip) => !['completed', 'cancelled'].includes(trip.status)).length } });
  } catch (error) { next(error); }
});

router.get('/drivers/:id/trips', async (req, res, next) => {
  try {
    const driver = await getDriver(req.params.id);
    if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
    const trips = await listTrips();
    const data = trips.filter((trip) => String(trip.driver?.id || '') === String(driver.id));
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.patch('/drivers/:id/availability', async (req, res, next) => {
  try {
  const driver = await setDriverAvailability(req.params.id, Boolean(req.body?.available));
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
  } catch (error) { next(error); }
});

export default router;
