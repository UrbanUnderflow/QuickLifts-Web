import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClubCanonicalUrl, buildClubInstallPath, buildClubOneLink } from '../../src/utils/clubLinks';

test('buildClubInstallPath preserves share context and optional web override', () => {
  assert.equal(
    buildClubInstallPath('club_123', {
      sharedBy: 'coach_1',
      eventId: 'event_9',
      web: true,
    }),
    '/club/club_123/install?sharedBy=coach_1&eventId=event_9&web=1'
  );
});

test('buildClubCanonicalUrl preserves share context on the canonical club url', () => {
  assert.equal(
    buildClubCanonicalUrl('club_123', {
      sharedBy: 'coach_1',
      eventId: 'event_9',
    }),
    'https://fitwithpulse.ai/club/club_123?sharedBy=coach_1&eventId=event_9'
  );
});

test('buildClubOneLink defaults to canonical web fallback and includes deep-link handoff', () => {
  const oneLink = new URL(
    buildClubOneLink({
      clubId: 'club_123',
      sharedBy: 'coach_1',
      eventId: 'event_9',
      title: 'Creator Club Invite',
      description: 'Open this creator club in Pulse.',
      imageUrl: '/club-preview.png',
    })
  );

  assert.equal(oneLink.origin, 'https://fitwithpulse.onelink.me');
  assert.equal(oneLink.searchParams.get('deep_link_value'), 'club');
  assert.equal(oneLink.searchParams.get('clubId'), 'club_123');
  assert.equal(oneLink.searchParams.get('sharedBy'), 'coach_1');
  assert.equal(oneLink.searchParams.get('eventId'), 'event_9');
  assert.equal(oneLink.searchParams.get('af_force_deeplink'), 'true');
  assert.equal(
    oneLink.searchParams.get('af_r'),
    'https://fitwithpulse.ai/club/club_123?sharedBy=coach_1&eventId=event_9'
  );

  const deepLinkUrl = new URL(oneLink.searchParams.get('af_dp') || '');
  assert.equal(deepLinkUrl.protocol, 'pulse:');
  assert.equal(deepLinkUrl.hostname, 'club');
  assert.equal(deepLinkUrl.searchParams.get('clubId'), 'club_123');
  assert.equal(deepLinkUrl.searchParams.get('sharedBy'), 'coach_1');
  assert.equal(deepLinkUrl.searchParams.get('eventId'), 'event_9');
});
