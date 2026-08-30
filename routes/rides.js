const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/rideController');

const router = express.Router();
router.use(auth);
router.post('/', authorize('customer'), controller.create);
router.get('/:id', controller.getById);
router.post('/:id/cancel', authorize('customer', 'captain', 'admin'), controller.cancel);
router.post('/:id/accept', authorize('captain'), controller.accept);
router.post('/:id/:action', authorize('captain'), (req, res, next) => {
  if (!['arriving', 'arrived', 'start', 'complete'].includes(req.params.action)) {
    const error = new Error('Unsupported ride action'); error.code = 'INVALID_ACTION'; error.statusCode = 404; return next(error);
  }
  return controller.captainAction(req, res, next);
});

module.exports = router;
