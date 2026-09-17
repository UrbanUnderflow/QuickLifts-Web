const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/pages/PipeLists.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'updateCollaboratorListAccess') handler = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(`run = ${handler}`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
async function update(current, access, overrides = {}) {
  let saved;
  let message;
  const states = [];
  const context = {
    user: { uid: 'owner' }, isOwner: true, isSharedView: false, ownerSharesReady: true, savingListAccess: '',
    simpBudgetDb: {}, PIPELIST_SHARES_COLLECTION: 'shares',
    doc: (_db, _collection, id) => id,
    setSavingListAccess: (value) => states.push(value), setShareMessage: (value) => { message = value; },
    serverTimestamp: () => 'now', readFirestoreError: (error) => error.message,
    runTransaction: async (_db, callback) => callback({ get: async () => ({ exists: () => true, data: () => current }), update: (id, value) => { saved = { id, ...value }; } }),
    ...overrides,
  };
  vm.runInNewContext(code, context);
  await context.run({ email: 'member@example.com', displayName: 'Member' }, { shareId: 'target-list', listName: 'UMES', access: access === 'edit' ? 'read' : 'edit', status: 'accepted' }, access);
  return { saved, message, states };
}
const current = () => ({ ownerUid: 'owner', viewerEmails: ['member@example.com', 'viewer@example.com'], editorEmails: ['editor@example.com'], inviteStatuses: { 'member@example.com': { status: 'accepted', acceptedAt: 'original' }, 'viewer@example.com': { status: 'sent' } } });
test('upgrading one list preserves other people and invitation history', async () => {
  const { saved, message, states } = await update(current(), 'edit');
  assert.equal(saved.id, 'target-list');
  assert.deepEqual(Array.from(saved.viewerEmails), ['viewer@example.com']);
  assert.deepEqual(Array.from(saved.editorEmails), ['editor@example.com', 'member@example.com']);
  assert.equal(saved.inviteStatuses['member@example.com'].acceptedAt, 'original');
  assert.equal(saved.inviteStatuses['viewer@example.com'].status, 'sent');
  assert.equal(saved.list, undefined);
  assert.equal(saved.publicRead, undefined);
  assert.equal(message.type, 'success');
  assert.equal(states.at(-1), '');
});
test('downgrading removes edit access and keeps other editors', async () => {
  const data = current(); data.viewerEmails = ['viewer@example.com']; data.editorEmails.push('member@example.com');
  const { saved } = await update(data, 'read');
  assert.deepEqual(Array.from(saved.editorEmails), ['editor@example.com']);
  assert.ok(saved.viewerEmails.includes('member@example.com'));
  assert.equal(saved.inviteStatuses['member@example.com'].access, 'read');
});
test('revoked membership and ownership changes cannot be overwritten', async () => {
  for (const data of [{ ...current(), ownerUid: 'another-owner' }, { ...current(), viewerEmails: [] }]) {
    const result = await update(data, 'edit');
    assert.equal(result.saved, undefined);
    assert.equal(result.message.type, 'error');
    assert.equal(result.states.at(-1), '');
  }
});
test('server failures surface an error and release the saving state', async () => {
  const result = await update(current(), 'edit', { runTransaction: async () => { throw new Error('Offline'); } });
  assert.equal(result.saved, undefined);
  assert.equal(result.message.text, 'Offline');
  assert.equal(result.states.at(-1), '');
});
