import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { getDatabase } from '../db/mongo.js';
import { listTrips } from '../services/tripRepository.js';

const router = Router();
router.use(requireAuth, allowRoles('admin'));

router.get('/users', async (req, res, next) => {
  try {
    const query = String(req.query?.q || '').trim().toLowerCase();
    const db = getDatabase();
    if (!db) return res.json({ success: true, data: [], meta: { count: 0, source: 'memory' } });
    const filter = query ? { $or: [{ phone: { $regex: query, $options: 'i' } }, { name: { $regex: query, $options: 'i' } }, { email: { $regex: query, $options: 'i' } }] } : {};
    const users = await db.collection('users').find(filter).sort({ createdAt: -1 }).limit(100).project({ _id: 0, id: 1, phone: 1, name: 1, email: 1, role: 1, createdAt: 1 }).toArray();
    const trips = await listTrips();
    const counts = new Map();
    for (const trip of trips) counts.set(String(trip.customerId), (counts.get(String(trip.customerId)) || 0) + 1);
    const data = users.filter((u) => u.role !== 'admin').map((u) => ({ ...u, tripsCount: counts.get(String(u.id)) || 0 }));
    res.json({ success: true, data, meta: { count: data.length } });
  } catch (error) { next(error); }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    const user = await db.collection('users').findOne({ id: String(req.params.id) }, { projection: { _id: 0, id: 1, phone: 1, name: 1, email: 1, role: 1, createdAt: 1, updatedAt: 1 } });
    if (!user || user.role === 'admin') return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    const trips = await listTrips(user.id);
    res.json({ success: true, data: { ...user, tripsCount: trips.length, trips: trips.slice(0, 50) } });
  } catch (error) { next(error); }
});

export default router;
