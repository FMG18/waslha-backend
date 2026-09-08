import { Router } from 'express';
import { sortByDistance } from '../services/geo.js';

const router = Router();
const drivers = [
  { id: 'cap-101', name: 'أحمد', rating: 4.9, vehicle: 'Toyota Corolla', plate: '1234', type: 'economy', lat: 33.5138, lng: 36.2765, available: true },
  { id: 'cap-102', name: 'محمد', rating: 4.8, vehicle: 'Hyundai Elantra', plate: '5682', type: 'economy', lat: 33.5180, lng: 36.2892, available: true },
  { id: 'cap-203', name: 'سامر', rating: 4.9, vehicle: 'Kia Sportage', plate: '9041', type: 'comfort', lat: 33.5050, lng: 36.2940, available: true }
];

router.get('/nearby', (req, res) => {
  const type = req.query?.vehicleType;
  const lat = Number(req.query?.lat);
  const lng = Number(req.query?.lng);
  const available = drivers.filter((driver) => driver.available && (!type || driver.type === type));
  const data = Number.isFinite(lat) && Number.isFinite(lng)
    ? sortByDistance({ lat, lng }, available)
    : available;
  res.json({ success: true, data, meta: { count: data.length } });
});

router.get('/:id', (req, res) => {
  const driver = drivers.find((item) => item.id === req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  res.json({ success: true, data: driver });
});

router.patch('/:id/availability', (req, res) => {
  const driver = drivers.find((item) => item.id === req.params.id);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  driver.available = Boolean(req.body?.available);
  res.json({ success: true, data: driver });
});

router.patch('/:id/location', (req, res) => {
  const driver = drivers.find((item) => item.id === req.params.id);
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!driver) return res.status(404).json({ success: false, message: 'الكابتن غير موجود' });
  if (![lat, lng].every(Number.isFinite) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ success: false, message: 'الإحداثيات غير صالحة' });
  }
  driver.lat = lat;
  driver.lng = lng;
  res.json({ success: true, data: driver });
});

export default router;
