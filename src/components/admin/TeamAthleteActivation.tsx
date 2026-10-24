import React, { useState } from 'react';
import AthleteActivationQR from './AthleteActivationQR';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';

/** Team-only enrollment uses the same authenticated invite service as cohorts. */
export default function TeamAthleteActivation({ organizationId, teamId, label, active, createdByUserId, createdByEmail }: {
  organizationId: string; teamId: string; label: string; active: boolean;
  createdByUserId: string; createdByEmail: string;
}) {
  const [distribution, setDistribution] = useState<'program' | 'pulsecheck' | 'athleticmind'>('program');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function prepare() {
    setBusy(true); setError('');
    try {
      const id = await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId, teamId, teamMembershipRole: 'athlete', redemptionMode: 'general',
        distributionBrand: distribution === 'program' ? undefined : distribution,
        // Preserve invitations already printed or shared.
        revokeExistingMatchingLinks: false,
        createdByUserId, createdByEmail,
      });
      setToken(id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to prepare the team invitation.'); }
    finally { setBusy(false); }
  }
  return <div>
    <p>One reusable invitation for athletes joining {label}. No pilot or cohort is required.</p>
    {!active && <p role="status">Activation pending. Activate the organization and team before creating an athlete invitation.</p>}
    <label className="pcp-flbl" htmlFor={`team-install-${teamId}`}>App to install</label>
    <select id={`team-install-${teamId}`} className="pcp-finp pcp-select" value={distribution}
      disabled={busy || !!token} onChange={e => setDistribution(e.target.value as typeof distribution)}>
      <option value="program">Program default</option>
      <option value="pulsecheck">PulseCheck — temporary installation</option>
      <option value="athleticmind">AthleticMind</option>
    </select>
    <p>The installation choice does not change this program’s branding, care route, or permissions. Changing the app later requires a new QR on your slides; printed QR codes keep their original app destination.</p>
    {token ? <AthleteActivationQR token={token} label={label} /> : <button type="button"
      className="pcp-ab pcp-ab-t" disabled={!active || busy} onClick={() => void prepare()}>
      {busy ? 'Preparing…' : 'Create team activation invitation'}
    </button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
