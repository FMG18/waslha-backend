import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ success: true, data: [], message: 'نظام الرحلات جاهز للربط بقاعدة البيانات' });
});

router.post('/', (_req, res) => {
  res.status(501).json({ success: false, message: 'إنشاء الرحلة سيتم تفعيله مع محرك الرحلات' });
});

export default router;
