import { Router } from 'express';
import { getDatabase } from '../db/mongo.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, allowRoles('admin'));

router.get('/logs', async (req, res, next) => {
  try {
    const db = getDatabase();
    if (!db) return res.json({ success: true, data: [] });
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200);
    const logs = await db.collection('admin_audit_logs').find({}).sort({ createdAt: -1 }).limit(limit).toArray();
    res.json({ success: true, data: logs.map((x) => ({
      id: String(x._id), action: x.action || '', target: x.target || '',
      adminId: x.adminId || '', details: x.details || '', createdAt: x.createdAt || 0
    })) });
  } catch (error) { next(error); }
});

export async function writeAdminAudit({ adminId, action, target = '', details = '' }) {
  const db = getDatabase();
  if (!db) return;
  await db.collection('admin_audit_logs').insertOne({
    adminId: String(adminId || ''), action: String(action || ''), target: String(target || ''),
    details: String(details || ''), createdAt: Date.now()
  });
}

export default router;
