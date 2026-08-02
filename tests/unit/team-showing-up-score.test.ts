import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateOverallStandings,
  assignSharedRanks,
  countFinalizedLeaderWins,
  current14DaySprint,
  hasEveningCheckIn,
  hasMorningCheckIn,
  hasVerifiedOvernightData,
  isSkillAssignmentDueToday,
  isShowingUpLeaderboardEnabled,
  scoreShowingUpDay,
} from '../../netlify/functions/utils/teamShowingUpScore';

test('daily score awards one point for each completed showing-up action', () => {
  assert.deepEqual(
    scoreShowingUpDay({
      dateKey: '2026-08-03',
      skillTraining: true,
      morningCheckIn: true,
      eveningCheckIn: true,
      wearable: true,
    }),
    {
      dateKey: '2026-08-03',
      skillTraining: true,
      morningCheckIn: true,
      eveningCheckIn: true,
      wearable: true,
      points: 4,
    },
  );
});

test('morning and evening check-ins are separate completion signals', () => {
  const morningOnly = { level: 'solid' };
  const eveningOnly = { eveningCheckIn: { level: 'great' } };
  const both = { level: 'locked', eveningCheckIn: { level: 'strong' } };

  assert.equal(hasMorningCheckIn(morningOnly), true);
  assert.equal(hasEveningCheckIn(morningOnly), false);
  assert.equal(hasMorningCheckIn(eveningOnly), false);
  assert.equal(hasEveningCheckIn(eveningOnly), true);
  assert.equal(hasMorningCheckIn(both), true);
  assert.equal(hasEveningCheckIn(both), true);
});

test('team leaderboard visibility defaults on and honors an explicit coach setting', () => {
  assert.equal(isShowingUpLeaderboardEnabled(undefined), true);
  assert.equal(isShowingUpLeaderboardEnabled({}), true);
  assert.equal(isShowingUpLeaderboardEnabled({ showingUpLeaderboard: { enabled: true } }), true);
  assert.equal(isShowingUpLeaderboardEnabled({ showingUpLeaderboard: { enabled: false } }), false);
});

test('shared ranks preserve ties and skip the next occupied position', () => {
  const ranked = assignSharedRanks([
    { userId: 'a', displayName: 'Alex', totalPoints: 8 },
    { userId: 'b', displayName: 'Blair', totalPoints: 10 },
    { userId: 'c', displayName: 'Casey', totalPoints: 8 },
    { userId: 'd', displayName: 'Drew', totalPoints: 6 },
  ]);
  assert.deepEqual(
    ranked.map(({ userId, rank }) => ({ userId, rank })),
    [
      { userId: 'b', rank: 1 },
      { userId: 'a', rank: 2 },
      { userId: 'c', rank: 2 },
      { userId: 'd', rank: 4 },
    ],
  );
});

test('profile leader wins count only closed 14-day boards and award shared first place', () => {
  const wins = countFinalizedLeaderWins([
    { isFinalized: false, winnerAthleteIds: ['a'] },
    { isFinalized: true, winnerAthleteIds: ['a', 'b'] },
    { isFinalized: true, winnerAthleteIds: ['a'] },
    { isFinalized: true, winnerAthleteIds: [] },
  ]);

  assert.equal(wins.get('a'), 2);
  assert.equal(wins.get('b'), 1);
  assert.equal(wins.has('c'), false);
});

test('wearable point requires both sleep and recovery evidence', () => {
  assert.equal(hasVerifiedOvernightData({
    domains: {
      recovery: {
        sleepDuration: 7.2,
        recoveryScore: 76,
      },
    },
  }), true);
  assert.equal(hasVerifiedOvernightData({
    domains: {
      recovery: {
        sleepDuration: 7.2,
      },
    },
  }), false);
  assert.equal(hasVerifiedOvernightData({
    domains: {
      recovery: {
        recoveryScore: 76,
      },
    },
  }), false);
  assert.equal(hasVerifiedOvernightData({
    domains: {
      recovery: {
        sleepDuration: 7.2,
        sleepScore: 88,
      },
    },
  }), false);
  assert.equal(hasVerifiedOvernightData({
    domains: {
      recovery: {
        data: {
          totalSleepMin: 430,
          hrvRmssd: 54,
        },
      },
    },
  }), true);
});

test('leaderboard uses consecutive 14-day sprints anchored to the pilot start', () => {
  const result = current14DaySprint(
    new Date('2026-08-12T15:00:00.000Z'),
    'America/New_York',
    '2026-07-30',
  );
  assert.equal(result.sprintNumber, 1);
  assert.equal(result.sprintStartDate, '2026-07-30');
  assert.equal(result.sprintEndDate, '2026-08-12');
  assert.equal(result.throughDate, '2026-08-12');
  assert.equal(result.daysElapsed, 14);
  assert.equal(result.daysRemaining, 0);
  assert.equal(result.dateKeys.length, 14);
});

test('a new 14-day sprint resets the visible date range', () => {
  const result = current14DaySprint(
    new Date('2026-08-13T15:00:00.000Z'),
    'America/New_York',
    '2026-07-30',
  );
  assert.equal(result.sprintNumber, 2);
  assert.equal(result.sprintStartDate, '2026-08-13');
  assert.equal(result.sprintEndDate, '2026-08-26');
  assert.deepEqual(result.dateKeys, [
    '2026-08-13',
  ]);
});

test('skill scoring counts only active curriculum work due today', () => {
  assert.equal(isSkillAssignmentDueToday({
    actionType: 'protocol',
    status: 'assigned',
    curriculumSlateId: 'slate-1',
    curriculumSlotIndex: 1,
    curriculumIsDueToday: true,
  }), true);
  assert.equal(isSkillAssignmentDueToday({
    actionType: 'simulation',
    status: 'assigned',
    curriculumSlateId: 'slate-1',
    curriculumSlotIndex: 2,
    curriculumIsDueToday: false,
  }), false);
  assert.equal(isSkillAssignmentDueToday({
    actionType: 'protocol',
    status: 'superseded',
    isPrimaryForDate: true,
  }), false);
  assert.equal(isSkillAssignmentDueToday({
    actionType: 'protocol',
    status: 'completed',
  }), true);
});

test('overall standings add durable daily records across multiple sprints', () => {
  const standings = aggregateOverallStandings([
    { userId: 'a', displayName: 'Alex', dateKey: '2026-07-30', points: 4 },
    { userId: 'a', displayName: 'Alex', dateKey: '2026-08-13', points: 2 },
    { userId: 'b', displayName: 'Blair', dateKey: '2026-07-30', points: 2 },
    { userId: 'b', displayName: 'Blair', dateKey: '2026-08-13', points: 2 },
  ]);
  assert.deepEqual(standings.map((member) => ({
    userId: member.userId,
    points: member.totalPoints,
    days: member.daysScored,
    rank: member.rank,
  })), [
    { userId: 'a', points: 6, days: 2, rank: 1 },
    { userId: 'b', points: 4, days: 2, rank: 2 },
  ]);
});
