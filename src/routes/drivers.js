import { Router } from 'express';
import { sortByDistance } from '../services/geo.js';
import { getDriver, listDrivers, setDriverAvailability, updateDriverLocation } from '../services/driverRegistry.js';

const router = Router();

router.get('/nearby', (req, res) => {
  const type = req.query?.vehicleType ? String(req.query.vehicleType).toLowerCase() : null;
  const lat = Number(req.query?.lat);
  const lng = Number(req.query?.lng);
  const available = listDrivers({ vehicleType: type });
  const data = Number.isFinite(lat) && Number.isFinite(lng)
    ? sortByDistance({ lat, lng }, available)
    : available;
  res.json({ success: true, data, meta: { count: data.length } });
});

router.get('/:id', (req, res) => {
  const driver = getDriver(req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
});

router.patch('/:id/availability', (req, res) => {
  const driver = setDriverAvailability(req.params.id, req.body?.available);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
});

router.patch('/:id/location', (req, res) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (![lat, lng].every(Number.isFinite) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ success: false, message: 'الإحداثيات غير صالحة' });
  }
  const driver = updateDriverLocation(req.params.id, lat, lng);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
});

export default router;
