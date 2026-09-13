import { Router } from 'express';
import crypto from 'node:crypto';
import { requireApiAuth } from '../middleware/route-security.js';
import { getTrip } from '../services/tripRepository.js';
import { getDatabase } from '../db/mongo.js';

const router = Router({ mergeParams: true });
const memory = new Map();
router.use(requireApiAuth);

function allowed(trip, userId, role) {
  if (!trip) return false;
  if (role === 'customer') return String(trip.customerId) === String(userId);
  if (role === 'driver') return String(trip.driver?.id || '') === String(userId);
  return role === 'admin';
}

router.get('/', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (!allowed(trip, req.auth.userId, req.auth.role)) return res.status(403).json({ success: false, message: 'لا يمكنك الوصول إلى محادثة هذه الرحلة' });
    const after = Number(req.query.after || 0);
    const db = getDatabase();
    const rows = db
      ? await db.collection('tripMessages').find({ tripId: trip.id, createdAt: { $gt: after } }).sort({ createdAt: 1 }).limit(100).project({ _id: 0 }).toArray()
      : (memory.get(trip.id) || []).filter((m) => m.createdAt > after);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const trip = await getTrip(req.params.id);
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (!allowed(trip, req.auth.userId, req.auth.role)) return res.status(403).json({ success: false, message: 'لا يمكنك إرسال رسالة في هذه الرحلة' });
    if (!['searching', 'driver_assigned', 'arriving', 'in_progress'].includes(trip.status)) return res.status(409).json({ success: false, message: 'محادثة الرحلة غير متاحة حالياً' });
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'نص الرسالة مطلوب' });
    if (text.length > 500) return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً' });
    const message = { id: `MSG-${crypto.randomBytes(6).toString('hex')}`, tripId: trip.id, senderId: String(req.auth.userId), senderRole: req.auth.role, text, createdAt: Date.now() };
    const db = getDatabase();
    if (db) await db.collection('tripMessages').insertOne({ ...message, _id: message.id });
    else { const list = memory.get(trip.id) || []; list.push(message); memory.set(trip.id, list.slice(-100)); }
    res.status(201).json({ success: true, data: message });
  } catch (error) { next(error); }
});

export default router;
