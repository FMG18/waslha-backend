import { verifyAccessToken } from '../auth/tokens.js';
import { getTrip } from '../services/tripRepository.js';

const tokenFrom = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

const deny = (res, status, message) => res.status(status).json({ success: false, message });

export async function requireApiAuth(req, res, next) {
  const token = tokenFrom(req);
  if (!token) return deny(res, 401, 'المصادقة مطلوبة');
  try {
    req.auth = await verifyAccessToken(token);
    if (!req.auth.userId) return deny(res, 401, 'جلسة الدخول غير صالحة');
    next();
  } catch {
    return deny(res, 401, 'جلسة الدخول غير صالحة أو منتهية');
  }
}

export async function secureCustomerRoutes(req, res, next) {
  await requireApiAuth(req, res, async () => {
    const userId = String(req.auth.userId);
    const path = req.path || '';

    if (req.baseUrl.endsWith('/trips')) {
      const privileged = /\/(dispatch|assign-driver|status)$/.test(path);
      if (req.auth.role === 'customer' && privileged) return deny(res, 403, 'ليس لديك صلاحية لهذا الإجراء');

      if (req.auth.role === 'customer') {
        if (req.method === 'GET' && (path === '/' || path === '')) {
          req.query.customerId = userId;
        } else if (req.method === 'POST' && (path === '/' || path === '')) {
          req.body = { ...(req.body || {}), customerId: userId };
        }

        const match = path.match(/^\/([^/]+)/);
        if (match && match[1] && match[1] !== 'estimate') {
          const trip = await getTrip(match[1]);
          if (trip && String(trip.customerId) !== userId) return deny(res, 403, 'لا يمكنك الوصول إلى هذه الرحلة');
        }
      }
    }

    if (req.baseUrl.endsWith('/notifications') && req.auth.role === 'customer') {
      if (req.method === 'POST') return deny(res, 403, 'إنشاء إشعارات الزبون غير مسموح');
      req.query.userId = userId;
      if (req.body && typeof req.body === 'object') req.body.userId = userId;
    }

    if (req.baseUrl.endsWith('/ratings') && req.auth.role === 'customer' && req.method === 'POST') {
      req.body = { ...(req.body || {}), customerId: userId };
    }

    next();
  });
}

export function requireCustomerRole(req, res, next) {
  if (!req.auth || req.auth.role !== 'customer') return deny(res, 403, 'هذا المسار مخصص للزبائن');
  next();
}
