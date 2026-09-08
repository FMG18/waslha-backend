import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'waslha-backend',
    version: '1.0.0',
    status: 'healthy'
  });
});

export default router;
