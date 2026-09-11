const CONFIGS = Object.freeze({
  economy: { base: 3500, perKm: 900, min: 3500 },
  comfort: { base: 5000, perKm: 1150, min: 5000 },
  family: { base: 6500, perKm: 1350, min: 6500 }
});

export function getPricingConfig(vehicleType = 'economy') {
  return CONFIGS[String(vehicleType).toLowerCase()] || null;
}

export function calculateFare(vehicleType, distanceKm) {
  const type = String(vehicleType || 'economy').toLowerCase();
  const config = getPricingConfig(type);
  const distance = Number(distanceKm);
  if (!config || !Number.isFinite(distance) || distance <= 0 || distance > 100) return null;

  const durationMin = Math.max(3, Math.round(distance * 3.2 + 4));
  const estimatedFare = Math.max(config.min, Math.round(config.base + distance * config.perKm));
  return {
    vehicleType: type,
    distanceKm: Number(distance.toFixed(1)),
    durationMin,
    estimatedFare,
    currency: 'SYP'
  };
}

export function cancellationPolicy(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'searching') return { allowed: true, fee: 0, currency: 'SYP', reason: 'before_driver_assignment' };
  if (value === 'driver_assigned' || value === 'arriving') return { allowed: true, fee: 0, currency: 'SYP', reason: 'customer_cancellation' };
  return { allowed: false, fee: 0, currency: 'SYP', reason: 'status_not_cancellable' };
}

export function listPricing() {
  return Object.entries(CONFIGS).map(([vehicleType, config]) => ({ vehicleType, ...config, currency: 'SYP' }));
}
