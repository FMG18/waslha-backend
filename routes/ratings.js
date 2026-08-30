const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/ratingController');
const router = express.Router();
router.use(auth, authorize('customer'));
router.post('/rides/:id', controller.create);
module.exports = router;
