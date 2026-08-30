const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const Captain = require('../models/Captain');
const { success } = require('../utils/response');
const { startMatching, claimNextCaptain } = require('../services/matchingService');

function fail(message, code, statusCode = 400) {
  const error = new Error(message); error.code = code; error.statusCode = statusCode; return error;
}

async function begin(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw fail('Ride not found', 'RIDE_NOT_FOUND', 404);
    const ride = await Ride.findById(req.params.id);
    if (!ride) throw fail('Ride not found', 'RIDE_NOT_FOUND', 404);
    if (!ride.customer.equals(req.user._id) && req.user.role !== 'admin') throw fail('Forbidden', 'FORBIDDEN', 403);
    const result = await startMatching(ride._id);
    return success(res, { ride: result.ride, candidatesCount: result.candidates.length });
  } catch (error) { next(error); }
}

async function claim(req, res, next) {
  try {
    const captain = await Captain.findOne({ user: req.user._id, status: 'active', availability: 'online' });
    if (!captain) throw fail('Captain is not available', 'CAPTAIN_NOT_AVAILABLE', 409);
    if (!mongoose.isValidObjectId(req.params.id)) throw fail('Ride not found', 'RIDE_NOT_FOUND', 404);
    const ride = await claimNextCaptain(req.params.id, captain._id);
    if (!ride) throw fail('Ride is no longer available', 'RIDE_UNAVAILABLE', 409);
    const locked = await Captain.findOneAndUpdate(
      { _id: captain._id, status: 'active', availability: 'online' },
      { $set: { availability: 'busy' } },
      { new: true }
    );
    if (!locked) {
      await Ride.updateOne({ _id: ride._id, captain: captain._id, status: 'captain_assigned' }, { $set: { captain: null, status: 'searching' } });
      throw fail('Captain is no longer available', 'CAPTAIN_NOT_AVAILABLE', 409);
    }
    return success(res, ride);
  } catch (error) { next(error); }
}

module.exports = { begin, claim };
