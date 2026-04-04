import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClubInstallRedirectUrl, isMobileClubRequest } from '../../src/utils/clubOnboardingRouting';

test('isMobileClubRequest detects mobile browser hints and user agents', () => {
  assert.equal(
    isMobileClubRequest({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    }),
    true
  );

  assert.equal(
    isMobileClubRequest({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      secChUaMobile: '?1',
    }),
    true
  );

  assert.equal(
    isMobileClubRequest({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    }),
    false
  );
});

test('buildClubInstallRedirectUrl preserves invite context and strips route-only params', () => {
  const redirectUrl = buildClubInstallRedirectUrl('club_123', {
    id: 'club_123',
    web: '1',
    e2eFixture: 'creator-club-install',
    sharedBy: 'coach_1',
    eventId: 'event_9',
    extra: ['one', 'two'],
  });

  assert.equal(
    redirectUrl,
    '/club/club_123/install?e2eFixture=creator-club-install&sharedBy=coach_1&eventId=event_9&extra=one&extra=two'
  );
});
