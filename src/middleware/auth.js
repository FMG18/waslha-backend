import { verifyAccessToken } from '../auth/tokens.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, message: 'المصادقة مطلوبة' });
  try {
    req.auth = await verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'جلسة الدخول غير صالحة أو منتهية' });
  }
}

export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لهذا الإجراء' });
  next();
};
