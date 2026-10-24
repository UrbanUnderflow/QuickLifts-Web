import assert from 'node:assert/strict';
import test from 'node:test';
import { getNativeAppDistribution } from '../../src/utils/pulsecheckAppDistribution';
import { buildPulseCheckTeamInviteOneLink } from '../../src/utils/pulsecheckInviteLinks';

test('PulseCheck keeps its existing distribution; display branding cannot select an installed app', () => {
  assert.equal(getNativeAppDistribution('pulsecheck').scheme, 'pulsecheck');
  assert.equal(getNativeAppDistribution({ athleticmind: 'athleticmind' }).brand, 'pulsecheck');
});

test('AthleticMind fails closed without real distribution and preserves invite web fallback', () => {
  delete process.env.NEXT_PUBLIC_ATHLETICMIND_IOS_APP_STORE_URL;
  delete process.env.NEXT_PUBLIC_ATHLETICMIND_ANDROID_PLAY_STORE_URL;
  delete process.env.NEXT_PUBLIC_ATHLETICMIND_ONELINK_URL;
  const app = getNativeAppDistribution('athleticmind');
  assert.equal(app.iosUrl, null);
  assert.equal(app.androidUrl, null);
  assert.equal(app.scheme, 'athleticmind');
  assert.equal(buildPulseCheckTeamInviteOneLink({ token: 'synthetic', role: 'athlete', productBrand: 'athleticmind', fallbackPath: '/PulseCheck/team-invite/synthetic' }), 'https://fitwithpulse.ai/AthleticMind/team-invite/synthetic');
});

test('AthleticMind rejects PulseCheck store listings and template, accepts configured app links', () => {
  process.env.NEXT_PUBLIC_ATHLETICMIND_IOS_APP_STORE_URL = 'https://apps.apple.com/app/id6747253393';
  process.env.NEXT_PUBLIC_ATHLETICMIND_ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.fitwithpulse.pulsecheck';
  process.env.NEXT_PUBLIC_ATHLETICMIND_ONELINK_URL = 'https://pulsecheckapp.onelink.me/uT14';
  assert.equal(getNativeAppDistribution('athleticmind').iosUrl, null);
  assert.equal(getNativeAppDistribution('athleticmind').androidUrl, null);
  assert.equal(getNativeAppDistribution('athleticmind').oneLinkUrl, null);
  process.env.NEXT_PUBLIC_ATHLETICMIND_ONELINK_URL = 'https://synthetic-athleticmind.onelink.me/test';
  const link = new URL(buildPulseCheckTeamInviteOneLink({ token: 'synthetic', role: 'athlete', productBrand: 'athleticmind', fallbackPath: '/PulseCheck/team-invite/synthetic' }));
  assert.equal(link.hostname, 'synthetic-athleticmind.onelink.me');
  assert.equal(link.searchParams.get('inviteToken'), 'synthetic');
  assert.equal(link.searchParams.get('deep_link_value'), 'pulsecheck_team_invite');
  delete process.env.NEXT_PUBLIC_ATHLETICMIND_ONELINK_URL;
  delete process.env.NEXT_PUBLIC_ATHLETICMIND_IOS_APP_STORE_URL;
  delete process.env.NEXT_PUBLIC_ATHLETICMIND_ANDROID_PLAY_STORE_URL;
});

test('explicit temporary installation override retains the invitation token', () => {
  const link = new URL(buildPulseCheckTeamInviteOneLink({
    token: 'umes-golf-synthetic', role: 'athlete', productBrand: 'athleticmind',
    distributionBrand: 'pulsecheck', fallbackPath: '/PulseCheck/team-invite/umes-golf-synthetic',
  }));
  assert.equal(link.hostname, 'pulsecheckapp.onelink.me');
  assert.equal(link.searchParams.get('deep_link_sub2'), 'umes-golf-synthetic');
  assert.equal(link.searchParams.get('inviteToken'), 'umes-golf-synthetic');
});
