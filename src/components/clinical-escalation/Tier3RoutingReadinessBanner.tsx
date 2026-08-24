import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import {
  resolveDesignatedClinician,
  teamHasOperationalEscalationContact,
  type DesignatedClinician,
} from '../../api/firebase/pulsecheckClinicalEscalation';

// =============================================================================
// Tier3RoutingReadinessBanner checks a team's urgent support routing. It shows
// on pilot detail pages so admins know who will receive urgent athlete alerts.
//
// Status:
//   GREEN: A support contact can receive email and text alerts.
//   AMBER: A support contact can receive email alerts only.
//   RED: The team needs a support contact with an email address.
//
// This banner is informational. Pilot actions remain available in every state.
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
  const [clinician, setClinician] = useState<DesignatedClinician | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStatus('loading');
      setClinician(null);
      try {
        const validation = await teamHasOperationalEscalationContact(teamId);
        if (cancelled) return;
        if (!validation.ready) {
          setStatus('red');
          return;
        }
        const resolved = await resolveDesignatedClinician(teamId);
        if (cancelled) return;
        setClinician(resolved);
        if (!resolved) {
          setStatus('red');
          return;
        }
        setStatus(resolved.phone ? 'green' : 'amber');
      } catch {
        if (!cancelled) {
          setStatus('error');
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
          <p className="text-sm font-semibold">Checking urgent support routing…</p>
          <p className="text-xs text-zinc-500">Confirming who will receive urgent athlete alerts.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={containerClass(variant, 'border-amber-700/50 bg-amber-950/30 text-amber-100')}>
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <p className="text-sm font-semibold">Urgent support status is unavailable</p>
          <p className="mt-1 text-xs text-amber-200">
            Refresh this page to confirm who will receive urgent athlete alerts.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'red') {
    return (
      <div className={containerClass(variant, 'border-rose-700/60 bg-rose-950/40 text-rose-100')}>
        <ShieldAlert className="h-5 w-5 shrink-0 text-rose-300" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Urgent support routing needs an owner</p>
          <p className="mt-1 text-xs text-rose-100">
            Choose a support contact with an email address so urgent athlete alerts reach someone who can respond.
          </p>
          {membershipsHref && (
            <Link
              href={membershipsHref}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-50 transition hover:bg-rose-500/25"
            >
              Set support contact
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
          <p className="text-sm font-semibold">Urgent alerts are set up for email</p>
          <p className="mt-1 text-xs text-amber-100">
            {supportContactLabel(clinician)} will receive urgent athlete alerts by email. Add a mobile number so they can receive text alerts too.
          </p>
          {membershipsHref && (
            <Link
              href={membershipsHref}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-50 transition hover:bg-amber-500/25"
            >
              Add mobile number
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
        <p className="text-sm font-semibold">Urgent alerts are ready</p>
        <p className="mt-1 text-xs text-emerald-100">
          {supportContactLabel(clinician)} will receive urgent athlete alerts by email and text. Athletes will also see call and text options for 988, Crisis Text Line, and 911, plus a message that their support contact was alerted.
        </p>
      </div>
    </div>
  );
};

const supportContactLabel = (clinician: DesignatedClinician | null): string => {
  if (!clinician) return 'The team\'s support contact';
  return clinician.displayName || clinician.email;
};

const containerClass = (variant: 'compact' | 'full', tone: string) =>
  variant === 'compact'
    ? `flex items-start gap-3 rounded-xl border ${tone} px-3 py-2`
    : `flex items-start gap-3 rounded-2xl border ${tone} px-4 py-3`;

export default Tier3RoutingReadinessBanner;
