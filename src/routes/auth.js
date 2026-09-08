import { Router } from 'express';
import crypto from 'node:crypto';

const router = Router();
const pendingCodes = new Map();

const normalizePhone = (value = '') => String(value).replace(/\s+/g, '').trim();

router.post('/request-code', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!/^\+?[0-9]{8,15}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'رقم الهاتف غير صالح' });
  }

  const code = process.env.NODE_ENV === 'production'
    ? String(crypto.randomInt(100000, 1000000))
    : '123456';
  pendingCodes.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  res.json({ success: true, message: 'تم إرسال رمز التحقق', expiresIn: 300, ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}) });
});

router.post('/verify-code', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? '');
  const pending = pendingCodes.get(phone);

  if (!pending || pending.expiresAt < Date.now() || pending.code !== code) {
    return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح أو منتهي' });
  }

  pendingCodes.delete(phone);
  const userId = crypto.createHash('sha256').update(phone).digest('hex').slice(0, 24);
  res.json({ success: true, data: { userId, phone, role: 'customer', token: `dev-${userId}` } });
});

export default router;
