import { Router } from 'express';
import crypto from 'node:crypto';
import { issueAccessToken } from '../auth/tokens.js';
import { verifyGoogleIdToken } from '../auth/google.js';
import { upsertGoogleUser, upsertUser } from '../services/userRepository.js';
import { rateLimit } from '../middleware/rate-limit.js';

const router = Router();
const pending = new Map();
const DEMO_CAPTAIN_PHONE = '9647700000099';
const DEMO_CAPTAIN_CODE = '246810';
const DEMO_CAPTAIN_ID = 'demo-captain-001';
const DEMO_CAPTAIN_NAME = 'كابتن وصلها التجريبي';
const DEMO_ADMIN_PHONE = '9647700000088';
const DEMO_ADMIN_CODE = '135790';
const DEMO_ADMIN_ID = 'demo-admin-001';
const DEMO_ADMIN_NAME = 'مدير وصلها التجريبي';
const otpRequestLimit = rateLimit({ windowMs: 60_000, max: 5, key: (req) => `otp-request:${req.ip || 'unknown'}` });
const otpVerifyLimit = rateLimit({ windowMs: 60_000, max: 12, key: (req) => `otp-verify:${req.ip || 'unknown'}` });
const googleLoginLimit = rateLimit({ windowMs: 60_000, max: 12, key: (req) => `google:${req.ip || 'unknown'}` });

router.post('/request-code', otpRequestLimit, (req, res) => {
  const phone = String(req.body?.phone || '').replace(/\s+/g, '').trim();
  if (!/^\+?[0-9]{8,15}$/.test(phone)) return res.status(400).json({ success: false, message: 'رقم الهاتف غير صالح' });
  const isDemoCaptain = phone === DEMO_CAPTAIN_PHONE;
  const isDemoAdmin = phone === DEMO_ADMIN_PHONE;
  const code = isDemoCaptain ? DEMO_CAPTAIN_CODE : isDemoAdmin ? DEMO_ADMIN_CODE : (process.env.NODE_ENV === 'production' ? String(crypto.randomInt(100000, 1000000)) : '123456');
  pending.set(phone, { code, expiresAt: Date.now() + 300000, attempts: 0 });
  res.json({ success: true, message: 'تم إرسال رمز التحقق', expiresIn: 300, ...((process.env.NODE_ENV !== 'production' || isDemoCaptain || isDemoAdmin) ? { devCode: code } : {}) });
});

router.post('/verify-code', otpVerifyLimit, async (req, res, next) => {
  try {
    const phone = String(req.body?.phone || '').replace(/\s+/g, '').trim();
    const code = String(req.body?.code || '');

    if (phone === DEMO_CAPTAIN_PHONE) {
      if (code !== DEMO_CAPTAIN_CODE) return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح' });
      const token = await issueAccessToken({ userId: DEMO_CAPTAIN_ID, role: 'driver' });
      return res.json({ success: true, data: { userId: DEMO_CAPTAIN_ID, phone: DEMO_CAPTAIN_PHONE, role: 'driver', token, name: DEMO_CAPTAIN_NAME } });
    }

    if (phone === DEMO_ADMIN_PHONE) {
      if (code !== DEMO_ADMIN_CODE) return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح' });
      const token = await issueAccessToken({ userId: DEMO_ADMIN_ID, role: 'admin' });
      return res.json({ success: true, data: { userId: DEMO_ADMIN_ID, phone: DEMO_ADMIN_PHONE, role: 'admin', token, name: DEMO_ADMIN_NAME } });
    }

    const item = pending.get(phone);
    if (!item || item.expiresAt < Date.now() || item.attempts >= 5 || item.code !== code) {
      if (item) item.attempts += 1;
      return res.status(400).json({ success: false, message: 'رمز التحقق غير صحيح أو منتهي' });
    }

    pending.delete(phone);
    const user = await upsertUser({ phone, role: 'customer' });
    const token = await issueAccessToken({ userId: user.id, role: user.role });
    res.json({ success: true, data: { userId: user.id, phone: user.phone, role: user.role, token, name: user.name } });
  } catch (error) { next(error); }
});

router.post('/google', googleLoginLimit, async (req, res, next) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) return res.status(400).json({ success: false, message: 'Google ID Token مفقود' });
    const googleUser = await verifyGoogleIdToken(idToken);
    const user = await upsertGoogleUser(googleUser);
    const token = await issueAccessToken({ userId: user.id, role: user.role });
    res.json({ success: true, data: { userId: user.id, phone: user.phone || '', email: user.email, name: user.name, picture: user.picture || '', role: user.role, token } });
  } catch (error) {
    if (error.code === 'GOOGLE_NOT_CONFIGURED') return res.status(503).json({ success: false, message: 'تسجيل الدخول باستخدام Google غير مفعّل على الخادم' });
    if (error.code === 'GOOGLE_TOKEN_INVALID' || error.code === 'GOOGLE_ACCOUNT_INVALID') return res.status(401).json({ success: false, message: 'حساب Google غير صالح أو غير موثّق' });
    next(error);
  }
});

export default router;
