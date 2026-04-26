import React from 'react';
import { Phone, MessageCircle, ExternalLink } from 'lucide-react';
import {
  CANONICAL_CRISIS_RESOURCES,
  type CrisisResource,
} from '../../api/firebase/pulsecheckClinicalEscalation';

// =============================================================================
// CrisisResources — surfaces 988 / Crisis Text Line / 911 prominently in
// any web context where a Tier 3 signal might be displayed.
//
// Athlete-initiated only:
//   - Each row is a tap-to-call (`tel:`) or tap-to-text (`sms:`) link.
//   - There is NO auto-dial. The athlete remains in control.
//
// iOS spec mirror:
//   The PulseCheck iOS crisis wall must mirror this layout:
//     - 988 (call + text)
//     - Crisis Text Line (text 'HOME' to 741741)
//     - 911 (call)
//   - Plus the "your team's clinician has been notified" banner.
//   - Acknowledgement required before dismiss.
// =============================================================================

interface CrisisResourcesProps {
  /** Optional team-specific resources appended to the canonical national list. */
  additionalResources?: CrisisResource[];
  /** When true, renders the "your clinician has been notified" line. */
  clinicianNotified?: boolean;
  /** Display name of the clinician (when known) — surfaces in the banner. */
  clinicianDisplayName?: string;
  /** Compact mode for in-line / banner placement; full mode for modal / wall. */
  variant?: 'compact' | 'full';
}

const CrisisResources: React.FC<CrisisResourcesProps> = ({
  additionalResources,
  clinicianNotified = false,
  clinicianDisplayName,
  variant = 'full',
}) => {
  const resources: CrisisResource[] = [
    ...CANONICAL_CRISIS_RESOURCES,
    ...(additionalResources || []),
  ];

  return (
    <div
      className={
        variant === 'full'
          ? 'rounded-2xl border border-rose-700/40 bg-rose-950/30 p-5 text-rose-50'
          : 'rounded-xl border border-rose-700/40 bg-rose-950/30 px-4 py-3 text-rose-50'
      }
      role="region"
      aria-label="Crisis resources"
    >
      <div className={variant === 'full' ? 'mb-4' : 'mb-2'}>
        <p
          className={
            variant === 'full'
              ? 'text-base font-semibold tracking-tight'
              : 'text-sm font-semibold'
          }
        >
          If you are in crisis, please reach out now.
        </p>
        {clinicianNotified && (
          <p className="mt-1 text-xs text-rose-100/85">
            {clinicianDisplayName
              ? `${clinicianDisplayName}, your team's clinician staff member, has been notified and is reviewing.`
              : "Your team's clinician staff member has been notified and is reviewing."}
          </p>
        )}
      </div>

      <ul className={variant === 'full' ? 'space-y-3' : 'space-y-2'}>
        {resources.map((resource) => (
          <li
            key={resource.id}
            className={
              variant === 'full'
                ? 'flex flex-col gap-2 rounded-xl border border-rose-700/30 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between'
                : 'flex flex-wrap items-center gap-2'
            }
          >
            <div>
              <p className="text-sm font-medium text-rose-50">{resource.label}</p>
              {variant === 'full' && (
                <p className="mt-1 text-xs text-rose-100/80">{resource.description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {resource.phone && (
                <a
                  href={`tel:${encodeURIComponent(resource.phone)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-50 transition hover:bg-rose-500/25"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call {resource.phone}
                </a>
              )}
              {resource.smsNumber && (
                <a
                  href={`sms:${encodeURIComponent(resource.smsNumber)}${
                    resource.smsBody ? `?&body=${encodeURIComponent(resource.smsBody)}` : ''
                  }`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-50 transition hover:bg-rose-500/25"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Text {resource.smsBody ? `${resource.smsBody} ` : ''}
                  {resource.smsNumber}
                </a>
              )}
              {resource.url && variant === 'full' && (
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-rose-100/80 hover:text-rose-50"
                >
                  Learn more
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      {variant === 'full' && (
        <p className="mt-4 text-[11px] leading-relaxed text-rose-100/70">
          Pulse is not a clinical service and is not a substitute for emergency care.
          Pulse does not initiate contact with 988, 911, or any emergency line on your behalf —
          you remain in control of any call or text.
        </p>
      )}
    </div>
  );
};

export default CrisisResources;
