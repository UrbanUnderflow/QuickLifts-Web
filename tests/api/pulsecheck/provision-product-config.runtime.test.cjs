const assert = require('node:assert/strict');
const test = require('node:test');
const { buildProvisioningPayload } = require('../../../src/lib/server/pulsecheck/provisionOrganizationAndTeam');
const input = (organization = {}) => ({ organization: { id: 'org', displayName: 'Program', ...organization }, team: { id: 'team', displayName: 'Team', teamType: 'club', sportOrProgram: 'Track' } });
test('new programs default to AthleticMind branding and the Pro track', () => {
  const defaults = buildProvisioningPayload(input());
  assert.equal(defaults.organizationPayload.productBrand, 'athleticmind');
  assert.equal(defaults.teamPayload.commercialConfig.youthTrack, 'pro');
  const { organizationPayload } = buildProvisioningPayload(input({ productBrand: 'pulsecheck' }));
  assert.equal(organizationPayload.productBrand, 'pulsecheck');
  assert.deepEqual(organizationPayload.appBranding, { pulsecheck: 'athleticmind', athleticmind: 'athleticmind' });
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
test('paired provisioning no longer writes the retired appearance setting',()=>{
  const payload=buildProvisioningPayload(input({productBrand:'pulsecheck',appBranding:{pulsecheck:'athleticmind'},appExperience:{ios:'standard'}})).organizationPayload;
  assert.equal(payload.appExperience,undefined);assert.equal(payload.productBrand,'pulsecheck');assert.equal(payload.appBranding.pulsecheck,'athleticmind');
});
