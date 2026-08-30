const { expireOffer, offerNextCaptain } = require('./matchingService');

async function processExpiredOffer(rideId) {
  const released = await expireOffer(rideId);
  if (!released) return null;
  return offerNextCaptain(rideId);
}

module.exports = { processExpiredOffer };
