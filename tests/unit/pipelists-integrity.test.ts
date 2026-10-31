import { nextPipeListsRevision, assertPipeListWriteSafe } from '../../src/utils/pipelistsWriteProtocol';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { planPipeListsConsolidation, mergeArchiveMarkers, visiblePipeLists, reconcilePipeLists, mergeMovedLead, removeListMember } from '../../src/utils/pipelistsIntegrity';

const item = (id = 'same') => ({ id, notes: 'Earlier notes', stage: 'identified', weeklyLogs: [{ id: 'a', summary: 'History' }], attachments: [{ id: 'file', url: 'attachment' }], updatedAt: '2026-10-20' });
const grants = { id: 'grants', name: 'Grants', items: [{ ...item(), notes: 'Newer notes', stage: 'submitted' }] };
const pitch = { id: 'pitch', name: 'Pitch Competitions', items: [item()] };
const source = fs.readFileSync(new URL('../../src/features/PipeListsWorkspace.tsx', import.meta.url), 'utf8');

test('same-ID move keeps Grants decisions and preserves incoming fields and histories', () => {
  const old = { ...item(), weeklyLogs: [{ id: 'old-log', summary: 'Old history' }], attachments: [{ id: 'old-file', url: 'old attachment' }] };
  const current = { ...grants.items[0], notes: '', priority: 'high' };
  const result: any = mergeMovedLead(old, current);
  assert.equal(result.stage, 'submitted');
  assert.equal(result.notes, '', 'intentional destination blank remains authoritative');
  assert.equal(result.priority, 'high');
  assert.equal(result.weeklyLogs.length, 2);
  assert.equal(result.attachments.length, 2);
  assert.deepEqual(result.mergeRevisions[0], old);
  assert.equal(old.notes, 'Earlier notes');
  assert.equal(current.weeklyLogs.length, 1, 'inputs remain untouched');
});

test('conflicting same-ID log revisions survive without duplicate render keys', () => {
  const old = item(); const current = { ...item(), weeklyLogs: [{ id: 'a', summary: 'Corrected history' }] };
  const result: any = mergeMovedLead(old, current);
  assert.deepEqual(result.weeklyLogs, current.weeklyLogs);
  assert.deepEqual(result.mergeRevisions[0].weeklyLogs, old.weeklyLogs);
});

test('moves never automatically revive tombstones or combine different IDs', () => {
  for (const tombstone of [{ deletedAt: '2026-10-20' }, { movedToListId: 'other' }]) {
    assert.throws(() => mergeMovedLead(item(), { ...item(), ...tombstone }), /deleted or moved/);
  }
  assert.throws(() => mergeMovedLead(item('a'), item('b')), /identical record IDs/);
});

test('consolidate, archive, refresh/relogin and stale device edits keep Pitch removed', () => {
  const consolidated = { ...grants, items: [mergeMovedLead(pitch.items[0], grants.items[0])] };
  const archived = { pitch: { list: pitch, archivedAt: '2026-10-31T12:00:00Z' } };
  const stale = { ...pitch, name: 'Old device edit' };
  assert.deepEqual(reconcilePipeLists([grants, pitch], [consolidated], [grants, stale], archived).map(list => list.id), ['grants']);
  // A legacy device can still write an array containing Pitch; the marker wins.
  assert.deepEqual(visiblePipeLists([consolidated, stale], archived).map(list => list.id), ['grants']);
  // Empty workspaces remain empty across reload.
  assert.deepEqual(visiblePipeLists([pitch], archived), []);
  assert.deepEqual(mergeArchiveMarkers(archived, {}), archived, 'old snapshots cannot erase markers');
});

test('explicit restore wins over a stale archive replay, and rearchive wins later', () => {
  const archived = { pitch: { list: pitch, archivedAt: '2026-10-31T12:00:00Z' } };
  const restored = { pitch: { ...archived.pitch, restoredAt: '2026-10-31T13:00:00Z' } };
  assert.deepEqual(visiblePipeLists([pitch], mergeArchiveMarkers(restored, archived)), [pitch]);
  const rearchived = { pitch: { list: pitch, archivedAt: '2026-10-31T14:00:00Z' } };
  assert.deepEqual(visiblePipeLists([pitch], mergeArchiveMarkers(rearchived, restored)), []);
});

test('actual workspace selection uses the selected list even when item IDs collide', () => {
  const code = source.slice(source.indexOf('  const activeList = useMemo('), source.indexOf('  const accessibleShareDocs ='));
  const resolve = new Function('lists', 'activeListId', 'selectedDetailItemId', 'initialLists', 'useMemo', ts.transpile(code + '\nreturn activeList;'));
  const result = resolve([grants, pitch], 'pitch', 'same', [grants], (fn: any) => fn());
  assert.equal(result.id, 'pitch');
});

