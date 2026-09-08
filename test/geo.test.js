import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, sortByDistance } from '../src/services/geo.js';

test('haversine distance returns zero for same point', () => {
  assert.equal(haversineKm({ lat: 33, lng: 36 }, { lat: 33, lng: 36 }), 0);
});

test('sortByDistance orders nearby points first', () => {
  const origin = { lat: 33, lng: 36 };
  const result = sortByDistance(origin, [
    { id: 'far', lat: 34, lng: 37 },
    { id: 'near', lat: 33.01, lng: 36.01 }
  ]);
  assert.equal(result[0].id, 'near');
});
