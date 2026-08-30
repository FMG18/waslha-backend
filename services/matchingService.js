const Captain = require('../models/Captain');
const Ride = require('../models/Ride');

const DEFAULT_RADIUS_KM = 5;
const MAX_CANDIDATES = 20;

function serviceToVehicleType(serviceType) {
  if (serviceType === 'taxi') return 'taxi';
  if (serviceType === 'motorcycle') return 'motorcycle';
  if (serviceType === 'delivery') return 'delivery';
  return null;
}

async function findNearbyCaptains({ ride, radiusKm = DEFAULT_RADIUS_KM, limit = MAX_CANDIDATES }) {
  const vehicleType = serviceToVehicleType(ride.serviceType);
  const [lng, lat] = ride.pickup.coordinates;
  const maxDistanceMeters = Math.max(500, Number(radiusKm) * 1000);

  const filter = {
    status: 'active',
    availability: 'online',
    'currentLocation.coordinates': { $exists: true },
    ...(vehicleType ? { 'vehicle.type': vehicleType } : {})
  };

  return Captain.find({
    ...filter,
    currentLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistanceMeters
      }
    }
  }).limit(Math.min(Math.max(Number(limit) || MAX_CANDIDATES, 1), MAX_CANDIDATES));
}

async function startMatching(rideId, options = {}) {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, status: 'requested', captain: null },
    { $set: { status: 'searching' } },
    { new: true }
  );

  if (!ride) {
    const error = new Error('Ride is not available for matching');
    error.statusCode = 409;
    error.code = 'RIDE_NOT_MATCHABLE';
    throw error;
  }

  const candidates = await findNearbyCaptains({ ride, ...options });
  return { ride, candidates };
}

async function claimNextCaptain(rideId, captainId) {
  return Ride.findOneAndUpdate(
    { _id: rideId, status: 'searching', captain: null },
    { $set: { captain: captainId, status: 'captain_assigned' } },
    { new: true }
  );
}

module.exports = { findNearbyCaptains, startMatching, claimNextCaptain, serviceToVehicleType };
