function toRadians(value) { return value * Math.PI / 180; }

function validateCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function haversineKm(from, to) {
  if (!validateCoordinate(from.lat, from.lng) || !validateCoordinate(to.lat, to.lng)) {
    const error = new Error('Invalid coordinates');
    error.statusCode = 400;
    error.code = 'INVALID_COORDINATES';
    throw error;
  }
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDurationMinutes(distanceKm, averageSpeedKmh = 30) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || averageSpeedKmh <= 0) return 0;
  return Math.max(1, Math.ceil((distanceKm / averageSpeedKmh) * 60));
}

module.exports = { haversineKm, estimateDurationMinutes, validateCoordinate };
