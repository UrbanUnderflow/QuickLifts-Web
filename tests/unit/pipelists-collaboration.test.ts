import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPipeListMemberAccess,
  mergePipeListSnapshotsThreeWay,
  planPipeListAccessAdditions,
} from '../../src/utils/pipelistsCollaboration';

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
