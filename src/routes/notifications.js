import { Router } from 'express';
import { createNotification, listNotifications, markNotificationRead } from '../services/notificationRepository.js';
import { registerDeviceToken } from '../services/deviceTokenRepository.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, message: 'معرّف المستخدم مطلوب' });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    res.json({ success: true, data: await listNotifications(userId, limit) });
  } catch (error) { next(error); }
});

router.post('/device-token', async (req, res, next) => {
  try {
    const userId = String(req.auth?.userId || '').trim();
    const token = String(req.body?.token || '').trim();
    if (!userId || !token) return res.status(400).json({ success: false, message: 'رمز الجهاز مطلوب' });
    const result = await registerDeviceToken(userId, token);
    if (!result.registered) return res.status(404).json({ success: false, message: 'حساب المستخدم غير موجود' });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { userId, title, body, type = 'system', tripId = null } = req.body || {};
    if (!userId || !title || !body) return res.status(400).json({ success: false, message: 'المستخدم والعنوان والنص مطلوبة' });
    const item = await createNotification({ userId, title, body, type, tripId });
    res.status(201).json({ success: true, data: item });
  } catch (error) { next(error); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const userId = String(req.body?.userId || req.query?.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, message: 'معرّف المستخدم مطلوب' });
    const found = await markNotificationRead(userId, req.params.id);
    if (!found) return res.status(404).json({ success: false, message: 'الإشعار غير موجود' });
    res.json({ success: true, data: { id: req.params.id, read: true } });
  } catch (error) { next(error); }
});

export default router;
