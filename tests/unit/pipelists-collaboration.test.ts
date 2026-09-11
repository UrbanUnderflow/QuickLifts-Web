import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPipeListMemberAccess,
  mergePipeListSnapshotsThreeWay,
  pipeListSnapshotsEqual,
  planPipeListAccessAdditions,
} from '../../src/utils/pipelistsCollaboration';

test('cloud field ordering and omitted undefined fields do not trigger another save', () => {
  assert.equal(pipeListSnapshotsEqual({ id: 'one', stage: 'outreach-queued', extra: undefined },
    { stage: 'outreach-queued', id: 'one' }), true);
  assert.equal(pipeListSnapshotsEqual({ stage: 'identified' }, { stage: 'outreach-queued' }), false);
});

test('analyzed leads survive stale snapshots and successive cloud saves', () => {
  const base = [{ id: 'university', items: [{ id: 'existing', stage: 'identified' }] }];
  const first = [{ id: 'university', items: [{ id: 'analyzed-one', stage: 'identified' }, ...base[0].items] }];
  const second = [{ id: 'university', items: [{ id: 'analyzed-two', stage: 'identified' }, ...first[0].items] }];
  const afterStaleSnapshot = mergePipeListSnapshotsThreeWay(base, base, second);
  const firstSaved = mergePipeListSnapshotsThreeWay(base, base, first);
  const secondSaved = mergePipeListSnapshotsThreeWay(base, firstSaved, afterStaleSnapshot);
  const reloaded = JSON.parse(JSON.stringify(secondSaved));
  assert.deepEqual(reloaded[0].items.map((item: { id: string }) => item.id), ['analyzed-two', 'analyzed-one', 'existing']);
  assert.equal(pipeListSnapshotsEqual(secondSaved, reloaded), true);
});

test('a stale personal snapshot preserves queued outreach and concurrent remote edits', () => {
  const base = [{ id: 'university', items: [
    { id: 'stanford', stage: 'identified', notes: '' },
    { id: 'auburn', stage: 'identified', notes: '' },
  ] }];
  const local = structuredClone(base);
  local[0].items[0].stage = 'outreach-queued';
  const remote = structuredClone(base);
  remote[0].items[1].notes = 'Reply received';
  const merged = mergePipeListSnapshotsThreeWay(base, remote, local);
  assert.equal(merged[0].items[0].stage, 'outreach-queued');
  assert.equal(merged[0].items[1].notes, 'Reply received');
  const acknowledged = mergePipeListSnapshotsThreeWay(remote, merged, merged);
  assert.deepEqual(acknowledged, merged);
  const laterRemote = structuredClone(merged);
  laterRemote[0].items[0].stage = 'engaged';
  assert.equal(mergePipeListSnapshotsThreeWay(merged, laterRemote, merged)[0].items[0].stage, 'engaged');
});

test('three-way collaboration keeps distinct teammate edits and keyed log additions', () => {
  const base = {
    id: 'university-pilots',
    description: 'Original description',
    items: [
      {
        id: 'pilot-one',
        nextStep: 'Original action',
        customerSuccess: { health: { status: 'unknown', reason: '' } },
        weeklyLogs: [{ id: 'base-log', notes: 'Original log' }],
      },
    ],
  };
  const remote = {
    ...base,
    description: 'Remote description',
    items: [
      {
        ...base.items[0],
        customerSuccess: { health: { status: 'watch', reason: 'Training slipped' } },
        weeklyLogs: [
          { id: 'remote-log', notes: 'Remote update' },
          ...base.items[0].weeklyLogs,
        ],
      },
    ],
  };
  const local = {
    ...base,
    items: [
      {
        ...base.items[0],
        nextStep: 'Local next action',
        weeklyLogs: [
          { id: 'local-log', notes: 'Local update' },
          ...base.items[0].weeklyLogs,
        ],
      },
    ],
  };

  const merged = mergePipeListSnapshotsThreeWay(base, remote, local);

  assert.equal(merged.description, 'Remote description');
  assert.equal(merged.items[0].nextStep, 'Local next action');
  assert.equal(merged.items[0].customerSuccess.health.status, 'watch');
  assert.deepEqual(merged.items[0].weeklyLogs.map((log) => log.id), [
    'local-log',
    'base-log',
    'remote-log',
  ]);
});

