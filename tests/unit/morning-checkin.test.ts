import test from 'node:test';
import assert from 'node:assert/strict';
import { __internal } from '../../netlify/functions/record-morning-checkin';

test('same-day morning revision replaces the old reply path', () => {
  const branch = __internal.synthesizeBranch(
    'locked',
    'You said you feel locked in today.',
    'What has you locked in?',
  );
  const revised = __internal.buildRevisedMorningConversation(
    {
      id: 'athlete_morning_2026-07-22',
      athleteUserId: 'athlete',
      teamId: 'team',
      trigger: 'morning-checkin-tone',
      branchId: 'morning-checkin-tone-drained',
      actionDomain: 'recovery',
      actionState: 'self-report-body',
      state: 'action-delivered',
      openedAt: 1,
      closedAt: 4,
      turns: [{ role: 'athlete-reply', text: 'My body' }],
      triggerEvidence: { summary: 'old answer' },
      createdAt: 1,
      updatedAt: 4,
    },
    branch,
    'load',
    'Morning check-in tone: locked. Probe variant: baseline.',
    100,
  );

  assert.equal(revised.state, 'awaiting-reply');
  assert.equal(revised.branchId, 'morning-checkin-tone-locked');
  assert.equal(revised.actionDomain, 'load');
  assert.equal(revised.turns.length, 2);
  assert.deepEqual(revised.turns.map((turn: any) => turn.role), ['nora-opener', 'nora-probe']);
  assert.equal(revised.actionState, undefined);
  assert.equal(revised.closedAt, undefined);
});
