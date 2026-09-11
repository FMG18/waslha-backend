import { Router } from 'express';
import crypto from 'node:crypto';
import { getDatabase } from '../db/mongo.js';
import { getTrip } from '../services/tripRepository.js';

const router = Router();
const memory = new Map();
const collection = () => getDatabase()?.collection('ratings');

router.post('/', async (req, res, next) => {
  try {
    const { tripId, customerId, driverId, score, comment = '' } = req.body ?? {};
    const numericScore = Number(score);
    if (!tripId || !customerId || !driverId || !Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
      return res.status(400).json({ success: false, message: 'بيانات التقييم غير صالحة' });
    }

    const trip = await getTrip(String(tripId));
    if (!trip) return res.status(404).json({ success: false, message: 'الرحلة غير موجودة' });
    if (trip.customerId !== String(customerId) || trip.driver?.id !== String(driverId)) {
      return res.status(403).json({ success: false, message: 'لا يمكن تقييم هذه الرحلة' });
    }
    if (trip.status !== 'completed') {
      return res.status(409).json({ success: false, message: 'يمكن التقييم بعد انتهاء الرحلة فقط' });
    }

    const rating = {
      id: `R-${crypto.randomUUID()}`,
      tripId: String(tripId),
      customerId: String(customerId),
      driverId: String(driverId),
      score: numericScore,
      comment: String(comment).trim().slice(0, 500),
      createdAt: Date.now()
    };

    const c = collection();
    if (c) await c.insertOne({ ...rating, _id: rating.id });
    else memory.set(rating.id, rating);

    res.status(201).json({ success: true, data: rating });
  } catch (error) { next(error); }
});

router.get('/driver/:driverId', async (req, res, next) => {
  try {
    const driverId = String(req.params.driverId);
    const c = collection();
    const items = c
      ? await c.find({ driverId }).sort({ createdAt: -1 }).limit(100).toArray()
      : [...memory.values()].filter((item) => item.driverId === driverId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
    const average = items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 0;
    res.json({ success: true, data: { count: items.length, average: Number(average.toFixed(2)), ratings: items } });
  } catch (error) { next(error); }
});

export default router;
