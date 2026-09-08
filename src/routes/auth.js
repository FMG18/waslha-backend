import { Router } from 'express';

const router = Router();

router.post('/request-code', (_req, res) => {
  res.status(501).json({ success: false, message: 'مصادقة الهاتف قيد بناء النظام الأساسي' });
});

router.post('/verify-code', (_req, res) => {
  res.status(501).json({ success: false, message: 'التحقق من الرمز قيد بناء النظام الأساسي' });
});

export default router;
