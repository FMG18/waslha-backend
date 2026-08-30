const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const Rating = require('../models/Rating');
const { createRating } = require('../services/ratingService');

async function create(req, res, next) {
  try {
    const { score, comment = '' } = req.body;
    if (!Number.isInteger(Number(score)) || Number(score) < 1 || Number(score) > 5) {
      const e = new Error('Score must be an integer from 1 to 5'); e.statusCode = 400; e.code = 'INVALID_SCORE'; throw e;
    }
    if (!mongoose.isValidObjectId(req.params.id)) { const e = new Error('Ride not found'); e.statusCode = 404; e.code = 'RIDE_NOT_FOUND'; throw e; }
    const ride = await Ride.findOne({ _id: req.params.id, customer: req.user._id });
    if (!ride) { const e = new Error('Ride not found'); e.statusCode = 404; e.code = 'RIDE_NOT_FOUND'; throw e; }
    if (ride.status !== 'trip_completed' || !ride.captain) { const e = new Error('Only completed rides can be rated'); e.statusCode = 409; e.code = 'RIDE_NOT_COMPLETED'; throw e; }
    if (await Rating.exists({ ride: ride._id })) { const e = new Error('Ride has already been rated'); e.statusCode = 409; e.code = 'RIDE_ALREADY_RATED'; throw e; }
    const rating = await createRating({ ride, customerId: req.user._id, score: Number(score), comment });
    return res.status(201).json({ success: true, data: rating });
  } catch (err) {
    if (err.code === 11000) { err.statusCode = 409; err.code = 'RIDE_ALREADY_RATED'; err.message = 'Ride has already been rated'; }
    next(err);
  }
}
module.exports = { create };
