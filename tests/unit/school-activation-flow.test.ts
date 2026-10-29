import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSchoolActivationFlow } from '../../src/api/firebase/pulsecheckProvisioning/schoolActivationFlow';

test('school flow requires persisted AthleticMind scope and an athlete role', () => {
  assert.equal(resolveSchoolActivationFlow({ productBrand: 'athleticmind', role: 'athlete' }), true);
  for (const productBrand of [undefined, 'pulsecheck', 'unknown']) {
    assert.equal(resolveSchoolActivationFlow({ productBrand, role: 'athlete' }), false);
  }
  for (const role of [undefined, 'coach', 'staff', 'clinician']) {
    assert.equal(resolveSchoolActivationFlow({ productBrand: 'athleticmind', role }), false);
  }
});
