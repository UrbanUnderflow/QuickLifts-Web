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

test('iOS app experience validates writes and defaults invalid presentation reads',()=>{
 const {normalizeAppExperience,resolveAppExperience}=require('../../src/lib/pulsecheck/productConfig');
 assert.deepEqual(normalizeAppExperience({ios:'clay'}),{ios:'clay'});
 assert.deepEqual(normalizeAppExperience(undefined),{ios:'standard'});
 for(const value of [null,'clay',{}, {ios:'unknown'},{ios:'clay',productBrand:'athleticmind'}])assert.throws(()=>normalizeAppExperience(value));
 assert.deepEqual(resolveAppExperience({ios:'unknown'}),{ios:'standard'});
});
