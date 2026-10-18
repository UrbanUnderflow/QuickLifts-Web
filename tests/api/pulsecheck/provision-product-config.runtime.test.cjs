const assert = require('node:assert/strict');
const test = require('node:test');
const { buildProvisioningPayload } = require('../../../src/lib/server/pulsecheck/provisionOrganizationAndTeam');
const input = (organization = {}) => ({ organization: { id: 'org', displayName: 'Program', ...organization }, team: { id: 'team', displayName: 'Team', teamType: 'club', sportOrProgram: 'Track' } });
test('new programs require explicit product selection with independent app defaults', () => {
  assert.throws(() => buildProvisioningPayload(input()));
  const { organizationPayload } = buildProvisioningPayload(input({ productBrand: 'pulsecheck' }));
  assert.equal(organizationPayload.productBrand, 'pulsecheck');
  assert.deepEqual(organizationPayload.appBranding, {});
});
test('program and installed app branding are independent settings', () => {
  const { organizationPayload } = buildProvisioningPayload(input({ productBrand: 'pulsecheck', appBranding: { pulsecheck: 'athleticmind', athleticmind: 'pulsecheck' } }));
  assert.equal(organizationPayload.productBrand, 'pulsecheck');
  assert.deepEqual(organizationPayload.appBranding, { pulsecheck: 'athleticmind', athleticmind: 'pulsecheck' });
});
test('provisioning rejects unsupported product and app identities', () => {
  assert.throws(() => buildProvisioningPayload(input({ productBrand: 'unknown' })));
  assert.throws(() => buildProvisioningPayload(input({ appBranding: { pulsecheck: 'unknown' } })));
});
test('paired provisioning stores visual experience independently and validates explicit choices',()=>{
  const standard=buildProvisioningPayload(input({productBrand:'athleticmind'})).organizationPayload;
  assert.deepEqual(standard.appExperience,{ios:'standard'});
  const clay=buildProvisioningPayload(input({productBrand:'pulsecheck',appBranding:{pulsecheck:'athleticmind'},appExperience:{ios:'clay'}})).organizationPayload;
  assert.deepEqual(clay.appExperience,{ios:'clay'});assert.equal(clay.productBrand,'pulsecheck');assert.equal(clay.appBranding.pulsecheck,'athleticmind');
  assert.throws(()=>buildProvisioningPayload(input({productBrand:'pulsecheck',appExperience:{ios:'invalid'}})));
});
