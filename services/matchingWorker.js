const { expireOffer, offerNextCaptain } = require('./matchingService');

async function processExpiredOffer(rideId) {
  const released = await expireOffer(rideId);
  if (!released) return null;
  return offerNextCaptain(rideId);
}

async function startMatchingWorker({ intervalMs = 2000 } = {}) {
  if (process.env.VERCEL) return null;
  const interval = Math.max(1000, Number(intervalMs) || 2000);
  const timer = setInterval(async () => {
    try {
      const Ride = require('../models/Ride');
      const expired = await Ride.find({ status: 'searching', 'matching.currentCaptain': { $ne: null }, 'matching.offerExpiresAt': { $lte: new Date() } }).select('_id').limit(50).lean();
      for (const ride of expired) await processExpiredOffer(ride._id);
    } catch (error) {
      console.error('Matching worker error:', error.message);
    }
  }, interval);
  timer.unref?.();
  return timer;
}

module.exports = { processExpiredOffer, startMatchingWorker };
