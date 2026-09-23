import test from 'node:test';
import assert from 'node:assert/strict';
import {isEquityDocumentLocked} from '../../src/lib/equityDocumentUpload';

test('any approval or signing evidence locks replacement, including a prepared unsent request', () => {
  for (const evidence of [
    {signingRequestId: 'pending'}, {signingRequestIds: ['pending']}, {signedAt: '2026-09-23'},
    {autoSigned: true}, {autoSignedAt: '2026-09-23'}, {signatureData: {typedName: 'Tremaine Grant'}},
    {approvalStatus: 'approved'},
  ]) assert.equal(isEquityDocumentLocked(evidence), true);
  assert.equal(isEquityDocumentLocked({approvalStatus: 'pending', signingRequestIds: [], autoSigned: false}), false);
  assert.equal(isEquityDocumentLocked(undefined), false);
});

