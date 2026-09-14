import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

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
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
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
