import { Router } from 'express';
import crypto from 'node:crypto';
import { getDatabase } from '../db/mongo.js';
import { requireApiAuth } from '../middleware/route-security.js';
import { listDrivers } from '../services/driverRegistry.js';

const router = Router();
router.use(requireApiAuth, (req, res, next) => {
  if (req.auth?.role !== 'customer') return res.status(403).json({ success: false, message: 'هذا المسار مخصص للزبائن' });
  next();
});

const userQuery = (id) => ({ $or: [{ id }, { _id: id }] });

function normalizePlace(input = {}) {
  const latitude = Number(input.latitude ?? input.lat);
  const longitude = Number(input.longitude ?? input.lng);
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error('اسم المكان والإحداثيات مطلوبة');
    error.statusCode = 400;
    throw error;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    const error = new Error('إحداثيات المكان غير صالحة');
    error.statusCode = 400;
    throw error;
  }
  return { id: String(input.id || crypto.randomUUID()), type: String(input.type || ''), name, latitude, longitude, updatedAt: Date.now() };
}

router.get('/me', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });
    const user = await db.collection('users').findOne(userQuery(String(req.auth.userId)));
    if (!user || user.role !== 'customer') return res.status(404).json({ success: false, message: 'حساب الزبون غير موجود' });
    res.json({ success: true, data: { id: String(user.id || user._id), name: user.name || '', phone: user.phone || '', email: user.email || '', picture: user.picture || '', walletBalance: Number(user.walletBalance || 0), currency: 'SYP' } });
  } catch (error) { next(error); }
});

router.patch('/me', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });
    const userId = String(req.auth.userId);
    const patch = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length > 80) return res.status(400).json({ success: false, message: 'الاسم طويل جداً' });
      patch.name = name;
    }
    if (req.body?.phone !== undefined) {
      const phone = String(req.body.phone).replace(/\s+/g, '').trim();
      if (!/^\+?[0-9]{8,15}$/.test(phone)) return res.status(400).json({ success: false, message: 'رقم الهاتف غير صالح' });
      const duplicate = await db.collection('users').findOne({ phone, id: { $ne: userId } });
      if (duplicate) return res.status(409).json({ success: false, message: 'رقم الهاتف مستخدم مسبقاً' });
      patch.phone = phone;
    }
    if (req.body?.picture !== undefined) {
      const picture = String(req.body.picture || '').trim();
      if (picture.length > 700_000) return res.status(400).json({ success: false, message: 'صورة الحساب كبيرة جداً' });
      patch.picture = picture;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ success: false, message: 'لا توجد بيانات للتعديل' });
    patch.updatedAt = Date.now();
    const result = await db.collection('users').updateOne(userQuery(userId), { $set: patch });
    if (!result.matchedCount) return res.status(404).json({ success: false, message: 'حساب الزبون غير موجود' });
    const user = await db.collection('users').findOne(userQuery(userId));
    res.json({ success: true, data: { id: String(user.id || user._id), name: user.name || '', phone: user.phone || '', email: user.email || '', picture: user.picture || '', walletBalance: Number(user.walletBalance || 0), currency: 'SYP' } });
  } catch (error) { next(error); }
});

router.get('/wallet', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });
    const user = await db.collection('users').findOne(userQuery(String(req.auth.userId)), { projection: { walletBalance: 1 } });
    if (!user) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    res.json({ success: true, data: { balance: Number(user.walletBalance || 0), currency: 'SYP' } });
  } catch (error) { next(error); }
});

router.get('/places', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.json({ success: true, data: [] });
    const user = await db.collection('users').findOne(userQuery(String(req.auth.userId)), { projection: { savedPlaces: 1 } });
    res.json({ success: true, data: Array.isArray(user?.savedPlaces) ? user.savedPlaces : [] });
  } catch (error) { next(error); }
});

router.put('/places/:slot', async (req, res, next) => {
  try {
    const slot = String(req.params.slot);
    if (!['home', 'work'].includes(slot)) return res.status(400).json({ success: false, message: 'نوع المكان غير صالح' });
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });
    const place = normalizePlace({ ...(req.body || {}), type: slot });
    const user = await db.collection('users').findOne(userQuery(String(req.auth.userId)));
    const places = Array.isArray(user?.savedPlaces) ? user.savedPlaces.filter((item) => item?.type !== slot) : [];
    places.push(place);
    await db.collection('users').updateOne(userQuery(String(req.auth.userId)), { $set: { savedPlaces: places, updatedAt: Date.now() } });
    res.json({ success: true, data: place });
  } catch (error) { next(error); }
});

router.delete('/places/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });
    const user = await db.collection('users').findOne(userQuery(String(req.auth.userId)));
    const before = Array.isArray(user?.savedPlaces) ? user.savedPlaces.length : 0;
    const places = Array.isArray(user?.savedPlaces) ? user.savedPlaces.filter((item) => String(item?.id) !== String(req.params.id)) : [];
    await db.collection('users').updateOne(userQuery(String(req.auth.userId)), { $set: { savedPlaces: places, updatedAt: Date.now() } });
    res.json({ success: true, data: { deleted: places.length < before } });
  } catch (error) { next(error); }
});

router.get('/nearby-drivers', async (req, res, next) => {
  try {
    const vehicleType = String(req.query.vehicleType || '').trim().toLowerCase() || null;
    const drivers = listDrivers({ vehicleType }).map((driver) => ({
      id: driver.id,
      type: driver.type,
      lat: Number(driver.lat),
      lng: Number(driver.lng),
      available: Boolean(driver.available),
      updatedAt: Date.now()
    })).filter((driver) => Number.isFinite(driver.lat) && Number.isFinite(driver.lng));
    res.json({ success: true, data: drivers });
  } catch (error) { next(error); }
});

router.delete('/me', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });
    const userId = String(req.auth.userId);
    const active = await db.collection('trips').findOne({ customerId: userId, status: { $in: ['searching', 'driver_assigned', 'arriving', 'in_progress'] } });
    if (active) return res.status(409).json({ success: false, message: 'لا يمكن حذف الحساب أثناء وجود رحلة نشطة' });
    const result = await db.collection('users').deleteOne(userQuery(userId));
    if (!result.deletedCount) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    await Promise.all([db.collection('deviceTokens').deleteMany({ userId }), db.collection('notifications').deleteMany({ userId })]);
    res.json({ success: true, data: { deleted: true } });
  } catch (error) { next(error); }
});

export default router;
