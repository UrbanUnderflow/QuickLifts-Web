const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveProductConfig, resolveAppBranding, normalizeAppBranding, validateProductBrand } = require('../../src/lib/pulsecheck/productConfig');
const { resolveProgramProductConfig, resolveIncidentSupportRoute } = require('../../netlify/functions/lib/program-product-config');
test('program default is AthleticMind; app identities default independently', () => {
  assert.equal(resolveProductConfig({}).brand, 'athleticmind');
  assert.equal(resolveProductConfig({ productBrand: 'pulsecheck' }).escalationModel, '988');
  assert.equal(resolveAppBranding({ productBrand: 'athleticmind' }, 'pulsecheck').brand, 'pulsecheck');
  assert.equal(resolveAppBranding({}, 'pulsecheck').escalationModel, undefined);
  assert.equal(resolveAppBranding({ productBrand: 'pulsecheck' }, 'athleticmind').brand, 'athleticmind');
  assert.equal(resolveAppBranding({ appBranding: { pulsecheck: 'athleticmind' } }, 'pulsecheck').brand, 'athleticmind');
});
test('write validators reject invalid identities and preserve default overrides', () => {
  assert.deepEqual(normalizeAppBranding(undefined), {});
  assert.throws(() => normalizeAppBranding({ other: 'athleticmind' }));
  assert.throws(() => validateProductBrand('invalid'));
});
test('persisted team organization controls routing', async () => {
  const db = { collection: (name) => ({ doc: (id) => ({ get: async () => ({ exists: true, data: () => name === 'pulsecheck-teams' ? { organizationId: 'real' } : { productBrand: id === 'real' ? 'pulsecheck' : 'athleticmind' } }) }) }) };
  const product = await resolveProgramProductConfig(db, { teamId: 'team', organizationId: 'forged' });
  assert.equal(product.organizationId, 'real');
  assert.equal(resolveIncidentSupportRoute(null, product), 'hotline');
  assert.equal(resolveIncidentSupportRoute({ supportRoute: 'clinician' }, product), 'clinician');
  assert.equal(resolveIncidentSupportRoute({ clinicalReferenceId: 'open-case' }, product), 'clinician');
  assert.equal(resolveIncidentSupportRoute({ createdAt: 1 }, product), 'clinician');
});
