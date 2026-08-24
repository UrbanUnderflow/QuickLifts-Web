import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPulseCheckTeamInviteOneLink,
  hasPulseCheckInviteDevFirebaseMarker,
} from '../../src/utils/pulsecheckInviteLinks';

test('detects dev Firebase routing on direct invite URLs', () => {
  assert.equal(
    hasPulseCheckInviteDevFirebaseMarker(
      'https://fitwithpulse.ai/PulseCheck/team-invite/invite-token?devFirebase=1'
    ),
    true
  );
  assert.equal(
    hasPulseCheckInviteDevFirebaseMarker('/PulseCheck/team-invite/invite-token?devFirebase=1'),
    true
  );
});

test('detects dev Firebase routing inside an AppsFlyer fallback URL', () => {
  const oneLink = buildPulseCheckTeamInviteOneLink({
    token: 'invite-token',
    fallbackPath: '/PulseCheck/team-invite/invite-token?devFirebase=1',
    role: 'athlete',
    pilotName: 'Spring Pilot',
    teamName: 'Volleyball',
    organizationName: 'Clark Atlanta University',
  });

  assert.equal(hasPulseCheckInviteDevFirebaseMarker(oneLink), true);
});

test('does not mistake clean or unrelated invite parameters for dev Firebase routing', () => {
  const encodedCleanFallback = new URL('https://pulsecheckapp.onelink.me/uT14');
  encodedCleanFallback.searchParams.set(
    'af_r',
    'https://fitwithpulse.ai/PulseCheck/team-invite/invite-token?devFirebase=0'
  );
  encodedCleanFallback.searchParams.set('af_og_description', 'Example devFirebase=1 troubleshooting text');

  assert.equal(hasPulseCheckInviteDevFirebaseMarker(encodedCleanFallback.toString()), false);
  assert.equal(
    hasPulseCheckInviteDevFirebaseMarker(
      'https://fitwithpulse.ai/PulseCheck/team-invite/invite-token?devFirebase=0'
    ),
    false
  );
  assert.equal(hasPulseCheckInviteDevFirebaseMarker('not a valid URL %%%'), false);
  assert.equal(hasPulseCheckInviteDevFirebaseMarker(''), false);
});
