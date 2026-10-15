const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('src/features/PipeListsWorkspace.tsx', 'utf8');
function loadUtility(file, mocks = {}) { const module = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module, exports: module.exports, require: name => mocks[name] || require(name) }); return module.exports; }
const collaboration = loadUtility('src/utils/pipelistsCollaboration.ts');
const { preserveStoredUniversityList } = loadUtility('src/utils/pipelistsPersistence.ts', { './pipelistsCollaboration': collaboration });
const ast = ts.createSourceFile('workspace.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['collaboratorSafePipeListSnapshot', 'publicSafePipeListSnapshot', 'persistCollaborativePipeList'];
const declarations = ast.statements.filter(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => names.includes(declaration.name.getText(ast)))).map(statement => statement.getText(ast)).join('\n');
const normalize = list => ({ ...list, stages: list.stages.some(stage => stage.id === 'call-attempted') ? list.stages : [...list.stages, { id: 'call-attempted' }], items: list.items.map(item => ({ ...item, notes: item.notes || '', weeklyLogs: item.weeklyLogs || [] })) });
async function persist(changed) {
  const raw = { id: 'synthetic-list', templateKey: 'university-pilot', stages: [{ id: 'cold-email-sent', label: 'Custom label' }], items: [{ id: 'synthetic-lead', stage: 'cold-email-sent', customerSuccess: { linkage: { organizationId: 'synthetic-existing-link', teamId: '', pilotId: '', customerAccountId: '' } } }] };
  const view = normalize(raw); const local = structuredClone(view); if (changed) local.items[0].notes = 'Explicit synthetic edit';
  const writes = [];
  const scope = { ...collaboration, preserveStoredUniversityList, normalizeList: normalize, pipeListRequiresAccountAccess: () => true, simpBudgetDb: {}, PIPELIST_PROTECTED_SHARES_COLLECTION: 'protected', PIPELIST_SHARES_COLLECTION: 'public', doc: (_db, kind, id) => `${kind}/${id}`, purgeExpiredDeletedItems: value => value, reconcilePipeListSnapshotsForWrite: (remote, local, base) => collaboration.mergePipeListSnapshotsThreeWay(base, remote, local), runPipeListSaveWithRetry: save => save(), runTransaction: async (_db, callback) => callback({ get: async () => ({ exists: () => true, data: () => ({ ownerUid: 'owner', protectedDetails: true, list: raw }) }), set: (ref, data) => writes.push({ ref, data }) }), serverTimestamp: () => 'synthetic-time', stripUndefined: value => value, deleteField: () => 'deleted-field' };
  const fn = new Function(...Object.keys(scope), ts.transpile(declarations + '\nreturn persistCollaborativePipeList;'))(...Object.values(scope));
  const result = await fn({ shareId: 'owner-synthetic-list', ownerUid: 'owner', ownerEmail: 'owner@example.test', actor: { uid: 'owner' }, list: local, baseList: view, protectedDetails: true });
  return { writes, result, raw };
}
test('shared owner/collaborator normalization does not write an unchanged legacy university list', async () => { const result = await persist(false); assert.equal(result.writes.length, 0); });
test('shared edit preserves raw missing history and stages while public projection and returned view remain safe', async () => {
  const { writes, result, raw } = await persist(true); assert.equal(writes.length, 2);
  const saved = writes.find(write => write.ref.startsWith('protected/')).data.list;
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), { ...raw, items: [{ ...raw.items[0], notes: 'Explicit synthetic edit' }] });
  assert.equal(writes.find(write => write.ref.startsWith('public/')).data.list.items[0].weeklyLogs, undefined);
  assert.deepEqual(result.items[0].weeklyLogs, []); assert.equal(result.stages.length, 2);
});