test('actual archive handler saves a full copy and a durable marker without deleting a document', async () => {
  const code = source.slice(source.indexOf('  const handleDeleteList ='), source.indexOf('  const restoreArchivedList ='));
  let write: any;
  const state = { lists: [grants, pitch], unrelated: 'preserve' };
  const deps = { nextPipeListsRevision, assertPipeListWriteSafe,
    canManageActiveList: true, user: { uid: 'owner' }, personalStateReady: true, activeList: pitch,
    simpBudgetDb: {}, SIMPBUDGET_USERS_COLLECTION: '', PIPELISTS_SUBCOLLECTION: '', PIPELISTS_STATE_DOCUMENT_ID: '',
    doc: () => ({}), runTransaction: async (_: any, callback: any) => callback({ get: async () => ({ exists: () => true, data: () => state }), update: (_: any, value: any) => { write = value; } }),
    personalSnapshotBaselineRef: { current: [grants, pitch] }, mergePipeListSnapshotsThreeWay: (_: any, remote: any) => remote,
    serverTimestamp: () => 'timestamp', closeLeadDetails() {}, setIsDeleteListModalOpen() {}, setAppMessage() {}, readFirestoreError: (error: Error) => { throw error; },
  };
  await new Function(...Object.keys(deps), ts.transpile(code + '\nreturn handleDeleteList();'))(...Object.values(deps));
  assert.deepEqual(write.lists, [grants]);
  assert.deepEqual(write.archivedLists.pitch.list, pitch);
  assert.ok(write.archivedLists.pitch.archivedAt);
  assert.equal(state.lists.length, 2);
});

test('removing a person from one list leaves every other list unchanged', () => {
  const a = { viewerEmails: ['chai@example.org'], editorEmails: ['tre@example.org', 'han@example.org'], inviteStatuses: { 'chai@example.org': { status: 'sent' }, 'han@example.org': { status: 'accepted' } } };
  const b = structuredClone(a);
  const result = removeListMember(a, 'han@example.org');
  assert.deepEqual(result.editorEmails, ['tre@example.org']);
  assert.equal(result.inviteStatuses['han@example.org'], undefined);
  assert.deepEqual(a, b);
  assert.deepEqual(result.viewerEmails, a.viewerEmails);
});

test('consolidation preserves all Grants records and leaves only source tombstones', () => {
  const result = planPipeListsConsolidation(pitch, grants, '2026-10-31T12:00:00Z');
  assert.equal(result.destination.items.length, 1);
  assert.equal(result.destination.items[0].notes, 'Newer notes');
  assert.equal(result.source.items[0].movedToListId, 'grants');
  assert.equal(result.source.items[0].deletedAt, '2026-10-31T12:00:00Z');
  assert.equal(result.moved, 1);
  assert.equal(pitch.items[0].deletedAt, undefined);
});

test('actual public-link revocation touches only the active list and its lead links', async () => {
  const code = source.slice(source.indexOf('  const revokeActiveListPublicLinks ='), source.indexOf('  const updateCollaboratorListAccess ='));
  const writes: { path: string; data: any }[] = [];
  const docs: Record<string, any> = {
    'users/owner/lists/state': { lists: [grants, pitch] },
    'shares/owner-grants': { ownerUid: 'owner', publicRead: true },
    'protected/owner-grants': { ownerUid: 'owner', list: grants },
    'leads/owner-grants-one': { ownerUid: 'owner', listId: 'grants', publicRead: true },
  };
  const deps = { nextPipeListsRevision, assertPipeListWriteSafe,
    user: { uid: 'owner', email: 'owner@example.com' }, canManageActiveList: true, activeList: grants,
    window: { confirm: () => true }, simpBudgetDb: {}, PIPELIST_SHARES_COLLECTION: 'shares', PIPELIST_PROTECTED_SHARES_COLLECTION: 'protected', SIMPBUDGET_USERS_COLLECTION: 'users', PIPELISTS_SUBCOLLECTION: 'lists', PIPELISTS_STATE_DOCUMENT_ID: 'state', PIPELEAD_SHARES_COLLECTION: 'leads',
    doc: (_: any, ...segments: string[]) => ({ path: segments.join('/'), id: segments.at(-1) }),
    collection: (_: any, name: string) => name, where: (...args: any[]) => args, firestoreQuery: (...args: any[]) => args,
    getDocs: async (query: any[]) => { assert.deepEqual(query, ['leads', ['ownerUid', '==', 'owner'], ['listId', '==', 'grants']]); return { size: 1, docs: [{ ref: { path: 'leads/owner-grants-one' } }] }; },
    shareDocumentIdForList: (uid: string, id: string) => `${uid}-${id}`,
    runTransaction: async (_: any, callback: any) => callback({
      get: async (ref: any) => ({ ref, exists: () => Boolean(docs[ref.path]), data: () => docs[ref.path] }),
      update: (ref: any, data: any) => writes.push({ path: ref.path, data }),
    }),
    serverTimestamp: () => 'now', setShareMessage: (message: any) => { assert.notEqual(message.type, 'error', message.text); }, readFirestoreError: (error: Error) => error.message,
  };
  await new Function(...Object.keys(deps), ts.transpile(code + '\nreturn revokeActiveListPublicLinks();'))(...Object.values(deps));
  assert.equal(writes.length, 4);
  assert.deepEqual(writes[0].data.lists[1], pitch);
  assert.equal(writes[0].data.lists[0].publicLinksDisabled, true);
  assert.equal(writes.find(write => write.path.startsWith('leads/'))?.data.publicRead, false);
  assert.equal(writes.find(write => write.path.startsWith('shares/'))?.data.viewerEmails, undefined, 'collaborators are not silently removed');
  assert.deepEqual(writes.find(write => write.path.startsWith('protected/'))?.data.lastEditedBy, { uid: 'owner', email: 'owner@example.com' });
});


