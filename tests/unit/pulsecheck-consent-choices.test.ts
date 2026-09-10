import test from 'node:test';
import assert from 'node:assert/strict';
import { consentDecisionComplete, HEALTH_CONSENT, RESEARCH_CONSENT, PARTICIPATION_CONSENT, researchEligible, type ConsentDecisions } from '../../src/api/firebase/pulsecheckProvisioning/consentPolicy';
import { hasCompletedRequiredConsents } from '../../src/api/firebase/pulsecheckProvisioning/accessState';
import { getDefaultPulseCheckRequiredConsents } from '../../src/api/firebase/pulsecheckProvisioning/types';
const receipt = (doc: typeof HEALTH_CONSENT, decision: 'accepted' | 'declined' | 'revoked') => ({ decision, version: doc.version, signedName: 'Test Athlete', decidedAt: new Date().toISOString(), document: doc });
test('declining optional health and research preserves participation access without marking either accepted', () => {
 const docs = [PARTICIPATION_CONSENT, HEALTH_CONSENT, RESEARCH_CONSENT];
 const consentDecisions: ConsentDecisions = Object.fromEntries(docs.map(doc => [doc.id, receipt(doc, doc.category === 'participation' ? 'accepted' : 'declined')]));
 assert.equal(hasCompletedRequiredConsents({ requiredConsents: docs, consentDecisions, completedConsentIds: [PARTICIPATION_CONSENT.id] }), true);
 assert.equal(researchEligible(docs, consentDecisions, 'declined'), false);
});
test('a new authorization version requires a fresh decision even after decline', () => {
 assert.equal(consentDecisionComplete({ ...HEALTH_CONSENT, version: 'v2' }, { [HEALTH_CONSENT.id]: receipt(HEALTH_CONSENT, 'declined') }), false);
});
test('legacy accepted IDs cannot fabricate health authorization', () => {
 assert.equal(consentDecisionComplete(HEALTH_CONSENT, {}, [HEALTH_CONSENT.id], { [HEALTH_CONSENT.id]: HEALTH_CONSENT.version }), false);
});
test('research willingness alone is never dataset eligibility', () => {
 const decisions = { [RESEARCH_CONSENT.id]: receipt(RESEARCH_CONSENT, 'accepted') };
 assert.equal(researchEligible([RESEARCH_CONSENT], decisions, 'accepted'), false);
 const study = { ...RESEARCH_CONSENT, id: 'approved-study-1', studySpecific: true };
 assert.equal(researchEligible([study], { [study.id]: receipt(study, 'accepted') }, 'accepted'), true);
});
test('default categories are independent and staff has its own terms', () => {
 assert.deepEqual(getDefaultPulseCheckRequiredConsents('research').map(d => d.category), ['participation', 'health_authorization', 'research', 'staff']);
});
