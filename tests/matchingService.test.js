const test = require('node:test');
const assert = require('node:assert/strict');
const { serviceToVehicleType, OFFER_TIMEOUT_MS } = require('../services/matchingService');

test('matching maps services to vehicle types', () => {
  assert.equal(serviceToVehicleType('taxi'), 'taxi');
  assert.equal(serviceToVehicleType('motorcycle'), 'motorcycle');
  assert.equal(serviceToVehicleType('delivery'), 'delivery');
  assert.equal(serviceToVehicleType('unknown'), null);
});

test('matching offer timeout is bounded', () => {
  assert.equal(OFFER_TIMEOUT_MS, 15000);
  assert.ok(OFFER_TIMEOUT_MS > 0 && OFFER_TIMEOUT_MS <= 30000);
});
