import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSchoolActivationFlow, schoolContactComplete, validInstitutionalEmail } from '../../src/api/firebase/pulsecheckProvisioning/schoolActivationFlow';

test('school flow requires persisted AthleticMind scope and an athlete role', () => {
  assert.equal(resolveSchoolActivationFlow({ productBrand: 'athleticmind', role: 'athlete' }), true);
  for (const productBrand of [undefined, 'pulsecheck', 'unknown']) {
    assert.equal(resolveSchoolActivationFlow({ productBrand, role: 'athlete' }), false);
  }
  for (const role of [undefined, 'coach', 'staff', 'clinician']) {
    assert.equal(resolveSchoolActivationFlow({ productBrand: 'athleticmind', role }), false);
  }
});

test('school contact requires a separately collected email and an international phone', () => {
  for (const institutionalEmail of ['', 'bad', 'a@privaterelay.appleid.com']) assert.equal(schoolContactComplete({institutionalEmail, phone: '+12025550123'}), false);
  for (const phone of ['', '2025550123', '+00000000', '+123']) assert.equal(schoolContactComplete({institutionalEmail:'athlete@school.edu', phone}), false);
  assert.equal(validInstitutionalEmail(' Athlete@School.edu '), true);
  assert.equal(schoolContactComplete({institutionalEmail:'athlete@school.edu', phone:'+12025550123'}), true);
});
