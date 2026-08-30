const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { getMe, updateAvailability, updateLocation } = require('../controllers/captainController');
const router = express.Router();
router.use(auth, authorize('captain'));
router.get('/me', getMe);
router.patch('/status', updateAvailability);
router.patch('/location', updateLocation);
module.exports = router;
