const test=require('node:test');
const assert=require('node:assert/strict');
const { coordinates }=require('../middleware/validation');
test('coordinates accepts valid lng/lat pair',()=>assert.equal(coordinates([36.2765,33.5138]),true));
test('coordinates rejects invalid ranges',()=>{assert.equal(coordinates([181,33]),false);assert.equal(coordinates([36,91]),false);assert.equal(coordinates([36]),false);});
