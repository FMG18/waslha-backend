import { haversineKm } from './geo.js';

export function findNearestDrivers(drivers, pickup, vehicleType, limit = 5) {
  return drivers
    .filter((driver) => driver.available && (!vehicleType || driver.type === vehicleType))
    .map((driver) => ({ ...driver, distanceKm: haversineKm(pickup, { lat: driver.lat, lng: driver.lng }) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
