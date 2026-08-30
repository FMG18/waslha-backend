const { getPricing } = require('../config/pricing');

function calculateFare(serviceType, distanceKm, durationMin) {
  const config = getPricing(serviceType);
  const raw = (config.baseFare + (distanceKm * config.pricePerKm) + (durationMin * config.pricePerMinute)) * config.multiplier;
  return Math.max(config.minimumFare, Math.round(raw));
}

module.exports = { calculateFare };
