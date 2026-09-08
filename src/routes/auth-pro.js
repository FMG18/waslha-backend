import { Router } from 'express';
import crypto from 'node:crypto';
import { issueAccessToken } from '../auth/tokens.js';
import { verifyGoogleIdToken } from '../auth/google.js';
import { upsertGoogleUser, upsertUser } from '../services/userRepository.js';

const router = Router();
const pending = new Map();

router.post('/request-code', (req, res) => {
  const phone = String(req.body?.phone || '').replace(/\s+/g, '').trim();
  if (!/^\+?[0-9]{8,15}$/.test(phone)) return res.status(400).json({ success: false, message: 'رقم الهاتف غير صالح' });
  const code = process.env.NODE_ENV === 'production' ? String(crypto.randomInt(100000, 1000000)) : '123456';
  pending.set(phone, { code, expiresAt: Date.now() + 300000, attempts: 0 });
  res.json({ success: true, message: 'تم إرسال رمز التحقق', expiresIn: 300, ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}) });
});

router.post('/verify-code', async (req, res, next) => {
  try {
    const phone = String(req.body?.phone || '').replace(/\s+/g, '').trim();
    const code = String(req.body?.code || '');
    const item = pending.get(phone);
    if (!item || item.expiresAt < Date.now() || item.attempts >= 5 || item.code !== code) {
      if (item) item.attempts += 1;
      return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح أو منتهي' });
    }
    pending.delete(phone);
    const user = await upsertUser({ phone, role: 'customer' });
    const token = await issueAccessToken({ userId: user.id, role: user.role });
    res.json({
      success: true,
      data: { userId: user.id, phone: user.phone, role: user.role, token }
    });
  } catch (error) { next(error); }
});

router.post('/google', async (req, res, next) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) return res.status(400).json({ success: false, message: 'Google ID Token مفقود' });

    const googleUser = await verifyGoogleIdToken(idToken);
    const user = await upsertGoogleUser(googleUser);
    const token = await issueAccessToken({ userId: user.id, role: user.role });

    res.json({
      success: true,
      data: {
        userId: user.id,
        phone: user.phone || '',
        email: user.email,
        name: user.name,
        picture: user.picture || '',
        role: user.role,
        token
      }
    });
  } catch (error) {
    if (error.code === 'GOOGLE_NOT_CONFIGURED') {
      return res.status(503).json({ success: false, message: 'تسجيل الدخول باستخدام Google غير مفعّل على الخادم' });
    }
    if (error.code === 'GOOGLE_TOKEN_INVALID' || error.code === 'GOOGLE_ACCOUNT_INVALID') {
      return res.status(401).json({ success: false, message: 'حساب Google غير صالح أو غير موثّق' });
    }
    next(error);
  }
});

export default router;
