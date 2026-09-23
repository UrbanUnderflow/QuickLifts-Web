import test from 'node:test';
import assert from 'node:assert/strict';
import { isOutgoingEquityWorkspaceDocument, isSendableEquityDocument } from '../../src/lib/equityDocumentScope';
test('PIL issuance keeps equity reference readable but excludes operational copies from sending', () => {
  for (const title of ['01 PIL and AuntEdna | Strategic Partnership and Integration Agreement', '02 PIL and AuntEdna | Exhibit A Data Architecture and System Boundaries', '03 PIL and AuntEdna | Exhibit B Performance Standards and Service Levels']) {
    assert.equal(isOutgoingEquityWorkspaceDocument({title}), false);
    assert.equal(isSendableEquityDocument({title}), false);
  }
  const reference = {title: '04 PIL and AuntEdna | Reciprocal Strategic Equity Side Letter'};
  assert.equal(isOutgoingEquityWorkspaceDocument(reference), true);
  assert.equal(isSendableEquityDocument(reference), false);
  assert.equal(isSendableEquityDocument({title: '07 PIL and AuntEdna | PIL Warrant to AuntEdna'}), true);
  assert.equal(isSendableEquityDocument({title: '05 PIL and AuntEdna | PIL Board Consent Strategic Equity'}), true);
});

import { documentMatchesAllocation } from '../../src/lib/equityDocumentScope';
test('separate instruments for the same recipient while retaining shared supporting documents', () => {
  const warrant = {title: '07 PIL and AuntEdna | PIL Warrant to AuntEdna'};
  assert.equal(documentMatchesAllocation(warrant, 'vesting_shares'), false);
  assert.equal(documentMatchesAllocation(warrant, 'warrant'), true);
  const equity = {title: 'PIL Equity Agreement to AuntEdna'};
  assert.equal(documentMatchesAllocation(equity, 'vesting_shares'), true);
  assert.equal(documentMatchesAllocation(equity, 'warrant'), false);
  assert.equal(documentMatchesAllocation({title:'PIL Board Consent Strategic Equity'}, 'vesting_shares'), true);
  assert.equal(documentMatchesAllocation({title:'Reciprocal Strategic Equity Side Letter'}, 'vesting_shares'), true);
  assert.equal(documentMatchesAllocation({title:'Other', allocationKind:'vesting_shares'}, 'warrant'), false);
  assert.equal(documentMatchesAllocation({title:'Other'}, 'vesting_shares'), false);
  assert.equal(documentMatchesAllocation(warrant), true);
  const buyback = {title:'PIL and EDNA Reciprocal Share-Award Buyback Agreement', documentType:'strategic_reciprocal_buyback_agreement'};
  assert.equal(documentMatchesAllocation(buyback, 'vesting_shares'), true);
  assert.equal(documentMatchesAllocation(buyback, 'warrant'), false);
  assert.equal(isSendableEquityDocument({...buyback, requiresSignature:true}), true);
});
