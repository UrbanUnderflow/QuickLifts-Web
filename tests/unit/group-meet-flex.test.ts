import test from 'node:test';
import assert from 'node:assert/strict';

import { computeGroupMeetAnalysis } from '../../src/lib/groupMeet';
import {
  buildGroupMeetFlexRoundOptions,
  buildGroupMeetFlexPromptRecipients,
  createGroupMeetFlexActionToken,
  getGroupMeetEasternDateKey,
  isGroupMeetFlexDispatchTime,
  verifyGroupMeetFlexActionToken,
} from '../../src/lib/groupMeetFlex';

test('group meet flex action tokens round-trip through signing and verification', () => {
  const previousSecret = process.env.GROUP_MEET_FLEX_ACTION_SECRET;
  process.env.GROUP_MEET_FLEX_ACTION_SECRET = 'unit-test-group-meet-flex-secret';

  try {
    const token = createGroupMeetFlexActionToken({
      requestId: 'request-123',
      inviteToken: 'guest-123',
      candidateKey: '2026-04-10|540',
      date: '2026-04-10',
      startMinutes: 540,
      endMinutes: 600,
    });

    const payload = verifyGroupMeetFlexActionToken(token);

    assert.equal(payload.requestId, 'request-123');
    assert.equal(payload.inviteToken, 'guest-123');
    assert.equal(payload.candidateKey, '2026-04-10|540');
    assert.equal(payload.date, '2026-04-10');
    assert.equal(payload.startMinutes, 540);
    assert.equal(payload.endMinutes, 600);
    assert.equal(typeof payload.issuedAt, 'number');
  } finally {
    if (previousSecret == null) {
      delete process.env.GROUP_MEET_FLEX_ACTION_SECRET;
    } else {
      process.env.GROUP_MEET_FLEX_ACTION_SECRET = previousSecret;
    }
  }
});

test('group meet flex recipients target only the single blockers and exclude the host by default', () => {
  const invites = [
    {
      token: 'host-token',
      name: 'Tremaine Grant',
      email: 'tre@fitwithpulse.ai',
      participantType: 'host' as const,
      shareUrl: 'https://fitwithpulse.ai/group-meet/host-token',
      emailStatus: 'manual_only' as const,
      emailError: null,
      respondedAt: '2026-03-31T12:00:00.000Z',
      availabilityCount: 2,
      availabilityEntries: [
        { date: '2026-04-10', startMinutes: 540, endMinutes: 720 },
      ],
    },
    {
      token: 'guest-one',
      name: 'Bobby Weke',
      email: 'bobby@fitwithpulse.ai',
      participantType: 'participant' as const,
      shareUrl: 'https://fitwithpulse.ai/group-meet/guest-one',
      emailStatus: 'sent' as const,
      emailError: null,
      respondedAt: '2026-03-31T12:15:00.000Z',
      availabilityCount: 2,
      availabilityEntries: [
        { date: '2026-04-10', startMinutes: 540, endMinutes: 720 },
        { date: '2026-04-11', startMinutes: 540, endMinutes: 720 },
      ],
    },
    {
      token: 'guest-two',
      name: 'Valerie Alexander',
      email: 'valerie@speakhappiness.com',
      participantType: 'participant' as const,
      shareUrl: 'https://fitwithpulse.ai/group-meet/guest-two',
      emailStatus: 'sent' as const,
      emailError: null,
      respondedAt: '2026-03-31T12:30:00.000Z',
      availabilityCount: 1,
      availabilityEntries: [
        { date: '2026-04-11', startMinutes: 540, endMinutes: 720 },
      ],
    },
  ];

  const analysis = computeGroupMeetAnalysis(invites, 60);
  const recipients = buildGroupMeetFlexPromptRecipients({
    analysis,
    invites,
    maxOptionsPerRecipient: 3,
    includeHost: false,
  });

  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].inviteToken, 'guest-two');
  assert.equal(recipients[0].email, 'valerie@speakhappiness.com');
  assert.equal(recipients[0].options.length, 3);
  assert.equal(recipients[0].options.every((option) => option.date === '2026-04-10'), true);
});

