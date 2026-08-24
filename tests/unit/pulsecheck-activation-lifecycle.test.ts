import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { shouldAdvancePulseCheckParentToReadyForActivation } from '../../src/utils/pulseCheckActivationLifecycle';

test('admin activation links advance only pre-activation parent states', () => {
  for (const status of ['draft', 'provisioning', 'ready-for-activation']) {
    assert.equal(shouldAdvancePulseCheckParentToReadyForActivation(status), true, status);
  }

  for (const status of ['active', 'paused', 'archived', 'implementation-hold', 'unknown', '', null, undefined]) {
    assert.equal(shouldAdvancePulseCheckParentToReadyForActivation(status), false, String(status));
  }
});

test('pilot dashboard keeps athlete invite sharing behind active parent scopes', () => {
  const dashboardSource = readFileSync(
    path.resolve(process.cwd(), 'src/pages/admin/pulsecheckPilotDashboard/[pilotId].tsx'),
    'utf8'
  );

  assert.match(
    dashboardSource,
    /const inviteParentScopesAreActive = Boolean\([\s\S]*?detail\.organization\.status === 'active'[\s\S]*?detail\.team\.status === 'active'/
  );
  assert.match(
    dashboardSource,
    /if \(!detail \|\| !inviteParentScopesAreActive \|\| !selectedPilotEnrollmentAcceptance\?\.acceptsEnrollment\) return null;/
  );
  assert.match(dashboardSource, /invite=\{inviteParentScopesAreActive \? qrInvite : null\}/);
  assert.match(dashboardSource, /Team activation is incomplete/);
  assert.match(dashboardSource, /data-testid="pilot-invite-finish-team-activation"/);
  assert.match(dashboardSource, /data-testid="pilot-team-activation-modal"/);
  assert.match(dashboardSource, /Finish activation before athletes join/);
  assert.match(dashboardSource, /data-testid="pilot-team-activation-modal-send-email"/);
  assert.match(dashboardSource, /data-testid="pilot-team-activation-modal-copy-link"/);
  assert.match(dashboardSource, /data-testid="pilot-team-activation-modal-open-provisioning"/);
  assert.match(dashboardSource, /Send activation email/);
  assert.match(dashboardSource, /Copy activation link/);
});
