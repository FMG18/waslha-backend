import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTripRequest, normalizeCoordinate } from '../src/domain/trip-contract.js';

test('normalizes a valid taxi trip request', () => {
  const trip = normalizeTripRequest({
    customerId: 'user-123',
    pickup: { lat: 33.5138, lng: 36.2913 },
    destination: { lat: 33.5200, lng: 36.3000 },
    vehicleType: 'economy',
    paymentMethod: 'cash'
  });

  assert.equal(trip.customerId, 'user-123');
  assert.deepEqual(trip.pickup, { lat: 33.5138, lng: 36.2913 });
  assert.equal(trip.vehicleType, 'economy');
  assert.equal(trip.paymentMethod, 'cash');
  assert.equal(trip.scheduledAt, null);
});

test('rejects invalid coordinates', () => {
  assert.throws(
    () => normalizeCoordinate({ lat: 120, lng: 36 }, 'موقع الانطلاق'),
    /خارج النطاق/
  );
});

test('rejects missing customer id', () => {
  assert.throws(
    () => normalizeTripRequest({
      pickup: { lat: 33, lng: 36 },
      destination: { lat: 34, lng: 37 }
    }),
    /معرّف الزبون مطلوب/
  );
});

test('rejects past scheduled trips', () => {
  assert.throws(
    () => normalizeTripRequest({
      customerId: 'user-123',
      pickup: { lat: 33, lng: 36 },
      destination: { lat: 34, lng: 37 },
      scheduledAt: new Date(Date.now() - 5 * 60_000).toISOString()
    }),
    /المستقبل/
  );
});
