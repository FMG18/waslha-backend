import { Router } from 'express';

const router = Router();

router.get('/vehicle-types', (_req, res) => {
  res.json({ success: true, data: [
    { id: 'economy', name: 'اقتصادي', description: 'رحلة يومية بسعر مناسب', seats: 4, badge: 'الأكثر طلباً' },
    { id: 'comfort', name: 'مريح', description: 'سيارة أحدث ومساحة أفضل', seats: 4, badge: 'راحة' },
    { id: 'family', name: 'عائلي', description: 'مساحة أكبر للعائلة والأمتعة', seats: 6, badge: 'عائلي' }
  ] });
});

router.get('/payment-methods', (_req, res) => {
  res.json({ success: true, data: [
    { id: 'cash', name: 'نقداً', enabled: true },
    { id: 'wallet', name: 'محفظة وصلها', enabled: false }
  ] });
});

router.get('/app-config', (_req, res) => {
  res.json({ success: true, data: { cityScope: 'Syria', defaultCurrency: 'SYP', supportPhone: '', minAppVersion: '1.0.0' } });
});

export default router;
