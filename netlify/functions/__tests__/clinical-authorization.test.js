const test = require('node:test');
const assert = require('node:assert/strict');
const { clinicalAuthorizationAllowsTransfer: allowed } = require('../lib/clinical-authorization');
const documents = [{ id: 'health', category: 'health_authorization', version: 'v2', body: 'Terms' }];
const accepted = { health: { decision: 'accepted', version: 'v2', signedName: 'Athlete', document: documents[0] } };
test('current signed authorization permits routine handoff', () => assert.equal(allowed({ documents, decisions: accepted }), true));
test('missing declined revoked expired and stale authorizations block routine transfer', () => {
 for (const entry of [undefined, { ...accepted.health, decision: 'declined' }, { ...accepted.health, decision: 'revoked' }, { ...accepted.health, version: 'v1' }, { ...accepted.health, expiresAt: '2020-01-01' }]) {
  assert.equal(allowed({ documents, decisions: { health: entry } }), false);
 }
 assert.equal(allowed({ documents, decisions: accepted, participationEnded: true }), false);
});
test('urgent safety uses its separate basis; legacy deployments retain existing workflow', () => {
 assert.equal(allowed({ documents, tier: 3 }), true);
 assert.equal(allowed({ documents: [] }), true);
});
