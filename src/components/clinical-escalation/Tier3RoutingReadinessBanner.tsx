import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import {
  resolveDesignatedClinician,
  teamHasOperationalEscalationContact,
  type DesignatedClinician,
} from '../../api/firebase/pulsecheckClinicalEscalation';

// =============================================================================
// Tier3RoutingReadinessBanner — pre-flight check for a team's clinical
// escalation routing. Shows on pilot detail pages so admins know whether
// Tier 3 signals will reach a designated clinician.
//
// Status:
//   GREEN — clinician with email on file. Tier 3 routing is operational.
//   AMBER — clinician membership exists but missing phone (SMS won't fire).
//   RED   — no active clinician membership with an email. Tier 3 will hit
//           a 409 from `record-clinical-escalation`. Pilot should not
//           activate until this is fixed.
//
// This banner is intentionally non-blocking — it does not gate anything.
// Operators can choose to proceed without a clinician (e.g., during early
// configuration) but the banner makes the gap visible.
// =============================================================================

type ReadinessStatus = 'loading' | 'red' | 'amber' | 'green' | 'error';

interface Tier3RoutingReadinessBannerProps {
  teamId: string;
  /** Optional addLink to direct admins to the membership editor (provisioning flow). */
  membershipsHref?: string;
  /** Compact variant for inline placement on dense pages. */
  variant?: 'compact' | 'full';
}

const Tier3RoutingReadinessBanner: React.FC<Tier3RoutingReadinessBannerProps> = ({
  teamId,
  membershipsHref,
  variant = 'full',
}) => {
  const [status, setStatus] = useState<ReadinessStatus>('loading');
  const [reason, setReason] = useState<string | null>(null);
  const [clinician, setClinician] = useState<DesignatedClinician | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStatus('loading');
      setReason(null);
      setClinician(null);
      try {
        const validation = await teamHasOperationalEscalationContact(teamId);
        if (cancelled) return;
        if (!validation.ready) {
          setStatus('red');
          setReason(validation.reason || 'No active clinician membership with email on file.');
          return;
        }
        const resolved = await resolveDesignatedClinician(teamId);
        if (cancelled) return;
        setClinician(resolved);
        if (!resolved) {
          setStatus('red');
          setReason('Clinician resolved unexpectedly empty. Recheck the team membership configuration.');
          return;
        }
        setStatus(resolved.phone ? 'green' : 'amber');
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setReason(err instanceof Error ? err.message : 'Could not check Tier 3 routing readiness.');
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (status === 'loading') {
    return (
      <div className={containerClass(variant, 'border-zinc-700 bg-black/30 text-zinc-300')}>
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <div>
          <p className="text-sm font-semibold">Checking Tier 3 routing…</p>
          <p className="text-xs text-zinc-500">Looking up the team's designated clinician staff member.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={containerClass(variant, 'border-amber-700/50 bg-amber-950/30 text-amber-100')}>
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <p className="text-sm font-semibold">Could not check Tier 3 routing readiness</p>
          <p className="mt-1 text-xs text-amber-200/80">{reason || 'Unknown error.'}</p>
        </div>
      </div>
    );
  }

  if (status === 'red') {
    return (
      <div className={containerClass(variant, 'border-rose-700/60 bg-rose-950/40 text-rose-100')}>
        <ShieldAlert className="h-5 w-5 shrink-0 text-rose-300" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Tier 3 routing not configured</p>
          <p className="mt-1 text-xs text-rose-100/85">
            {reason} Add a team membership with role <code className="rounded bg-black/40 px-1 text-rose-50">clinician</code> and an email address before this pilot activates.
            Without it, a critical-tier escalation cannot reach a human and the route will return 409.
          </p>
          {membershipsHref && (
            <Link
              href={membershipsHref}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-50 transition hover:bg-rose-500/25"
            >
              Add a clinician staff member
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (status === 'amber') {
    return (
      <div className={containerClass(variant, 'border-amber-700/50 bg-amber-950/30 text-amber-100')}>
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Tier 3 routing partial — email only</p>
          <p className="mt-1 text-xs text-amber-100/85">
            {clinicianLabel(clinician)} will receive escalation emails, but no phone number is on file so SMS will not fire.
            Add a phone to harden the route — text reaches a clinician faster than email when seconds matter.
          </p>
          {membershipsHref && (
            <Link
              href={membershipsHref}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-50 transition hover:bg-amber-500/25"
            >
              Update clinician contact
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  // green
  return (
    <div className={containerClass(variant, 'border-emerald-700/40 bg-emerald-950/25 text-emerald-100')}>
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
      <div className="flex-1">
        <p className="text-sm font-semibold">Tier 3 routing operational</p>
        <p className="mt-1 text-xs text-emerald-100/85">
          {clinicianLabel(clinician)} will receive critical-tier alerts by email and SMS. The athlete's app will gate to the crisis-resource wall and inform them the clinician has been notified.
        </p>
      </div>
    </div>
  );
};

const clinicianLabel = (clinician: DesignatedClinician | null): string => {
  if (!clinician) return 'The team\'s clinician';
  return clinician.displayName || clinician.email;
};

const containerClass = (variant: 'compact' | 'full', tone: string) =>
  variant === 'compact'
    ? `flex items-start gap-3 rounded-xl border ${tone} px-3 py-2`
    : `flex items-start gap-3 rounded-2xl border ${tone} px-4 py-3`;

export default Tier3RoutingReadinessBanner;
