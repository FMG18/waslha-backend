import { Router } from 'express';
import crypto from 'node:crypto';
import { getDatabase } from '../db/mongo.js';

const router = Router();

router.post('/tickets', async (req, res, next) => {
  try {
    const userId = String(req.auth?.userId || '');
    const { category = 'general', subject, message, tripId = null } = req.body || {};
    if (!userId) return res.status(401).json({ success: false, message: 'جلسة المستخدم غير صالحة' });
    if (!subject || !message) return res.status(400).json({ success: false, message: 'العنوان والرسالة مطلوبان' });
    const ticket = {
      id: `T-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      userId,
      category: String(category).slice(0, 40),
      subject: String(subject).trim().slice(0, 120),
      message: String(message).trim().slice(0, 1000),
      tripId: tripId ? String(tripId) : null,
      status: 'open',
      createdAt: Date.now(),
    };
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });
    await db.collection('supportTickets').insertOne(ticket);
    res.status(201).json({ success: true, data: ticket });
  } catch (error) { next(error); }
});

router.get('/tickets', async (req, res, next) => {
  try {
    const userId = String(req.auth?.userId || '');
    const db = getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'قاعدة البيانات غير متاحة' });
    const data = await db.collection('supportTickets').find({ userId }).sort({ createdAt: -1 }).limit(50).toArray();
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.get('/faq', (_req, res) => {
  res.json({ success: true, data: [
    { id: 1, question: 'كيف أطلب تكسي؟', answer: 'حدد موقع الانطلاق والوجهة ثم اختر نوع السيارة واضغط طلب سيارة.' },
    { id: 2, question: 'كيف ألغي الرحلة؟', answer: 'يمكن الإلغاء قبل اكتمال الرحلة من شاشة الرحلة الحالية.' },
    { id: 3, question: 'كيف أقيم الكابتن؟', answer: 'بعد انتهاء الرحلة ستظهر شاشة التقييم مباشرة.' }
  ] });
});

export default router;
