import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../../src/pages/PipeLists.tsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const handleSaveItem ='), source.indexOf('  const clearKanbanDrag ='));
const original = { id: 'lead', title: 'Original', organization: 'Organization', contactEmails: [], notes: '', weeklyLogs: [{ id: 'history' }], attachments: [{ id: 'attachment' }], createdAt: '2026-01-01', updatedAt: '2026-01-01' };

function save({ missing = false, deleted = false, missingList = false, email = '', title = 'Edited', permission = true } = {}) {
  const item = { ...original, ...(deleted ? { deletedAt: '2026-09-21' } : {}) };
  let lists = missingList ? [] : [{ id: 'list', templateKey: 'vc', items: missing ? [] : [item] }];
  let error = '';
  let closed = false;
  const scope = {
    lists, activeList: { id: 'list', templateKey: 'vc', items: [item] },
    detailSnapshotRef: { current: { list: { id: 'list' }, item } },
    canModify: permission, editingItemId: 'lead', itemResearchResult: null,
    draft: { ...original, title, organization: title ? 'Organization' : '' }, contactEmailInput: email,
    setItemSaveError: (value: string) => { error = value; },
    isValidContactEmail: (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
    setContactEmailError: () => {}, contactNameFromEmail: () => '',
    isContactListActive: false, cleanDealNotes: (value: string) => value,
    normalizeDeadlineSourceForSave: () => '', setContactEmailInput: () => {},
    setLists: (update: (current: typeof lists) => typeof lists) => { lists = update(lists); },
    resetEditor: () => { closed = true; },
  };
  new Function(...Object.keys(scope), ts.transpile(handler + '\nhandleSaveItem({preventDefault() {}});', { target: ts.ScriptTarget.ES2020 }))(...Object.values(scope));
  return { lists, error, closed };
}

test('Save restores a temporarily missing lead from the open editor and retains its history', () => {
  const result = save({ missing: true });
  assert.equal(result.closed, true);
  assert.equal(result.error, '');
  assert.equal(result.lists[0].items.length, 1);
  assert.equal(result.lists[0].items[0].title, 'Edited');
  assert.deepEqual(result.lists[0].items[0].weeklyLogs, original.weeklyLogs);
  assert.deepEqual(result.lists[0].items[0].attachments, original.attachments);
  assert.equal(result.lists[0].items[0].createdAt, original.createdAt);
});

test('Save updates an existing lead without duplicating it', () => {
  const result = save();
  assert.equal(result.lists[0].items.length, 1);
  assert.equal(result.lists[0].items[0].title, 'Edited');
  assert.equal(result.closed, true);
});

for (const [label, options] of Object.entries({
  'deleted lead': { deleted: true },
  'missing list': { missingList: true },
  'invalid email': { email: 'unfinished@' },
  'missing name': { title: '' },
  'lost permission': { permission: false },
})) {
  test(`Save preserves the draft and explains ${label}`, () => {
    const result = save(options);
    assert.equal(result.closed, false);
    assert.notEqual(result.error, '');
    if (result.lists.length) assert.equal(result.lists[0].items[0].title, original.title);
  });
}
