export function haversineKm(a, b) {
  const lat1 = Number(a?.lat);
  const lon1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lon2 = Number(b?.lng);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function sortByDistance(origin, items) {
  return items
    .map((item) => ({ ...item, distanceKm: Number(haversineKm(origin, item).toFixed(2)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
