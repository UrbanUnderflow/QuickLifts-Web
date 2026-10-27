const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveProductConfig, resolveAppBranding, normalizeAppBranding, validateProductBrand } = require('../../src/lib/pulsecheck/productConfig');
const { resolveProgramProductConfig, resolveIncidentSupportRoute } = require('../../netlify/functions/lib/program-product-config');
test('presentation fallback is PulseCheck; app identities default independently', () => {
  assert.equal(resolveProductConfig({}).brand, 'pulsecheck');
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

test('server routing rejects missing and invalid persisted product', async () => {
  for (const data of [null, {}, { productBrand: 'invalid' }]) {
    const db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: Boolean(data), data: () => data }) }) }) };
    await assert.rejects(resolveProgramProductConfig(db, { organizationId: 'org' }));
  }
});

test('app experience is always Clay for every organization and platform', () => {
 const { resolveAppExperience } = require('../../src/lib/pulsecheck/productConfig');
 for (const value of [undefined, null, {}, { ios: 'standard', android: 'standard' }, { ios: 'clay' }]) assert.deepEqual(resolveAppExperience(value), { ios: 'clay', android: 'clay' });
 const first = resolveAppExperience(); first.ios = 'standard';
 assert.equal(resolveAppExperience().ios, 'clay');
});
