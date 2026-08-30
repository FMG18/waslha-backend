const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const Captain = require('../models/Captain');
const { success } = require('../utils/response');
const { createRide, assignCaptain, changeStatus } = require('../services/rideService');

function bad(message, code = 'VALIDATION_ERROR', statusCode = 400) {
  const error = new Error(message); error.code = code; error.statusCode = statusCode; return error;
}

function readPoint(value, name) {
  const lat = Number(value?.lat); const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw bad(`Invalid ${name} coordinates`, 'INVALID_COORDINATES');
  return { lat, lng };
}

async function create(req, res, next) {
  try {
    const { serviceType, pickup, dropoff, pickupAddress = '', dropoffAddress = '' } = req.body;
    if (!['taxi', 'motorcycle', 'delivery'].includes(serviceType)) throw bad('Invalid service type', 'INVALID_SERVICE_TYPE');
    const ride = await createRide({ customerId: req.user._id, serviceType, pickup: readPoint(pickup, 'pickup'), dropoff: readPoint(dropoff, 'dropoff'), pickupAddress, dropoffAddress });
    return success(res, ride, 201);
  } catch (error) { next(error); }
}

async function getById(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw bad('Ride not found', 'RIDE_NOT_FOUND', 404);
    const ride = await Ride.findById(req.params.id).populate('customer', 'name phone profile').populate({ path: 'captain', populate: { path: 'user', select: 'name phone profile' } });
    if (!ride) throw bad('Ride not found', 'RIDE_NOT_FOUND', 404);
    const isAdmin = req.user.role === 'admin';
    const isCustomer = ride.customer._id.equals(req.user._id);
    const isCaptain = req.user.role === 'captain' && ride.captain?.user?._id?.equals(req.user._id);
    if (!isAdmin && !isCustomer && !isCaptain) throw bad('You do not have access to this ride', 'FORBIDDEN', 403);
    return success(res, ride);
  } catch (error) { next(error); }
}

async function accept(req, res, next) {
  try {
    const captain = await Captain.findOne({ user: req.user._id, status: 'active', availability: 'online' });
    if (!captain) throw bad('Captain is not available', 'CAPTAIN_NOT_AVAILABLE', 409);
    const ride = await assignCaptain(req.params.id, captain._id);
    return success(res, ride);
  } catch (error) { next(error); }
}

async function captainAction(req, res, next) {
  try {
    const captain = await Captain.findOne({ user: req.user._id });
    if (!captain) throw bad('Captain profile not found', 'CAPTAIN_NOT_FOUND', 404);
    const ride = await Ride.findById(req.params.id);
    if (!ride || !ride.captain?.equals(captain._id)) throw bad('Ride not found', 'RIDE_NOT_FOUND', 404);
    const actionMap = { arriving: 'captain_arriving', arrived: 'captain_arrived', start: 'trip_started', complete: 'trip_completed' };
    const nextStatus = actionMap[req.params.action];
    const updated = await changeStatus(ride, nextStatus);
    if (nextStatus === 'trip_completed') await Captain.updateOne({ _id: captain._id }, { $set: { availability: 'online' } });
    return success(res, updated);
  } catch (error) { next(error); }
}

async function cancel(req, res, next) {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) throw bad('Ride not found', 'RIDE_NOT_FOUND', 404);
    const isCustomer = req.user.role === 'customer' && ride.customer.equals(req.user._id);
    let isCaptain = false;
    if (req.user.role === 'captain') {
      const captain = await Captain.findOne({ user: req.user._id });
      isCaptain = !!captain && ride.captain?.equals(captain._id);
    }
    if (req.user.role !== 'admin' && !isCustomer && !isCaptain) throw bad('You do not have access to this ride', 'FORBIDDEN', 403);
    const updated = await changeStatus(ride, 'cancelled');
    updated.cancellation.cancelledBy = req.user.role;
    updated.cancellation.reason = String(req.body?.reason || '').trim().slice(0, 300);
    await updated.save();
    if (ride.captain) await Captain.updateOne({ _id: ride.captain }, { $set: { availability: 'online' } });
    return success(res, updated);
  } catch (error) { next(error); }
}

module.exports = { create, getById, accept, captainAction, cancel };
