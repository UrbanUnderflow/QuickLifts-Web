import { normalizeApplicableCompanies } from '../../src/utils/pipelistsCompanies';
import { normalizeLeadTags } from '../../src/utils/pipelistsTags';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyPipeListViewEdits, preserveStoredUniversityList } from '../../src/utils/pipelistsPersistence';
import { mergePipeListSnapshotsThreeWay } from '../../src/utils/pipelistsCollaboration';
const raw = () => ({ id: 'synthetic-university', templateKey: 'university-pilot', stages: [{ id: 'cold-email-sent', label: 'Custom first touch', probability: 7 }], items: [{ id: 'lead-1', stage: 'closed-won', weeklyLogs: [{ id: 'history-1', notes: 'Synthetic prior evidence' }], futureField: 'retain' }, { id: 'archived', stage: 'cold-email-sent', deletedAt: '2020-01-01' }], futureSchema: { keep: true } });
const display = (stored: ReturnType<typeof raw>): any => ({ ...stored, stages: [...stored.stages, { id: 'call-attempted', probability: 15 }], items: stored.items.filter(item => item.id !== 'archived').map(item => ({ ...item, stage: item.stage === 'closed-won' ? 'pilot-active' : item.stage, notes: '', dueDate: '' })), objective: 'display default' });

