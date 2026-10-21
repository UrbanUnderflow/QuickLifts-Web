const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/features/PipeListsWorkspace.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let memo;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'inviteHistory') memo = node.initializer;
  ts.forEachChild(node, visit);
}
visit(ast);
const code = ts.transpileModule(`result = (${memo.arguments[0].getText(ast)})();`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const list = (id, name = id) => ({ id, name, accent: 'blue' });
const share = (id, email = 'member@example.com') => ({
  id: `share-${id}`, list: list(id, `Old ${id}`), viewerEmails: [email], editorEmails: [], inviteStatuses: {},
});
function history(lists, ownerShareDocs, shareDoc = null) {
  const context = { lists, ownerShareDocs, shareDoc, searchableProfiles: [] };
  vm.runInNewContext(code, context);
  return JSON.parse(JSON.stringify(context.result));
}

test('deleted lists are excluded from members and pending invitations', () => {
  const deleted = share('deleted', 'pending@example.com');
  deleted.inviteStatuses = { 'pending@example.com': { email: 'pending@example.com', status: 'sent', access: 'read' } };
  const rows = history([list('retained')], [share('retained'), share('deleted'), deleted]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].listNames, ['retained']);
  assert.equal(rows[0].status, 'accepted');
});

test('the active share fallback cannot resurrect a deleted list', () => {
  assert.deepEqual(history([], [], share('deleted')), []);
});

test('current list identity wins over stale sharing metadata and access remains intact', () => {
  const shared = share('retained');
  shared.editorEmails = ['member@example.com'];
  const rows = history([{ ...list('retained', 'Renamed list'), accent: 'green' }], [shared]);
  assert.equal(rows[0].listAccess[0].listName, 'Renamed list');
  assert.equal(rows[0].listAccess[0].accent, 'green');
  assert.equal(rows[0].listAccess[0].access, 'edit');
  assert.equal(rows[0].listAccess[0].shareId, 'share-retained');
});

test('list changes invalidate collaborator history without requiring a share update', () => {
  assert.match(memo.arguments[1].getText(ast), /\blists\b/);
  const shares = [share('first'), share('second')];
  assert.equal(history([list('first'), list('second')], shares)[0].listAccess.length, 2);
  assert.equal(history([list('first')], shares)[0].listAccess.length, 1);
});
