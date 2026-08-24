import assert from 'node:assert/strict';
import test from 'node:test';
import type { PulseCheckInviteLink } from '../../src/api/firebase/pulsecheckProvisioning/types';
import {
  isActiveAthleteInviteInScope,
  PILOT_INVITE_QR_RENDER_OPTIONS,
  renderPilotInviteQrDataUrl,
  resolvePilotInviteShareUrl,
  selectActiveReusableAthleteInvite,
} from '../../src/utils/pilotInviteQr';

const invite = (overrides: Partial<PulseCheckInviteLink> = {}): PulseCheckInviteLink => ({
  id: 'invite-1',
  inviteType: 'team-access',
  status: 'active',
  redemptionMode: 'general',
  organizationId: 'org-1',
  teamId: 'team-1',
  pilotId: 'pilot-1',
  cohortId: '',
  teamMembershipRole: 'athlete',
  token: 'token-1',
  activationUrl: 'https://pulsecheckapp.onelink.me/uT14?inviteToken=token-1',
  ...overrides,
});

const pilotScope = {
  organizationId: 'org-1',
  teamId: 'team-1',
  pilotId: 'pilot-1',
  cohortId: '',
};

test('resolves the exact saved invite URL and makes relative demo targets scannable', () => {
  const savedUrl = 'https://pulsecheckapp.onelink.me/uT14?inviteToken=stored-token&af_r=https%3A%2F%2Fpulsecheckmind.ai';
  assert.equal(resolvePilotInviteShareUrl(invite({ activationUrl: savedUrl }), 'http://localhost:3100'), savedUrl);
  assert.equal(
    resolvePilotInviteShareUrl(invite({ activationUrl: '/PulseCheck/team-invite/demo-token?demo=1' }), 'http://127.0.0.1:3100'),
    'http://127.0.0.1:3100/PulseCheck/team-invite/demo-token?demo=1'
  );
  assert.equal(
    resolvePilotInviteShareUrl(invite({ activationUrl: '', token: 'fallback token' }), 'https://pulsecheckmind.ai'),
    'https://pulsecheckmind.ai/PulseCheck/team-invite/fallback%20token'
  );
});

test('matches active athlete invites only to their exact organization, team, pilot, and cohort', () => {
  assert.equal(isActiveAthleteInviteInScope(invite(), pilotScope), true);
  assert.equal(isActiveAthleteInviteInScope(invite({ organizationId: 'org-2' }), pilotScope), false);
  assert.equal(isActiveAthleteInviteInScope(invite({ teamId: 'team-2' }), pilotScope), false);
  assert.equal(isActiveAthleteInviteInScope(invite({ pilotId: 'pilot-2' }), pilotScope), false);
  assert.equal(isActiveAthleteInviteInScope(invite({ cohortId: 'cohort-1' }), pilotScope), false);
  assert.equal(isActiveAthleteInviteInScope(invite({ teamMembershipRole: 'coach' }), pilotScope), false);
  assert.equal(isActiveAthleteInviteInScope(invite({ status: 'revoked' }), pilotScope), false);

  assert.equal(
    isActiveAthleteInviteInScope(invite({ pilotId: '', cohortId: '' }), { ...pilotScope, pilotId: '' }),
    true,
    'team-only QR scope must not accidentally select a pilot invite'
  );
});

test('selects only an untargeted reusable invite for a shared roster QR', () => {
  const selected = selectActiveReusableAthleteInvite([
    invite({ id: 'single', redemptionMode: 'single-use' }),
    invite({ id: 'targeted', targetEmail: 'athlete@example.com' }),
    invite({ id: 'revoked', status: 'revoked' }),
    invite({ id: 'shared' }),
  ], pilotScope);

  assert.equal(selected?.id, 'shared');
});

test('selects one deterministic canonical link for each exact destination', () => {
  const olderPilotLink = invite({
    id: 'pilot-older',
    token: 'pilot-older',
    createdAt: { seconds: 100 } as PulseCheckInviteLink['createdAt'],
  });
  const canonicalPilotLink = invite({
    id: 'pilot-canonical',
    token: 'pilot-canonical',
    createdAt: { seconds: 200 } as PulseCheckInviteLink['createdAt'],
  });
  const teamLink = invite({
    id: 'team-canonical',
    pilotId: '',
    cohortId: '',
    createdAt: { seconds: 300 } as PulseCheckInviteLink['createdAt'],
  });
  const cohortLink = invite({
    id: 'cohort-canonical',
    cohortId: 'cohort-1',
    createdAt: { seconds: 400 } as PulseCheckInviteLink['createdAt'],
  });
  const invites = [teamLink, olderPilotLink, cohortLink, canonicalPilotLink];

  assert.equal(selectActiveReusableAthleteInvite(invites, pilotScope)?.id, 'pilot-canonical');
  assert.equal(
    selectActiveReusableAthleteInvite(invites, { ...pilotScope, pilotId: '', cohortId: '' })?.id,
    'team-canonical'
  );
  assert.equal(
    selectActiveReusableAthleteInvite(invites, { ...pilotScope, cohortId: 'cohort-1' })?.id,
    'cohort-canonical'
  );
});

test('renders the exact resolved URL with a scan-safe quiet zone', async () => {
  let capturedValue = '';
  let capturedOptions: unknown = null;
  const result = await renderPilotInviteQrDataUrl(
    'https://pulsecheckmind.ai/PulseCheck/team-invite/token-1',
    async (value, options) => {
      capturedValue = value;
      capturedOptions = options;
      return 'data:image/png;base64,qr-test';
    }
  );

  assert.equal(capturedValue, 'https://pulsecheckmind.ai/PulseCheck/team-invite/token-1');
  assert.deepEqual(capturedOptions, PILOT_INVITE_QR_RENDER_OPTIONS);
  assert.equal(PILOT_INVITE_QR_RENDER_OPTIONS.margin, 4);
  assert.equal(result, 'data:image/png;base64,qr-test');
});
