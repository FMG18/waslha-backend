const { getPricing } = require('../config/pricing');

function calculateFare(serviceType, distanceKm, durationMin) {
  const distance = Number(distanceKm);
  const duration = Number(durationMin);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(duration) || duration < 0) {
    const error = new Error('Distance and duration must be valid non-negative numbers');
    error.statusCode = 400;
    error.code = 'INVALID_PRICING_INPUT';
    throw error;
  }
  const config = getPricing(serviceType);
  const raw = (config.baseFare + distance * config.pricePerKm + duration * config.pricePerMinute) * config.multiplier;
  return Math.max(config.minimumFare, Math.round(raw));
}

module.exports = { calculateFare };
