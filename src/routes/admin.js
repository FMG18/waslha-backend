import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { listTrips } from '../services/tripRepository.js';
import { listDrivers } from '../services/driverRegistry.js';

const router = Router();
router.use(requireAuth, allowRoles('admin'));

router.get('/overview', async (_req, res, next) => {
  try {
    const trips = await listTrips();
    const drivers = listDrivers();
    const completed = trips.filter((t) => t.status === 'completed');
    const active = trips.filter((t) => ['searching', 'driver_assigned', 'arriving', 'in_progress'].includes(t.status));
    const waiting = trips.filter((t) => t.status === 'searching');
    const revenue = completed.reduce((sum, trip) => sum + Number(trip.estimatedFare || 0), 0);
    res.json({
      success: true,
      data: {
        totals: { trips: trips.length, activeTrips: active.length, waitingTrips: waiting.length, completedTrips: completed.length, drivers: drivers.length, onlineDrivers: drivers.filter((d) => d.available).length, revenue },
        latestTrips: trips.slice(0, 20)
      }
    });
  } catch (error) { next(error); }
});

router.get('/trips', async (_req, res, next) => {
  try { res.json({ success: true, data: await listTrips() }); }
  catch (error) { next(error); }
});

router.get('/drivers', (_req, res) => {
  const drivers = listDrivers();
  res.json({ success: true, data: drivers, meta: { count: drivers.length, online: drivers.filter((d) => d.available).length } });
});

export default router;
