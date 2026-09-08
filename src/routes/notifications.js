import { Router } from 'express';
import crypto from 'node:crypto';

const router = Router();
const notifications = new Map();

router.get('/', (req, res) => {
  const userId = String(req.query.userId || 'guest');
  const data = notifications.get(userId) || [
    { id: 'welcome', title: 'أهلاً بك في وصلها', body: 'ابدأ رحلتك الأولى معنا بسهولة وأمان.', type: 'system', read: false, createdAt: Date.now() }
  ];
  res.json({ success: true, data });
});

router.post('/', (req, res) => {
  const { userId = 'guest', title, body, type = 'system' } = req.body || {};
  if (!title || !body) return res.status(400).json({ success: false, message: 'العنوان والنص مطلوبان' });
  const item = { id: crypto.randomUUID(), title: String(title).slice(0, 120), body: String(body).slice(0, 500), type, read: false, createdAt: Date.now() };
  const list = notifications.get(userId) || [];
  list.unshift(item);
  notifications.set(userId, list.slice(0, 50));
  res.status(201).json({ success: true, data: item });
});

router.patch('/:id/read', (req, res) => {
  for (const list of notifications.values()) {
    const item = list.find((entry) => entry.id === req.params.id);
    if (item) {
      item.read = true;
      return res.json({ success: true, data: item });
    }
  }
  res.status(404).json({ success: false, message: 'الإشعار غير موجود' });
});

export default router;
