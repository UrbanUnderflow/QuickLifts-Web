import test from 'node:test';
import assert from 'node:assert/strict';
import { isHealthBaselineEnabled } from '../../src/api/firebase/pulsecheckProvisioning/healthBaselinePolicy';
import { healthBaselineConsentDocuments, consentDecisionComplete, PARTICIPATION_CONSENT, HEALTH_CONSENT, RESEARCH_CONSENT, STAFF_CONSENT } from '../../src/api/firebase/pulsecheckProvisioning/consentPolicy';
import { hasCompletedRequiredConsents } from '../../src/api/firebase/pulsecheckProvisioning/accessState';
import { resolveAtomicConsentDocuments } from '../../src/lib/server/pulsecheck/atomicConsent';

const receipt = (document: typeof HEALTH_CONSENT, decision: 'accepted' | 'declined') => ({
  document, decision, signedName: 'Synthetic Athlete', version: document.version, decidedAt: '2026-10-25T12:00:00.000Z',
});

test('health baseline defaults on and only an explicit boolean setting can turn it off', () => {
  for (const value of [undefined, null, 'false', 0, {}, []]) {
    assert.equal(isHealthBaselineEnabled({ healthBaselineEnabled: value }), true);
  }
  assert.equal(isHealthBaselineEnabled(undefined, { healthBaselineEnabled: false }), false);
  assert.equal(isHealthBaselineEnabled({ healthBaselineEnabled: true }, { healthBaselineEnabled: false }), true);
  assert.equal(isHealthBaselineEnabled({ healthBaselineEnabled: false }, { healthBaselineEnabled: true }), false);
});

test('default-on supplies a product-correct health decision before onboarding can complete', () => {
  const docs = healthBaselineConsentDocuments([PARTICIPATION_CONSENT], undefined, undefined, 'pulsecheck');
  const health = docs.find(document => document.category === 'health_authorization')!;
  assert.ok(health);
  assert.equal(health.version, 'v1-pulsecheck');
  assert.equal(/auntedna/i.test(health.body), false);
  assert.equal(hasCompletedRequiredConsents({ requiredConsents: docs, consentDecisions: {
    [PARTICIPATION_CONSENT.id]: receipt(docs[0], 'accepted'),
  } }), false);
  assert.equal(consentDecisionComplete(health, {}, [health.id], { [health.id]: health.version }), false);
});

test('a signed decline resolves the decision without fabricating authorization', () => {
  const docs = healthBaselineConsentDocuments([PARTICIPATION_CONSENT]);
  const decisions = Object.fromEntries(docs.map(document => [document.id, receipt(document, document.category === 'health_authorization' ? 'declined' : 'accepted')]));
  assert.equal(hasCompletedRequiredConsents({ requiredConsents: docs, consentDecisions: decisions }), true);
  assert.equal(decisions[HEALTH_CONSENT.id].decision, 'declined');
});

test('custom health terms are preserved and the opt-out removes only health requirements', () => {
  const custom = { ...HEALTH_CONSENT, id: 'custom-health', version: 'v3', body: 'Approved custom health authorization.' };
  const docs = [PARTICIPATION_CONSENT, custom, RESEARCH_CONSENT, STAFF_CONSENT];
  const before = JSON.stringify(docs);
  assert.deepEqual(healthBaselineConsentDocuments(docs), docs);
  assert.deepEqual(healthBaselineConsentDocuments(docs, { healthBaselineEnabled: false }), [PARTICIPATION_CONSENT, RESEARCH_CONSENT, STAFF_CONSENT]);
  assert.equal(JSON.stringify(docs), before);
});

test('atomic server terms and client terms agree on defaults, overrides, and research separation', () => {
  const team = { requiredConsents: [PARTICIPATION_CONSENT], healthBaselineEnabled: false };
  const pilot = { studyMode: 'research', requiredConsents: [RESEARCH_CONSENT] };
  const disabled = resolveAtomicConsentDocuments(team, pilot, 'athleticmind', {});
  assert.deepEqual(disabled.map(document => document.category), ['participation', 'research']);
  const enabled = resolveAtomicConsentDocuments({ ...team, healthBaselineEnabled: true }, pilot, 'pulsecheck', { healthBaselineEnabled: false });
  assert.equal(enabled.filter(document => document.category === 'health_authorization').length, 1);
  assert.ok(enabled.some(document => document.category === 'research'));
  assert.equal(enabled.find(document => document.category === 'health_authorization')?.version, 'v1-pulsecheck');
  assert.equal(resolveAtomicConsentDocuments({ requiredConsents: [PARTICIPATION_CONSENT] }, {}, 'athleticmind', { healthBaselineEnabled: false }).some(document => document.category === 'health_authorization'), false);
});
