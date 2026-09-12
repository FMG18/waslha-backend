import { Router } from 'express';
import { getDatabase } from '../db/mongo.js';
import { listTrips } from '../services/tripRepository.js';
import { listDrivers } from '../services/driverRegistry.js';
import { createNotification } from '../services/notificationRepository.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { tickets } from './support.js';

const router = Router();
router.use(requireAuth, allowRoles('admin'));

router.get('/users', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const db = getDatabase();
    if (!db) return res.json({ success: true, data: [] });
    const filter = q ? { $or: [
      { name: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } }
    ] } : {};
    const users = await db.collection('users').find(filter).sort({ createdAt: -1 }).limit(200).toArray();
    const customerIds = users.map((u) => u.id).filter(Boolean);
    const counts = customerIds.length ? await db.collection('trips').aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } }
    ]).toArray() : [];
    const countMap = new Map(counts.map((x) => [String(x._id), Number(x.count)]));
    res.json({ success: true, data: users.map((u) => ({ id: String(u.id || u._id), phone: u.phone || '', name: u.name || '', email: u.email || '', role: u.role || 'customer', createdAt: u.createdAt || 0, tripsCount: countMap.get(String(u.id || u._id)) || 0 })) });
  } catch (error) { next(error); }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    const id = String(req.params.id);
    const user = await db.collection('users').findOne({ $or: [{ id }, { _id: id }] });
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    const trips = await listTrips(String(user.id || id));
    res.json({ success: true, data: { id: String(user.id || user._id), phone: user.phone || '', name: user.name || '', email: user.email || '', role: user.role || 'customer', createdAt: user.createdAt || 0, updatedAt: user.updatedAt || 0, tripsCount: trips.length, trips } });
  } catch (error) { next(error); }
});

router.get('/report', async (req, res, next) => {
  try {
    const period = String(req.query.period || 'all');
    const trips = await listTrips();
    const completedTrips = trips.filter((t) => t.status === 'completed');
    const cancelledTrips = trips.filter((t) => t.status === 'cancelled');
    const activeTrips = trips.filter((t) => ['searching', 'driver_assigned', 'arriving', 'in_progress'].includes(t.status));
    const revenue = completedTrips.reduce((s, t) => s + Number(t.estimatedFare || 0), 0);
    const drivers = listDrivers();
    const db = getDatabase();
    const totalCustomers = db ? await db.collection('users').countDocuments({ role: 'customer' }) : 0;
    res.json({ success: true, data: { period, totalTrips: trips.length, completedTrips: completedTrips.length, cancelledTrips: cancelledTrips.length, activeTrips: activeTrips.length, totalRevenue: revenue, averageFare: completedTrips.length ? revenue / completedTrips.length : 0, totalCustomers, totalDrivers: drivers.length, onlineDrivers: drivers.filter((d) => d.available).length } });
  } catch (error) { next(error); }
});

router.post('/notifications', async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const type = String(req.body?.type || 'admin').trim();
    const userId = req.body?.userId ? String(req.body.userId) : null;
    if (!title || !body) return res.status(400).json({ success: false, message: 'العنوان والرسالة مطلوبان' });
    if (userId) {
      await createNotification({ userId, title, body, type });
      return res.json({ success: true, data: { sent: 1 } });
    }
    const db = getDatabase();
    if (!db) return res.json({ success: true, data: { sent: 0 } });
    const users = await db.collection('users').find({ role: 'customer' }, { projection: { id: 1, _id: 1 } }).toArray();
    await Promise.all(users.map((u) => createNotification({ userId: String(u.id || u._id), title, body, type })));
    res.json({ success: true, data: { sent: users.length } });
  } catch (error) { next(error); }
});

router.get('/support/tickets', (_req, res) => {
  res.json({ success: true, data: tickets.slice(0, 200) });
});

router.patch('/support/tickets/:id', (req, res) => {
  const ticket = tickets.find((t) => t.id === String(req.params.id));
  if (!ticket) return res.status(404).json({ success: false, message: 'التذكرة غير موجودة' });
  const status = String(req.body?.status || '').toLowerCase();
  if (!['open', 'pending', 'resolved', 'closed'].includes(status)) return res.status(400).json({ success: false, message: 'حالة التذكرة غير صالحة' });
  ticket.status = status;
  ticket.updatedAt = Date.now();
  res.json({ success: true, data: ticket });
});

export default router;
