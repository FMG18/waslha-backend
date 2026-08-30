const mongoose = require('mongoose');
const User = require('../models/User');
const Captain = require('../models/Captain');
const Ride = require('../models/Ride');

async function stats(req, res, next) {
  try {
    const [users, captains, onlineCaptains, activeRides, completedRides, cancelledRides] = await Promise.all([
      User.countDocuments(),
      Captain.countDocuments(),
      Captain.countDocuments({ status: 'active', availability: 'online' }),
      Ride.countDocuments({ status: { $in: ['requested','searching','captain_assigned','captain_arriving','captain_arrived','trip_started'] } }),
      Ride.countDocuments({ status: 'trip_completed' }),
      Ride.countDocuments({ status: 'cancelled' })
    ]);
    res.json({ success: true, data: { users, captains, onlineCaptains, activeRides, completedRides, cancelledRides } });
  } catch (err) { next(err); }
}

async function listRides(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.serviceType) filter.serviceType = req.query.serviceType;
    const [rides, total] = await Promise.all([
      Ride.find(filter).populate('customer', 'name phone').populate({ path: 'captain', populate: { path: 'user', select: 'name phone' } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Ride.countDocuments(filter)
    ]);
    res.json({ success: true, data: { items: rides, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (err) { next(err); }
}

async function listCaptains(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.availability) filter.availability = req.query.availability;
    const [captains, total] = await Promise.all([
      Captain.find(filter).populate('user', 'name phone isActive').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Captain.countDocuments(filter)
    ]);
    res.json({ success: true, data: { items: captains, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (err) { next(err); }
}

async function updateCaptainStatus(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { const e = new Error('Captain not found'); e.statusCode = 404; e.code = 'CAPTAIN_NOT_FOUND'; throw e; }
    const allowed = ['pending', 'active', 'suspended'];
    if (!allowed.includes(req.body.status)) { const e = new Error('Invalid captain status'); e.statusCode = 400; e.code = 'INVALID_STATUS'; throw e; }
    const captain = await Captain.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status, ...(req.body.status !== 'active' ? { availability: 'offline' } : {}) } }, { new: true }).populate('user', 'name phone isActive');
    if (!captain) { const e = new Error('Captain not found'); e.statusCode = 404; e.code = 'CAPTAIN_NOT_FOUND'; throw e; }
    res.json({ success: true, data: captain });
  } catch (err) { next(err); }
}

async function updateUserStatus(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { const e = new Error('User not found'); e.statusCode = 404; e.code = 'USER_NOT_FOUND'; throw e; }
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { isActive: Boolean(req.body.isActive) } }, { new: true }).select('-password');
    if (!user) { const e = new Error('User not found'); e.statusCode = 404; e.code = 'USER_NOT_FOUND'; throw e; }
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

module.exports = { stats, listRides, listCaptains, updateCaptainStatus, updateUserStatus };