test('group meet flex recipients can include invitees who have not submitted any availability yet', () => {
  const invites = [
    {
      token: 'host-token',
      name: 'Tremaine Grant',
      email: 'tre@fitwithpulse.ai',
      participantType: 'host' as const,
      shareUrl: 'https://fitwithpulse.ai/group-meet/host-token',
      emailStatus: 'manual_only' as const,
      emailError: null,
      respondedAt: '2026-03-31T12:00:00.000Z',
      availabilityCount: 1,
      availabilityEntries: [{ date: '2026-04-10', startMinutes: 540, endMinutes: 720 }],
    },
    {
      token: 'guest-one',
      name: 'Bobby Weke',
      email: 'bobby@fitwithpulse.ai',
      participantType: 'participant' as const,
      shareUrl: 'https://fitwithpulse.ai/group-meet/guest-one',
      emailStatus: 'sent' as const,
      emailError: null,
      respondedAt: '2026-03-31T12:15:00.000Z',
      availabilityCount: 1,
      availabilityEntries: [{ date: '2026-04-10', startMinutes: 540, endMinutes: 720 }],
    },
    {
      token: 'guest-two',
      name: 'Valerie Alexander',
      email: 'valerie@speakhappiness.com',
      participantType: 'participant' as const,
      shareUrl: 'https://fitwithpulse.ai/group-meet/guest-two',
      emailStatus: 'sent' as const,
      emailError: null,
      respondedAt: null,
      availabilityCount: 0,
      availabilityEntries: [],
    },
  ];

  const analysis = computeGroupMeetAnalysis(invites, 60);
  const recipients = buildGroupMeetFlexPromptRecipients({
    analysis,
    invites,
    maxOptionsPerRecipient: 3,
    includeHost: false,
  });

  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].inviteToken, 'guest-two');
  assert.equal(recipients[0].options.length, 3);
});

test('group meet flex dispatch helpers track the deadline date in eastern time', () => {
  assert.equal(getGroupMeetEasternDateKey('2026-04-08T12:00:00.000Z'), '2026-04-08');
  assert.equal(isGroupMeetFlexDispatchTime('2026-04-08T12:00:00.000Z'), true);
  assert.equal(isGroupMeetFlexDispatchTime('2026-04-08T11:00:00.000Z'), false);
});

test('group meet flex round options generate a shared top-three option set', () => {
  const invites = [
    {
      token: 'host-token',
      name: 'Tremaine Grant',
      email: 'tre@fitwithpulse.ai',
      participantType: 'host' as const,
      shareUrl: 'https://fitwithpulse.ai/group-meet/host-token',
      emailStatus: 'manual_only' as const,
      emailError: null,
      respondedAt: '2026-03-31T12:00:00.000Z',
      availabilityCount: 1,
      availabilityEntries: [{ date: '2026-04-10', startMinutes: 540, endMinutes: 720 }],
    },
    {
      token: 'guest-one',
      name: 'Bobby Weke',
      email: 'bobby@fitwithpulse.ai',
      participantType: 'participant' as const,
      shareUrl: 'https://fitwithpulse.ai/group-meet/guest-one',
      emailStatus: 'sent' as const,
      emailError: null,
      respondedAt: '2026-03-31T12:15:00.000Z',
      availabilityCount: 1,
      availabilityEntries: [{ date: '2026-04-10', startMinutes: 540, endMinutes: 720 }],
    },
    {
      token: 'guest-two',
      name: 'Valerie Alexander',
      email: 'valerie@speakhappiness.com',
      participantType: 'participant' as const,
      shareUrl: 'https://fitwithpulse.ai/group-meet/guest-two',
      emailStatus: 'sent' as const,
      emailError: null,
      respondedAt: null,
      availabilityCount: 0,
      availabilityEntries: [],
    },
  ];

  const analysis = computeGroupMeetAnalysis(invites, 60);
  const options = buildGroupMeetFlexRoundOptions({
    analysis,
    maxOptions: 3,
  });

  assert.equal(options.length, 3);
  assert.equal(options.every((option) => option.date === '2026-04-10'), true);
});
