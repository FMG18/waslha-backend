import { sortByDistance } from './geo.js';

const drivers = [
  { id: 'cap-101', name: 'أحمد', phone: null, rating: 4.9, vehicle: 'Toyota Corolla', plate: '1234', type: 'economy', lat: 33.5138, lng: 36.2765, available: true },
  { id: 'cap-102', name: 'محمد', phone: null, rating: 4.8, vehicle: 'Hyundai Elantra', plate: '5682', type: 'economy', lat: 33.5180, lng: 36.2892, available: true },
  { id: 'cap-203', name: 'سامر', phone: null, rating: 4.9, vehicle: 'Kia Sportage', plate: '9041', type: 'comfort', lat: 33.5050, lng: 36.2940, available: true }
];

const clone = (driver) => driver ? { ...driver } : null;

export function listDrivers({ vehicleType = null } = {}) {
  return drivers
    .filter((driver) => driver.available && (!vehicleType || driver.type === vehicleType))
    .map(clone);
}

export function getDriver(id) {
  return clone(drivers.find((driver) => driver.id === id));
}

export function getNearestAvailableDriver(point, vehicleType = null) {
  const eligible = listDrivers({ vehicleType });
  if (!eligible.length) return null;
  return clone(sortByDistance(point, eligible)[0] || null);
}

export function setDriverAvailability(id, available) {
  const driver = drivers.find((item) => item.id === id);
  if (!driver) return null;
  driver.available = Boolean(available);
  return clone(driver);
}

export function updateDriverLocation(id, lat, lng) {
  const driver = drivers.find((item) => item.id === id);
  if (!driver) return null;
  driver.lat = lat;
  driver.lng = lng;
  return clone(driver);
}

export function reserveDriver(id) {
  const driver = drivers.find((item) => item.id === id);
  if (!driver || !driver.available) return null;
  driver.available = false;
  return clone(driver);
}

export function releaseDriver(id) {
  const driver = drivers.find((item) => item.id === id);
  if (!driver) return null;
  driver.available = true;
  return clone(driver);
}
