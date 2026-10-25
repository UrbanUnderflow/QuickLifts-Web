import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { healthBaselineConsentDocuments, selectConsentDocumentsForProduct, PARTICIPATION_CONSENT, HEALTH_CONSENT, RESEARCH_CONSENT } from '../../src/api/firebase/pulsecheckProvisioning/consentPolicy';
const require = createRequire(import.meta.url);
const { resolveClinicalConsentDocuments, clinicalAuthorizationAllowsTransfer } = require('../../netlify/functions/lib/clinical-authorization.js');
for (const productBrand of ['pulsecheck', 'athleticmind']) {
  test(`routine server terms match client stock terms for ${productBrand}`, () => {
    const docs = [PARTICIPATION_CONSENT, HEALTH_CONSENT];
    assert.deepEqual(resolveClinicalConsentDocuments({ teamDocuments: docs, productBrand }), selectConsentDocumentsForProduct(docs, productBrand));
    assert.deepEqual(resolveClinicalConsentDocuments({ productBrand }), selectConsentDocumentsForProduct(docs, productBrand));
    const custom = { ...PARTICIPATION_CONSENT, id: 'institution-participation', body: 'Custom institution agreement', version: 'v4' };
    assert.deepEqual(resolveClinicalConsentDocuments({ teamDocuments: [custom], pilot: { studyMode: 'research' }, productBrand }), healthBaselineConsentDocuments([custom, RESEARCH_CONSENT], undefined, undefined, productBrand));
  });
}
test('routine authorization fails closed for absent scope, absent health terms, ended participation, old receipts and refusal', () => {
  const documents = resolveClinicalConsentDocuments({ productBrand: 'pulsecheck' });
  const health = documents.find((doc: typeof HEALTH_CONSENT) => doc.category === 'health_authorization');
  const entry = { decision: 'accepted', version: health.version, document: health, signedName: 'Synthetic Athlete' };
  const decisions = { [health.id]: entry };
  assert.equal(clinicalAuthorizationAllowsTransfer({ documents, decisions }), true);
  assert.equal(clinicalAuthorizationAllowsTransfer({ documents: [], decisions }), false);
  assert.equal(clinicalAuthorizationAllowsTransfer({ documents, decisions, participationEnded: true }), false);
  for (const decision of ['declined', 'revoked']) assert.equal(clinicalAuthorizationAllowsTransfer({ documents, decisions: { [health.id]: { ...entry, decision } } }), false);
  assert.equal(clinicalAuthorizationAllowsTransfer({ documents, decisions: { [health.id]: { ...entry, version: 'v1', document: HEALTH_CONSENT } } }), false);
  assert.deepEqual(resolveClinicalConsentDocuments({ productBrand: undefined }), []);
  assert.equal(clinicalAuthorizationAllowsTransfer({ tier: 3, participationEnded: true }), true);
});