test('public snapshots exclude complete private merge revisions', () => {
  const code = source.slice(source.indexOf('const publicSafePipeListSnapshot ='), source.indexOf('const pipeListRequiresAccountAccess ='));
  const fn = new Function('collaboratorSafePipeListSnapshot', ts.transpile(code + '\nreturn publicSafePipeListSnapshot;'))((list: any) => list);
  const list = { ...grants, items: [{ ...item(), mergeRevisions: [{ customerSuccess: { secret: true } }] }] };
  assert.equal(fn(list).items[0].mergeRevisions, undefined);
  assert.equal(list.items[0].mergeRevisions.length, 1);
});

test('login and cloud refresh never reapply seed lists or old localStorage records', () => {
  const initialization = source.slice(source.indexOf('let privateLists:'), source.indexOf('const fallbackLists:'));
  assert.doesNotMatch(initialization, /mergeRecommendedPitchCompetitions|localStorage.getItem|privateLists[^;]*initialLists/);
  assert.match(initialization, /visiblePipeLists\(privateLists, archivedListsRef.current\)/);
  assert.doesNotMatch(source, /mergeRecommendedPitchCompetitions/);
});

test('a stale tab cannot recreate a revoked lead link', async () => {
  const code = source.slice(source.indexOf('  const createOrUpdateLeadShareLink ='), source.indexOf('  const handleManualLeadSave ='));
  for (const scenario of ['disabled-list', 'revoked-link', 'archived-list']) {
    let writes = 0; let errorMessage = '';
    const deps = { nextPipeListsRevision, assertPipeListWriteSafe,
      canModify: true, user: { uid: 'owner', email: 'owner@example.com' }, isLeadSharedView: false, activeList: grants,
      shareDoc: null, TREMAINE_OWNER_EMAIL: '', shareDocumentIdForLead: () => 'lead',
      window: { location: { origin: 'https://example.com' } }, publicSafePipeListSnapshot: (value: any) => value,
      buildLeadShareList: () => grants, simpBudgetDb: {}, SIMPBUDGET_USERS_COLLECTION: 'users', PIPELISTS_SUBCOLLECTION: 'lists', PIPELISTS_STATE_DOCUMENT_ID: 'state', PIPELEAD_SHARES_COLLECTION: 'leads',
      doc: (_: any, ...parts: string[]) => parts.join('/'), isArchived: (archive: any) => Boolean(archive),
      runTransaction: async (_: any, callback: any) => callback({
        get: async (ref: string) => ({ exists: () => true, data: () => ref === 'leads/lead' ? { publicRead: false } : { lists: [{ ...grants, publicLinksDisabled: scenario === 'disabled-list' }], archivedLists: scenario === 'archived-list' ? { grants: {} } : {} } }),
        set: () => { writes += 1; },
      }),
      setLeadShareMessage: (value: any) => { if (value?.type === 'error') errorMessage = value.text; },
      readFirestoreError: (error: Error) => error.message, console: { error() {} },
    };
    await new Function(...Object.keys(deps), ts.transpile(code + '\nreturn createOrUpdateLeadShareLink({ id: "one" });'))(...Object.values(deps));
    assert.equal(writes, 0, scenario);
    assert.match(errorMessage, /unavailable|revoked/);
  }
});
