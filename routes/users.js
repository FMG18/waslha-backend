const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();
router.get('/me', auth, async (req, res, next) => { try { const user = await User.findById(req.user._id); res.json({ success: true, data: user }); } catch (err) { next(err); } });
module.exports = router;
