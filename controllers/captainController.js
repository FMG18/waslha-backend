const Captain = require('../models/Captain');

async function getMe(req, res, next) {
  try { const captain = await Captain.findOne({ user: req.user._id }).populate('user', 'name phone role profile'); if (!captain) { const e = new Error('Captain profile not found'); e.statusCode = 404; e.code = 'CAPTAIN_NOT_FOUND'; throw e; } res.json({ success: true, data: captain }); } catch (err) { next(err); }
}

async function updateAvailability(req, res, next) {
  try {
    const { availability } = req.body;
    if (!['offline', 'online'].includes(availability)) { const e = new Error('Availability must be online or offline'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e; }
    const captain = await Captain.findOneAndUpdate({ user: req.user._id, status: 'active', availability: { $ne: 'busy' } }, { availability }, { new: true });
    if (!captain) { const e = new Error('Captain is not available for this change'); e.statusCode = 409; e.code = 'CAPTAIN_NOT_AVAILABLE'; throw e; }
    res.json({ success: true, data: captain });
  } catch (err) { next(err); }
}

async function updateLocation(req, res, next) {
  try {
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) { const e = new Error('Valid lat and lng are required'); e.statusCode = 400; e.code = 'INVALID_LOCATION'; throw e; }
    const captain = await Captain.findOneAndUpdate({ user: req.user._id, status: 'active' }, { currentLocation: { type: 'Point', coordinates: [lng, lat], updatedAt: new Date() } }, { new: true });
    if (!captain) { const e = new Error('Captain profile not found'); e.statusCode = 404; e.code = 'CAPTAIN_NOT_FOUND'; throw e; }
    res.json({ success: true, data: { location: captain.currentLocation } });
  } catch (err) { next(err); }
}
module.exports = { getMe, updateAvailability, updateLocation };
