const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const Captain = require('../models/Captain');
const { haversineKm, estimateDurationMinutes } = require('../utils/distance');
const { calculateFare } = require('./pricingService');

const transitions = {
  requested: ['searching', 'cancelled'],
  searching: ['captain_assigned', 'cancelled'],
  captain_assigned: ['captain_arriving', 'cancelled'],
  captain_arriving: ['captain_arrived', 'cancelled'],
  captain_arrived: ['trip_started', 'cancelled'],
  trip_started: ['trip_completed', 'cancelled'],
  trip_completed: [],
  cancelled: []
};

function assertTransition(from, to) {
  if (!transitions[from] || !transitions[from].includes(to)) {
    const error = new Error(`Invalid ride status transition: ${from} -> ${to}`);
    error.statusCode = 409;
    error.code = 'INVALID_RIDE_TRANSITION';
    throw error;
  }
}

function point(lat, lng, address = '') {
  return { type: 'Point', coordinates: [lng, lat], address };
}

async function createRide({ customerId, serviceType, pickup, dropoff, pickupAddress, dropoffAddress }) {
  const distanceKm = haversineKm(pickup, dropoff);
  const durationMin = estimateDurationMinutes(distanceKm);
  const fare = calculateFare(serviceType, distanceKm, durationMin);
  return Ride.create({
    customer: customerId,
    serviceType,
    pickup: point(pickup.lat, pickup.lng, pickupAddress),
    dropoff: point(dropoff.lat, dropoff.lng, dropoffAddress),
    estimatedDistanceKm: Number(distanceKm.toFixed(2)),
    estimatedDurationMin: durationMin,
    estimatedFare: fare,
    status: 'requested'
  });
}

async function assignCaptain(rideId, captainId) {
  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, status: 'searching', captain: null },
    { $set: { captain: captainId, status: 'captain_assigned' } },
    { new: true }
  );
  if (!ride) {
    const error = new Error('Ride is no longer available');
    error.statusCode = 409;
    error.code = 'RIDE_UNAVAILABLE';
    throw error;
  }
  await Captain.findOneAndUpdate({ _id: captainId, availability: 'online', status: 'active' }, { $set: { availability: 'busy' } });
  return ride;
}

async function changeStatus(ride, nextStatus) {
  assertTransition(ride.status, nextStatus);
  ride.status = nextStatus;
  if (nextStatus === 'trip_completed') ride.finalFare = ride.finalFare ?? ride.estimatedFare;
  if (nextStatus === 'cancelled') {
    ride.cancellation.cancelledAt = new Date();
  }
  return ride.save();
}

function canAccessRide(user, ride) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return ride.customer._id.toString() === user._id.toString();
  if (user.role === 'captain' && ride.captain) return ride.captain.user ? ride.captain.user.toString() === user._id.toString() : ride.captain._id.toString() === user._id.toString();
  return false;
}

module.exports = { createRide, assignCaptain, changeStatus, assertTransition, canAccessRide, transitions };
