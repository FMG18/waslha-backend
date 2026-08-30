const Ride = require('../models/Ride');
const Captain = require('../models/Captain');
const { roomForUser, roomForRide } = require('./index');

function emitRideStatus(io, ride) {
  io.to(roomForRide(ride._id.toString())).emit('ride:status:update', { rideId: ride._id.toString(), status: ride.status });
  if (ride.customer) io.to(`customer:${ride.customer.toString()}`).emit('ride:status:update', { rideId: ride._id.toString(), status: ride.status });
  if (ride.captain) io.to(`captain:${ride.captain.toString()}`).emit('ride:status:update', { rideId: ride._id.toString(), status: ride.status });
}

async function updateCaptainLocation(io, user, payload = {}) {
  if (user.role !== 'captain') throw new Error('Only captains can update location');
  const lat = Number(payload.lat), lng = Number(payload.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('Invalid coordinates');
  const captain = await Captain.findOneAndUpdate({ user: user._id, status: 'active' }, { $set: { currentLocation: { type:'Point', coordinates:[lng,lat], updatedAt:new Date() } } }, { new:true }).select('_id');
  if (!captain) throw new Error('Captain is not active');
  const activeRide = await Ride.findOne({ captain: captain._id, status: { $in:['captain_assigned','captain_arriving','captain_arrived','trip_started'] } }).select('_id customer');
  if (activeRide) {
    io.to(roomForRide(activeRide._id.toString())).emit('captain:location:update', { rideId:activeRide._id.toString(), lat, lng, timestamp:new Date().toISOString() });
    io.to(roomForUser({ role:'customer', _id:activeRide.customer })).emit('captain:location:update', { rideId:activeRide._id.toString(), lat, lng, timestamp:new Date().toISOString() });
  }
  return { lat, lng, timestamp:new Date().toISOString() };
}

module.exports = { emitRideStatus, updateCaptainLocation };
