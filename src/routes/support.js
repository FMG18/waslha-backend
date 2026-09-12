import { Router } from 'express';
import crypto from 'node:crypto';

const router = Router();
export const tickets = [];

router.post('/tickets', (req, res) => {
  const { userId = 'guest', category = 'general', subject, message, tripId = null } = req.body || {};
  if (!subject || !message) return res.status(400).json({ success: false, message: 'العنوان والرسالة مطلوبان' });
  const ticket = { id: `T-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, userId, category, subject: String(subject).slice(0, 120), message: String(message).slice(0, 1000), tripId, status: 'open', createdAt: Date.now() };
  tickets.unshift(ticket);
  res.status(201).json({ success: true, data: ticket });
});

router.get('/tickets', (req, res) => {
  const userId = String(req.query.userId || 'guest');
  res.json({ success: true, data: tickets.filter((ticket) => ticket.userId === userId) });
});

router.get('/faq', (_req, res) => {
  res.json({ success: true, data: [
    { id: 1, question: 'كيف أطلب تكسي؟', answer: 'حدد موقع الانطلاق والوجهة ثم اختر نوع السيارة واضغط طلب سيارة.' },
    { id: 2, question: 'كيف ألغي الرحلة؟', answer: 'يمكن الإلغاء قبل اكتمال الرحلة من شاشة الرحلة الحالية.' },
    { id: 3, question: 'كيف أقيم الكابتن؟', answer: 'بعد انتهاء الرحلة ستظهر شاشة التقييم مباشرة.' }
  ] });
});

export default router;
