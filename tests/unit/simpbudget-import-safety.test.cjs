'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/pages/SimpBudget.tsx', 'utf8');
const autoStart = source.indexOf('    // Empty initial state');
const autoEffect = source.slice(autoStart, source.indexOf('\n  }, [', autoStart));
function autoImport(overrides = {}) {
  let calls = 0;
  const deps = { user: { uid: 'owner' }, loadedUserId: null, isMigrationOwner: true,
    sourceConnected: true, loadingData: false, migrating: false, spaces: [], records: [],
    autoMigrationAttemptedRef: { current: false }, migrateFounderBudgetData: () => calls++, ...overrides };
  const run = new Function(...Object.keys(deps), autoEffect);
  run(...Object.values(deps));
  run(...Object.values(deps));
  return calls;
}
test('automatic import waits for successful current-user data, including profile-write gap and failed loads', () => {
  assert.equal(autoImport(), 0);
  assert.equal(autoImport({ loadedUserId: 'previous-user' }), 0);
  assert.equal(autoImport({ loadedUserId: 'owner', loadingData: true }), 0);
});
test('loaded existing spaces or months are never automatically reimported', () => {
  assert.equal(autoImport({ loadedUserId: 'owner', spaces: [{ name: 'Pulse' }] }), 0);
  assert.equal(autoImport({ loadedUserId: 'owner', records: [{ monthlyIncome: 123 }] }), 0);
});
test('a successfully loaded empty account can automatically import once', () => {
  assert.equal(autoImport({ loadedUserId: 'owner' }), 1);
});
const migrationStart = source.indexOf('      const scopes = Array.from');
const migrationEnd = source.indexOf('\n      await Promise.all(\n        sourceRecords', migrationStart);
const createSpaces = ts.transpile(source.slice(migrationStart, migrationEnd));
async function importSpaces(initial) {
  const data = structuredClone(initial);
  let writes = 0;
  const deps = { sourceRecords: [{ scope: 'business' }, { scope: 'personal' }], simpBudgetDb: {},
    user: { uid: 'owner', email: 'owner@example.com' }, budgetSpacesCollectionRef: uid => uid,
    doc: (collection, id) => id, serverTimestamp: () => 'timestamp',
    runTransaction: async (_, fn) => fn({
      get: async id => ({ exists: () => Object.hasOwn(data, id) }),
      set: (id, value) => { data[id] = value; writes++; },
    }) };
  await new Function(...Object.keys(deps), `return (async () => {${createSpaces}})();`)(...Object.values(deps));
  return { data, writes };
}
test('reimport preserves renamed and customized spaces, including original creation timestamp', async () => {
  const pulse = { name: 'Pulse', status: 'archived', color: '#123456', sortOrder: 99, createdAt: 'original' };
  const result = await importSpaces({ business: pulse });
  assert.deepEqual(result.data.business, pulse);
  assert.equal(result.writes, 1);
  assert.equal(result.data.personal.name, 'Personal');
});
test('first import creates defaults, subsequent imports write no space metadata', async () => {
  const first = await importSpaces({});
  assert.equal(first.writes, 2);
  const again = await importSpaces(first.data);
  assert.equal(again.writes, 0);
  assert.deepEqual(again.data, first.data);
});
const renameStart = source.indexOf('  const renameBudgetSpace =');
const renameCode = ts.transpile(source.slice(renameStart, source.indexOf('  const migrateFounderBudgetData =', renameStart)) + '\nreturn renameBudgetSpace;');
function renameApp(answer, fail = false) {
  const writes = [], messages = [];
  let spaces = [{ id: 'business', name: 'Business', color: 'blue' }, { id: 'personal', name: 'Personal' }];
  const deps = { user: { uid: 'owner' }, renameTarget: answer === null ? null : { ...spaces[0], uid: 'owner' }, renameName: answer || '', renameInFlightRef: { current: false },
    setRenameTarget: () => {}, setRenameError: () => {}, setRenaming: () => {},
    updateDoc: async (ref, value) => { if (fail) throw new Error('offline'); writes.push({ ref, value }); },
    doc: (collection, id) => `${collection}/${id}`, budgetSpacesCollectionRef: uid => `${uid}/budgetSpaces`,
    serverTimestamp: () => 'timestamp', setSpaces: update => { spaces = update(spaces); },
    setAppMessage: message => messages.push(message), readFirestoreError: (_, fallback) => fallback,
  };
  const run = new Function(...Object.keys(deps), renameCode)(...Object.values(deps));
  return { run, writes, messages, get spaces() { return spaces; } };
}
test('rename updates only name and timestamp on the original space, not months or draft', async () => {
  const app = renameApp('  Pulse  ');
  await Promise.all([app.run(), app.run()]);
  assert.deepEqual(app.writes, [{ ref: 'owner/budgetSpaces/business', value: { name: 'Pulse', updatedAt: 'timestamp' } }]);
  assert.equal(app.spaces[0].name, 'Pulse');
  assert.equal(app.spaces[0].color, 'blue');
  assert.equal(app.spaces[1].name, 'Personal');
});
test('cancel, blank, and unchanged rename perform no writes', async () => {
  for (const answer of [null, '', '   ', 'Business']) {
    const app = renameApp(answer); await app.run();
    assert.equal(app.writes.length, 0);
    assert.equal(app.spaces[0].name, 'Business');
  }
});
test('failed rename retains original name and releases the retry lock', async () => {
  const app = renameApp('Pulse', true);
  await app.run(); await app.run();
  assert.equal(app.spaces[0].name, 'Business');
  assert.equal(app.messages.length, 2);
  assert.equal(app.messages[0].type, 'error');
});
