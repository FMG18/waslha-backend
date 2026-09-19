import { Router } from 'express';
import { sortByDistance } from '../services/geo.js';
import { getDriver, listDrivers, setDriverAvailability, updateDriverLocation } from '../services/driverRegistry.js';

const router = Router();

router.use((req, res, next) => {
  if (!['admin', 'driver'].includes(req.auth?.role)) {
    return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لإدارة بيانات الكباتن' });
  }
  next();
});

const canAccessDriver = (req, id) => req.auth?.role === 'admin' || String(req.auth?.userId) === String(id);

router.get('/nearby', async (req, res, next) => {
  try {
  const type = req.query?.vehicleType ? String(req.query.vehicleType).toLowerCase() : null;
  const lat = Number(req.query?.lat);
  const lng = Number(req.query?.lng);
  const available = await listDrivers({ vehicleType: type });
  const data = Number.isFinite(lat) && Number.isFinite(lng)
    ? sortByDistance({ lat, lng }, available)
    : available;
  res.json({ success: true, data, meta: { count: data.length } });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
  if (!canAccessDriver(req, req.params.id)) return res.status(403).json({ success: false, message: 'لا يمكنك الوصول إلى بيانات هذا الكابتن' });
  const driver = await getDriver(req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
  } catch (error) { next(error); }
});

router.patch('/:id/availability', async (req, res, next) => {
  try {
  if (!canAccessDriver(req, req.params.id)) return res.status(403).json({ success: false, message: 'لا يمكنك تعديل بيانات هذا الكابتن' });
  const driver = await setDriverAvailability(req.params.id, req.body?.available);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
  } catch (error) { next(error); }
});

router.patch('/:id/location', async (req, res, next) => {
  try {
  if (!canAccessDriver(req, req.params.id)) return res.status(403).json({ success: false, message: 'لا يمكنك تعديل موقع هذا الكابتن' });
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (![lat, lng].every(Number.isFinite) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ success: false, message: 'الإحداثيات غير صالحة' });
  }
  const driver = await updateDriverLocation(req.params.id, lat, lng);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
  } catch (error) { next(error); }
});

export default router;
