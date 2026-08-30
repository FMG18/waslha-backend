const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const controller = require('../controllers/rideController');

const router = express.Router();
router.use(auth);
const createSchema = body => {
  if (!['taxi', 'motorcycle', 'delivery'].includes(body.serviceType)) return { error: 'Invalid service type' };
  for (const name of ['pickup', 'dropoff']) {
    const p = body[name];
    if (!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng)) || Number(p.lat) < -90 || Number(p.lat) > 90 || Number(p.lng) < -180 || Number(p.lng) > 180) return { error: `Invalid ${name} coordinates` };
  }
};
router.post('/', authorize('customer'), validate(createSchema), controller.create);
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
