const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveNativeAppDistribution } = require('../../netlify/functions/lib/native-app-distribution');
const db = (records) => ({ collection: (collection) => ({ doc: (id) => ({ get: async () => ({ exists: !!records[`${collection}/${id}`], data: () => records[`${collection}/${id}`] }) }) }) });
test('activation distribution uses saved pilot organization, ignoring supplied organization and display branding', async () => {
  const result = await resolveNativeAppDistribution(db({
    'pulsecheck-pilots/pilot': { organizationId: 'university' },
    'pulsecheck-organizations/university': { productBrand: 'athleticmind', appBranding: { athleticmind: 'pulsecheck' } },
    'pulsecheck-organizations/other': { productBrand: 'pulsecheck' },
  }), { pilotId: 'pilot', organizationId: 'other' });
  assert.equal(result.brand, 'athleticmind');
  assert.equal(result.openAppUrl, 'athleticmind://open');
  assert.equal(result.iosUrl, '');
});
test('missing pilot identity fails closed instead of delivering another app', async () => {
  await assert.rejects(resolveNativeAppDistribution(db({}), { pilotId: 'missing' }), /Pilot was not found/);
});
test('PulseCheck distribution remains available for existing organizations', async () => {
  const result = await resolveNativeAppDistribution(db({ 'pulsecheck-organizations/legacy': { productBrand: 'pulsecheck' } }), { organizationId: 'legacy' });
  assert.equal(result.openAppUrl, 'pulsecheck://open');
  assert.match(result.iosUrl, /id6747253393$/);
});

test('activation fails closed without saved explicit program identity', async () => {
  await assert.rejects(resolveNativeAppDistribution(db({}), {}), /Organization is required/);
  await assert.rejects(resolveNativeAppDistribution(db({ 'pulsecheck-organizations/unknown': {} }), { organizationId: 'unknown' }), /productBrand must be configured/);
});