test('a one-sided deletion is retained unless the other side changed the deleted entry', () => {
  const base = { items: [{ id: 'one', value: 'original' }, { id: 'two', value: 'keep' }] };
  const remote = { items: [{ id: 'two', value: 'keep' }] };
  const unchangedLocal = { items: [...base.items] };
  const changedLocal = { items: [{ id: 'one', value: 'edited locally' }, { id: 'two', value: 'keep' }] };

  assert.deepEqual(mergePipeListSnapshotsThreeWay(base, remote, unchangedLocal), {
    items: [{ id: 'two', value: 'keep' }],
  });
  assert.deepEqual(mergePipeListSnapshotsThreeWay(base, remote, changedLocal), changedLocal);
});

test('additional PipeList access is additive, deduplicated, and never falls back to another list', () => {
  assert.deepEqual(
    planPipeListAccessAdditions({
      selectedListIds: ['existing', 'new-one', 'new-one', 'new-two'],
      availableListIds: ['existing', 'new-one', 'new-two'],
      existingListIds: ['existing'],
    }),
    {
      addListIds: ['new-one', 'new-two'],
      alreadyAssignedListIds: ['existing'],
      unavailableListIds: [],
    },
  );

  assert.deepEqual(
    planPipeListAccessAdditions({
      selectedListIds: [],
      availableListIds: ['active-list'],
      existingListIds: [],
    }),
    { addListIds: [], alreadyAssignedListIds: [], unavailableListIds: [] },
  );
});

test('additional PipeList access excludes lists removed or unavailable before save', () => {
  assert.deepEqual(
    planPipeListAccessAdditions({
      selectedListIds: ['available', 'deleted', 'unowned'],
      availableListIds: ['available'],
      existingListIds: [],
    }),
    {
      addListIds: ['available'],
      alreadyAssignedListIds: [],
      unavailableListIds: ['deleted', 'unowned'],
    },
  );
});

test('adding a member preserves every other collaborator and never changes an existing role', () => {
  assert.deepEqual(
    addPipeListMemberAccess({
      viewerEmails: ['viewer@example.com'],
      editorEmails: ['editor@example.com'],
      memberEmail: 'NEW@EXAMPLE.COM',
      access: 'read',
    }),
    {
      added: true,
      viewerEmails: ['viewer@example.com', 'new@example.com'],
      editorEmails: ['editor@example.com'],
    },
  );

  assert.deepEqual(
    addPipeListMemberAccess({
      viewerEmails: ['viewer@example.com'],
      editorEmails: ['member@example.com', 'editor@example.com'],
      memberEmail: 'MEMBER@example.com',
      access: 'read',
    }),
    {
      added: false,
      viewerEmails: ['viewer@example.com'],
      editorEmails: ['member@example.com', 'editor@example.com'],
    },
  );
});

test('an older snapshot after research acknowledgment cannot roll the lead back', () => {
  const old = [{ id: 'university', items: [{ id: 'penn', title: 'Penn State', organization: '', updatedAt: '2026-09-11T14:47:00Z', weeklyLogs: [{ id: 'added' }] }] }];
  const saved = structuredClone(old);
  saved[0].items[0] = { ...saved[0].items[0], title: 'Carl Ohlson', organization: 'Penn State Athletics', updatedAt: '2026-09-11T15:21:00Z', weeklyLogs: [{ id: 'research' }, { id: 'added' }] };
  const rolledBack = mergePipeListSnapshotsThreeWay(saved, old, saved);
  assert.deepEqual(rolledBack, saved);
  const newer = structuredClone(saved);
  newer[0].items[0].organization = 'Updated university name';
  newer[0].items[0].updatedAt = '2026-09-11T15:22:00Z';
  assert.deepEqual(mergePipeListSnapshotsThreeWay(saved, newer, saved), newer);
});
