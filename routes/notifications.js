const express = require('express');
const { auth } = require('../middleware/auth');
const controller = require('../controllers/notificationController');
const router = express.Router();
router.use(auth);
router.get('/', controller.list);
router.patch('/:id/read', controller.markRead);
module.exports = router;
