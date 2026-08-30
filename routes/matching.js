const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/matchingController');

const router = express.Router();
router.use(auth);
router.post('/rides/:id/start', authorize('customer', 'admin'), controller.begin);
router.post('/rides/:id/claim', authorize('captain'), controller.claim);

module.exports = router;
