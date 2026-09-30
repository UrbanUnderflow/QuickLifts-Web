import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveEquityPlanPacket} from '../../src/lib/equityPlanPacket';

const original = {id: 'original', title: 'Equity Incentive Plan', documentType: 'eip', status: 'completed', autoSigned: true, content: 'Full original plan'};
const amendment = {id: 'amendment', title: 'Reserve Amendment', documentType: 'eip', status: 'completed', approvalStatus: 'approved', effectiveAt: '2026-09-01', originalDocumentId: original.id, content: 'Amends the reserve only', isAmendment: true};

test('an effective amendment includes the full original EIP before the amendment', () => {
  const result = resolveEquityPlanPacket([amendment, original]);
  assert.deepEqual(result.documents.map(document => document.id), ['original', 'amendment']);
  assert.deepEqual(result.issues, []);
});
test('draft text conflicting with approved metadata blocks a new send and retains the full plan for review', () => {
  const result = resolveEquityPlanPacket([original, {...amendment, content: '**DRAFT FOR REVIEW. UNSIGNED AND NOT EFFECTIVE.**'}]);
  assert.deepEqual(result.documents.map(document => document.id), ['original']);
  assert.match(result.issues.join(' '), /conflicts with draft wording/);
});
test('a draft title cannot be sent as an approved amendment', () => {
  assert.match(resolveEquityPlanPacket([original, {...amendment, title: 'Reserve Amendment (Draft)'}]).issues.join(' '), /conflicts with draft wording/);
});
test('pending amendments do not replace the effective full plan', () => {
  const result = resolveEquityPlanPacket([original, {...amendment, approvalStatus: 'draft'}]);
  assert.deepEqual(result.documents.map(document => document.id), ['original']);
  assert.deepEqual(result.issues, []);
});
test('missing or archived original plans block sending an amendment alone', () => {
  assert.match(resolveEquityPlanPacket([amendment]).issues.join(' '), /source document is missing/);
  assert.match(resolveEquityPlanPacket([amendment, {...original, archivedFromEquity: true}]).issues.join(' '), /source document is missing/);
});
test('source chains include intervening amendments once and detect cycles', () => {
  const later = {...amendment, id: 'later', sourceDocumentId: amendment.id, effectiveAt: '2026-09-20'};
  const result = resolveEquityPlanPacket([original, amendment, later]);
  assert.deepEqual(result.documents.map(document => document.id), ['original', 'amendment', 'later']);
  assert.deepEqual(result.issues, []);
  assert.match(resolveEquityPlanPacket([original, {...amendment, sourceDocumentId: 'amendment'}]).issues.join(' '), /cycle/);
});
