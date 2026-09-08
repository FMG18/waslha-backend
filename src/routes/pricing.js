import { Router } from 'express';

const router = Router();

const configs = Object.freeze({
  economy: { base: 3500, perKm: 900, min: 3500 },
  comfort: { base: 5000, perKm: 1150, min: 5000 },
  family: { base: 6500, perKm: 1350, min: 6500 }
});

router.get('/estimate', (req, res) => {
  const type = String(req.query.vehicleType || 'economy');
  const distanceKm = Number(req.query.distanceKm);
  const config = configs[type];
  if (!config || !Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 100) {
    return res.status(400).json({ success: false, message: 'نوع السيارة أو المسافة غير صالحة' });
  }
  const fare = Math.max(config.min, Math.round(config.base + distanceKm * config.perKm));
  const durationMin = Math.max(3, Math.round(distanceKm * 3.2 + 4));
  res.json({ success: true, data: { vehicleType: type, distanceKm: Number(distanceKm.toFixed(1)), durationMin, estimatedFare: fare, currency: 'SYP' } });
});

router.get('/vehicles', (_req, res) => {
  res.json({ success: true, data: Object.entries(configs).map(([id, value]) => ({ id, ...value, currency: 'SYP' })) });
});

export default router;
