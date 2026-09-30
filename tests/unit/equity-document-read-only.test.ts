import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {resolveEquityPlanPacket} from '../../src/lib/equityPlanPacket';
import {renderToStaticMarkup} from 'react-dom/server';

const source = readFileSync(new URL('../../src/pages/admin/equity.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('equity.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// Execute the actual UI callbacks with only read capabilities available. Any
// attempted generation, grant update, or document write fails these tests.
function callback(name: string, bindings: Record<string, unknown>) {
  let expression: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(expression, `Missing callback ${name}`);
  const js = ts.transpileModule(`const callback = ${expression.getText(tree)}; callback;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  return vm.runInNewContext(js, bindings);
}

test('Preview only opens the saved document, including for an auto-executed EIP', () => {
  const calls: unknown[][] = [];
  const preview = callback('handlePreviewEquityDoc', {
    window: { open: (...args: unknown[]) => calls.push(args) },
    encodeURIComponent,
  });
  const document = Object.freeze({ id: 'eip /1', documentType: 'eip', autoSigned: true, content: 'Approved original' });
  preview(document);
  assert.deepEqual(calls, [['/equity-doc/eip%20%2F1', '_blank', 'noopener,noreferrer']]);
  assert.equal(document.content, 'Approved original');
});

for (const documentType of ['eip', 'board_consent', 'stockholder_consent', 'advisor_nso_agreement']) {
  test(`signing preparation reads the stored ${documentType} without regeneration`, async () => {
    const saved = Object.freeze({ documentType, content: 'Existing approved terms', autoSigned: true });
    const states: unknown[] = [];
    const reads: unknown[] = [];
    const load = callback('loadSavedEquityDocument', {
      preparingSigningDocId: null,
      setPreparingSigningDocId: (id: unknown) => states.push(id),
      setMessage: () => assert.fail('Unexpected error'),
      db: 'database',
      doc: (...args: unknown[]) => args,
      getDoc: async (reference: unknown) => {
        reads.push(reference);
        return { exists: () => true, id: 'document-1', data: () => saved };
      },
    });
    const result = await load({ id: 'document-1', content: 'Stale local copy' });
    assert.equal(result.content, 'Existing approved terms');
    assert.equal(result.autoSigned, true);
    assert.equal(reads.length, 1);
    assert.deepEqual(states, ['document-1', null]);
  });
}

test('a missing saved document fails instead of generating a replacement', async () => {
  const states: unknown[] = [];
  const load = callback('loadSavedEquityDocument', {
    preparingSigningDocId: null,
    setPreparingSigningDocId: (id: unknown) => states.push(id),
    setMessage: () => {}, db: {}, doc: () => ({}),
    getDoc: async () => ({ exists: () => false }),
  });
  await assert.rejects(load({ id: 'missing' }), /could not be found/);
  assert.deepEqual(states, ['missing', null]);
});

test('company-document regeneration is invoked only by explicit document revision', () => {
  const callers: string[] = [];
  function visit(node: ts.Node, owner = '') {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer)) owner = node.name.getText(tree);
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'regenerateCompanyApprovalDocCleanly') callers.push(owner);
    ts.forEachChild(node, child => visit(child, owner));
  }
  visit(tree);
  assert.deepEqual(callers, ['handleReviseEquityDoc']);
});

for (const name of ['Valerie Alexander', 'Marques Zak']) {
  test(`${name} package exposes references and resend without sending on open`, () => {
    const document = {id: 'agreement', title: `Advisor Agreement - ${name}`, content: 'Approved terms', signingRequestIds: ['current']};
    const references = [{id: 'eip', title: 'Equity Incentive Plan', url: '/equity-doc/eip'}, {id: 'board', title: `Board Consent - ${name}`, url: '/equity-doc/board'}];
    const render = callback('renderPartySigningPackage', {
      React, X: () => null, partyPackage: {name},
      getLatestRelevantDocuments: (documents: unknown) => documents,
      getAllocationDocuments: () => [document], requiresExternalSignature: () => true,
      signingRequests: [{id: 'current', recipientName: name, recipientEmail: 'advisor@example.com', documentContent: document.content, supportingDocuments: references}],
      getSignaturePacketDocuments: () => references, getMissingSignaturePacketRequirements: () => [],
      getEquityDocSignatureState: () => ({hasRecordedSignatures: false}), preparingSigningDocId: null,
      resendExistingSignatureRequest: () => assert.fail('Opening must not send'),
    });
    const html = renderToStaticMarkup(render());
    assert.match(html, /Signing document/);
    assert.match(html, /Equity Incentive Plan/);
    assert.match(html, /Board Consent/);
    assert.match(html, /Resend email/);
    assert.match(html, /Open signing link/);
    assert.match(html, /Prepare new request with current references/);
  });
}

test('resend confirmation lists the saved references and preserves the existing request', async () => {
  let confirmation: any;
  const resend = callback('resendExistingSignatureRequest', {
    signingRequests: [], emailDeliveryIsUnconfirmed: () => false,
    setConfirmationError: () => {}, setResendRequestId: () => {},
    setPendingEmailConfirmation: (value: unknown) => {confirmation = value;},
    crypto: {randomUUID: () => 'retry'},
  });
  await resend({id: 'original', documentName: 'Advisor agreement', recipientName: 'Valerie Alexander', recipientEmail: 'advisor@example.com', supportingDocuments: [{title: 'Original EIP'}, {title: 'Valerie Board Consent'}]});
  assert.deepEqual(Array.from(confirmation.documents), ['Advisor agreement', 'Original EIP (reference)', 'Valerie Board Consent (reference)']);
  assert.equal(confirmation.deliveries[0].documentId, 'original');
  assert.equal(confirmation.deliveries[0].recipientEmail, 'advisor@example.com');
});


test('package dialog closes from its visible button, Escape, and backdrop only', () => {
  let closes = 0;
  const render = callback('renderPartySigningPackage', {
    React, X: () => null, partyPackage: {name: 'Valerie Alexander'},
    getLatestRelevantDocuments: (documents: unknown) => documents,
    getAllocationDocuments: () => [], requiresExternalSignature: () => true,
    setPartyPackage: (value: unknown) => {assert.equal(value, null); closes++;},
  });
  const element = render();
  function findClose(node: any): any {
    if (!node || typeof node !== 'object') return undefined;
    if (node.props?.['aria-label'] === 'Close signing package') return node;
    return React.Children.toArray(node.props?.children).map(findClose).find(Boolean);
  }
  const close = findClose(element);
  assert.ok(close.props.className.includes('text-white'));
  assert.ok(React.Children.toArray(close.props.children).includes('Close'));
  close.props.onClick();
  element.props.onKeyDown({key: 'Escape', stopPropagation: () => {}});
  element.props.onClick({target: 'backdrop', currentTarget: 'backdrop'});
  element.props.onClick({target: 'content', currentTarget: 'backdrop'});
  assert.equal(closes, 3);
});

test('actual packet callback includes the base EIP and does not re-add a conflicting draft from exhibits', () => {
  const original = {id: 'base', documentType: 'eip', title: 'Full EIP', content: 'Full plan terms', status: 'completed', autoSigned: true};
  const draft = {...original, id: 'draft', originalDocumentId: 'base', title: 'Amendment (Draft)', approvalStatus: 'approved', effectiveAt: '2026-09-01'};
  const packet = callback('getSignaturePacketDocuments', {
    resolveEquityPlanPacket, equityDocuments: [original, draft], stakeholders: [],
    isSendableEquityDocument: () => true, requiresEquityReviewPacket: () => true,
    getExhibitDocuments: () => [draft], window: {location: {origin: 'https://example.com'}},
  });
  assert.deepEqual(Array.from(packet({id: 'award'}), (document: any) => document.id), ['base']);
});
