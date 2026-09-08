import { Router } from 'express';

const router = Router();
const ratings = [];

router.post('/', (req, res) => {
  const { tripId, customerId = 'guest', driverId, score, comment = '' } = req.body ?? {};
  const numericScore = Number(score);
  if (!tripId || !driverId || !Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
    return res.status(400).json({ success: false, message: 'بيانات التقييم غير صالحة' });
  }
  const rating = { id: `R-${ratings.length + 1}`, tripId, customerId, driverId, score: numericScore, comment: String(comment).slice(0, 500), createdAt: Date.now() };
  ratings.push(rating);
  res.status(201).json({ success: true, data: rating });
});

router.get('/driver/:driverId', (req, res) => {
  const items = ratings.filter((item) => item.driverId === req.params.driverId);
  const average = items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 0;
  res.json({ success: true, data: { count: items.length, average: Number(average.toFixed(2)), ratings: items } });
});

export default router;