test('owner and collaborator display-only normalization never changes the stored snapshot', () => {
  for (const role of ['owner', 'collaborator']) {
    const stored = raw(); const viewed = display(stored);
    assert.equal(preserveStoredUniversityList(stored, viewed, structuredClone(viewed)), stored, role);
    assert.equal(stored.items[0].stage, 'closed-won');
    assert.equal(stored.stages.length, 1);
  }
});
test('saving an unrelated list preserves every raw university field and archived record', () => {
  const stored = raw(); const viewed = display(stored);
  const base = [viewed, { id: 'other', templateKey: 'contacts', name: 'Before' }];
  const local = structuredClone(base); local[1].name = 'After';
  const merged = mergePipeListSnapshotsThreeWay(base, base, local);
  const persisted = merged.map((list, index) => index === 0 ? preserveStoredUniversityList(stored, viewed, list) : list);
  assert.deepEqual(persisted[0], stored);
  assert.equal(persisted[1].name, 'After');
});
test('an intentional university field edit does not smuggle display stages, defaults or lost history', () => {
  const stored = raw(); const viewed = display(stored); const edited = structuredClone(viewed);
  edited.items[0].notes = 'Verified manual activity';
  const result: any = applyPipeListViewEdits(stored, viewed, edited);
  assert.deepEqual(result, { ...stored, items: [{ ...stored.items[0], notes: 'Verified manual activity' }, stored.items[1]] });
});
test('concurrent remote changes survive view edits and older-client stages stay stored', () => {
  const stored = raw(); const base = display(stored); const local = structuredClone(base); local.items[0].notes = 'Local edit';
  const current = raw(); current.items[0].futureField = 'Remote edit'; current.stages.push({ id: 'future-review', label: 'Future Review', probability: 22 });
  const remote = display(current);
  const merged = mergePipeListSnapshotsThreeWay(base, remote, local);
  const result: any = applyPipeListViewEdits(current, remote, merged);
  assert.equal(result.items[0].futureField, 'Remote edit');
  assert.equal(result.items[0].notes, 'Local edit');
  assert.deepEqual(result.stages, current.stages);
  assert.equal(result.items[0].stage, 'closed-won');
});
test('workspace load/autosave has no migration trigger and persists view deltas for owner/shared writes', () => {
  const source = fs.readFileSync(new URL('../../src/features/PipeListsWorkspace.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /universityStageMigrationPending|setUniversityStageMigrationPending/);
  assert.equal((source.match(/preserveStoredUniversityList\(/g) || []).length, 3);
  assert.match(source, /if \(pipeListSnapshotsEqual\(remoteLists, mergedLists\)\) \{ savedLists =/);
  assert.doesNotMatch(source, /fetch\([^\n]*stage-migration/);
});

test('editing existing or display-only stages never persists missing IDs or undefined entries', () => {
  const stored = { stages: [{ id: 'identified', label: 'Identified' }] };
  const viewed = { stages: [...stored.stages, { id: 'call-attempted', label: 'Call Attempted', probability: 15 }] };
  const changed = structuredClone(viewed); changed.stages[0].label = 'Custom initial';
  assert.deepEqual(applyPipeListViewEdits(stored, viewed, changed), { stages: [{ id: 'identified', label: 'Custom initial' }] });
  const explicit = structuredClone(viewed); explicit.stages[1].label = 'Explicit custom stage';
  assert.deepEqual(applyPipeListViewEdits(stored, viewed, explicit), { stages: [stored.stages[0], { id: 'call-attempted', label: 'Explicit custom stage', probability: 15 }] });
});

test('actual university normalizer is stable for incomplete legacy items, logs and attachments', async () => {
  const ts = await import('typescript');
  const source = fs.readFileSync(new URL('../../src/features/PipeListsWorkspace.tsx', import.meta.url), 'utf8');
  const stages = source.slice(source.indexOf('const legacyPilotContractStages:'), source.indexOf('const vcStages:'));
  const normalizers = source.slice(source.indexOf('const normalizeStageId ='), source.indexOf('const normalizeShareEmails ='));
  let clock = '2026-01-01T00:00:00Z'; let generated = 0;
  class FakeDate extends Date { constructor(value?: string) { super(value === undefined ? clock : value); } }
  const scope = {
    normalizeApplicableCompanies, normalizeLeadTags,
    Date: FakeDate, makeId: () => `generated-${++generated}`,
    createItem: (_draft: any, id: string) => ({ id }), defaultDraft: (stage: string) => ({ stage }),
    pipeTimestampToDate: (value: any) => value ? new Date(value) : null,
    logTypeLabels: { update: 'Update' }, normalizeContactEmails: (value: any) => value || [],
    normalizeLinkedLeadIds: (value: any) => value || [], normalizeLinkedInProfileUrlForLead: (value: any) => value,
    cleanDealNotes: (value: any) => value || '', normalizeUniversityCustomerSuccess: (value: any) => value,
    defaultListObjective: () => 'Display only', defaultLeadDefinition: () => 'Display only', defaultResearchBriefForList: () => 'Display only', accentClasses: ['stone'], reconcilePipeListStages: (value: any) => value,
  };
  const normalize = new Function(...Object.keys(scope), ts.transpile(stages + "\nconst templateCatalog = {'university-pilot': {defaultName:'University', description:'', stages:pilotContractStages}};\n" + normalizers + '\nreturn normalizeList;'))(...Object.values(scope));
  const stored = { id: 'legacy', templateKey: 'university-pilot', stages: [{ id: 'cold-email-sent', label: 'Cold Email Sent', probability: 15 }], items: [{ id: 'old-lead', stage: 'cold-email-sent', weeklyLogs: [{ summary: 'Original synthetic history' }], attachments: [{ url: 'https://example.com/reference' }] }] };
  assert.deepEqual(normalize(stored, 0).items[0].applicableCompanies, []);
  assert.deepEqual(normalize({ ...stored, items: [{ ...stored.items[0], applicableCompanies: ['PIL', 'ATHLeda'] }] }, 0).items[0].applicableCompanies, ['PIL', 'ATHLeda']);
  const first = normalize(stored, 0); clock = '2027-02-03T01:02:03Z'; const second = normalize(stored, 0);
  assert.deepEqual(second, first);
  assert.deepEqual(preserveStoredUniversityList(stored, first, second), stored);
  second.items[0].notes = 'Explicit verified note';
  const saved: any = preserveStoredUniversityList(stored, first, second);
  assert.deepEqual(saved.items[0].weeklyLogs, stored.items[0].weeklyLogs);
  assert.deepEqual(saved.items[0].attachments, stored.items[0].attachments);
  assert.deepEqual(saved.stages, stored.stages);
});

test('edits to malformed legacy arrays fail closed without persisting display-generated history or stages', () => {
  const stored = { items: [{ stage: 'closed-won', weeklyLogs: [{ summary: 'Prior history' }] }] };
  const viewed = { items: [{ id: 'display-item-0', stage: 'pilot-active', notes: '', weeklyLogs: [{ id: 'display-log-0', summary: 'Prior history', createdAt: '1970-01-01' }] }] };
  assert.deepEqual(applyPipeListViewEdits(stored, viewed, viewed), stored);
  const edited = structuredClone(viewed); edited.items[0].notes = 'Only a note';
  assert.throws(() => applyPipeListViewEdits(stored, viewed, edited), /missing or duplicate record IDs/);
  const identifiedRaw = { items: [{ ...stored.items[0], id: 'lead' }] };
  const identifiedView = { items: [{ ...viewed.items[0], id: 'lead' }] };
  const appended = structuredClone(identifiedView); appended.items[0].weeklyLogs.push({ id: 'explicit-new-log', summary: 'New evidence', createdAt: '2030-01-01' });
  assert.throws(() => applyPipeListViewEdits(identifiedRaw, identifiedView, appended), /missing or duplicate record IDs/);
  assert.deepEqual(stored.items[0].weeklyLogs, [{ summary: 'Prior history' }]);
});
