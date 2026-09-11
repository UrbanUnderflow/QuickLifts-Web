import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../../src/pages/PipeLists.tsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const handleApplyItemResearch ='), source.indexOf('  const openEmailActivityForItem ='));

test('applying research commits the editor draft and findings together and closes the stale editor', () => {
  const item = { id: 'penn', title: 'Penn State', organization: '', notes: '', contactEmails: [], weeklyLogs: [{ id: 'original' }], stage: 'identified' };
  let lists = [{ id: 'universities', items: [item] }];
  let editorClosed = false;
  let cleared = false;
  const scope = {
    canModify: true, selectedDetailItem: item,
    itemResearchResult: { title: 'Penn State', organization: 'Penn State Athletics', contactEmails: ['public@example.edu'], notes: 'Research evidence', sourceUrl: 'https://example.edu' },
    isEditorOpen: true, editingItemId: 'penn', draft: { ...item, stage: 'outreach-queued', owner: 'Tremaine', weeklyLogs: undefined },
    contactEmailInput: '', normalizeContactEmails: (value: string[]) => value || [], isValidContactEmail: (v: string) => v.includes('@'),
    cleanDealNotes: (value: string) => value || '', activeList: { id: 'universities', templateKey: 'university-pilot' },
    setLists: (update: Function) => { lists = update(lists); }, defaultLogDraft: () => ({}), makeId: () => 'research-log', itemResearchPrompt: 'Find university information',
    resetEditor: () => { editorClosed = true; }, setDetailModalMode: () => {}, setItemResearchResult: () => { cleared = true; }, setToastMessage: () => {},
  };
  const code = ts.transpile(handler + '\nhandleApplyItemResearch();', { target: ts.ScriptTarget.ES2020 });
  new Function(...Object.keys(scope), code)(...Object.values(scope));
  const saved = JSON.parse(JSON.stringify(lists))[0].items[0];
  assert.equal(saved.organization, 'Penn State Athletics');
  assert.equal(saved.stage, 'outreach-queued');
  assert.equal(saved.owner, 'Tremaine');
  assert.deepEqual(saved.contactEmails, ['public@example.edu']);
  assert.equal(saved.weeklyLogs[0].id, 'research-log');
  assert.equal(saved.weeklyLogs[1].id, 'original');
  assert.equal(editorClosed, true);
  assert.equal(cleared, true);
});
