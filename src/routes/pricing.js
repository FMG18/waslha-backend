import { Router } from 'express';
import { assertEnum, VEHICLE_TYPES } from '../domain/trip-contract.js';
import { calculateFare, listPricing } from '../services/pricing.js';

const router = Router();

router.get('/estimate', (req, res) => {
  try {
    const type = String(req.query.vehicleType || 'economy').toLowerCase();
    assertEnum(type, VEHICLE_TYPES, 'نوع السيارة');
    const result = calculateFare(type, Number(req.query.distanceKm));
    if (!result) return res.status(400).json({ success: false, message: 'المسافة غير صالحة' });
    res.json({ success: true, data: result });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});

router.get('/vehicles', (_req, res) => {
  res.json({ success: true, data: listPricing() });
});

export default router;
