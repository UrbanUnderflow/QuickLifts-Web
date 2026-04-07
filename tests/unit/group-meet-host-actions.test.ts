import test from 'node:test';
import assert from 'node:assert/strict';

import { createGroupMeetHostActionToken, verifyGroupMeetHostActionToken } from '../../src/lib/groupMeetHostActions';
import { computeGroupMeetAiRecommendation } from '../../src/lib/groupMeetWorkflow';

test('group meet host action tokens round-trip through signing and verification', () => {
  const previousSecret = process.env.GROUP_MEET_HOST_ACTION_SECRET;
  process.env.GROUP_MEET_HOST_ACTION_SECRET = 'unit-test-group-meet-host-secret';

  try {
    const token = createGroupMeetHostActionToken({
      requestId: 'request-123',
      candidateKey: '2026-04-10|540',
    });

    const payload = verifyGroupMeetHostActionToken(token);

    assert.equal(payload.requestId, 'request-123');
    assert.equal(payload.candidateKey, '2026-04-10|540');
    assert.equal(typeof payload.issuedAt, 'number');
  } finally {
    if (previousSecret == null) {
      delete process.env.GROUP_MEET_HOST_ACTION_SECRET;
    } else {
      process.env.GROUP_MEET_HOST_ACTION_SECRET = previousSecret;
    }
  }
});

test('group meet recommendation falls back deterministically when OpenAI is unavailable', async () => {
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
      availabilityEntries: [{ date: '2026-04-10', startMinutes: 570, endMinutes: 750 }],
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
      availabilityEntries: [{ date: '2026-04-10', startMinutes: 600, endMinutes: 780 }],
    },
  ];

  const { analysis, recommendation } = await computeGroupMeetAiRecommendation({
    requestTitle: 'Pulse Intelligence Labs Advisory Board Meeting',
    targetMonth: '2026-04',
    meetingDurationMinutes: 60,
    invites,
    apiKey: '',
    allowFallback: true,
  });

  assert.equal(analysis.bestCandidates.length > 0, true);
  assert.equal(recommendation.model, 'deterministic-fallback');
  assert.equal(recommendation.recommendations.length > 0, true);
  assert.match(recommendation.summary, /Everyone has responded/i);
});
