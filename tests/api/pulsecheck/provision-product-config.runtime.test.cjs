const assert = require('node:assert/strict');
const test = require('node:test');
const { buildProvisioningPayload } = require('../../../src/lib/server/pulsecheck/provisionOrganizationAndTeam');
const input = (organization = {}) => ({ organization: { id: 'org', displayName: 'Program', ...organization }, team: { id: 'team', displayName: 'Team', teamType: 'club', sportOrProgram: 'Track' } });
test('new programs default to AthleticMind with app identity defaults', () => {
  const { organizationPayload } = buildProvisioningPayload(input());
  assert.equal(organizationPayload.productBrand, 'athleticmind');
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
