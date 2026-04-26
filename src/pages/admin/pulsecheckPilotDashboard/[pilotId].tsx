import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useDispatch } from 'react-redux';
import {
  Activity,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Clipboard,
  Database,
  ExternalLink,
  FileText,
  FlaskConical,
  MonitorPlay,
  QrCode,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users2,
  X,
} from 'lucide-react';
import AdminRouteGuard from '../../../components/auth/AdminRouteGuard';
import { LocalFirebaseModeButton } from '../../../components/admin/pilot-dashboard/LocalFirebaseModeButton';
import NoraMetricHelpButton from '../../../components/admin/pilot-dashboard/NoraMetricHelpButton';
import PilotAthleteCommunicationModal, {
  type PilotAthleteCommunicationChannel,
  type PilotAthleteCommunicationPreview,
  type PilotAthleteCommunicationRecord,
} from '../../../components/admin/pilot-dashboard/PilotAthleteCommunicationModal';
import PilotAthleteTransferModal from '../../../components/admin/pilot-dashboard/PilotAthleteTransferModal';
import { PilotInviteQrModal } from '../../../components/admin/pilot-dashboard/PilotInviteQrModal';
import { StaffPilotSurveyModal } from '../../../components/admin/pilot-dashboard/StaffPilotSurveyModal';
import type { PilotDashboardMetricExplanationKey } from '../../../components/admin/pilot-dashboard/noraMetricCatalog';
import { db, getFirebaseModeRequestHeaders } from '../../../api/firebase/config';
import { pulseCheckPilotDashboardService } from '../../../api/firebase/pulsecheckPilotDashboard/service';
import { pulseCheckProvisioningService } from '../../../api/firebase/pulsecheckProvisioning/service';
import { getDefaultPulseCheckRequiredConsents } from '../../../api/firebase/pulsecheckProvisioning/types';
import type {
  PulseCheckInviteActivity,
  PulseCheckInviteLink,
  PulseCheckPilot,
  PulseCheckPilotCohort,
  PulseCheckPilotEnrollmentStatus,
  PulseCheckRequiredConsentDocument,
  PulseCheckTeam,
} from '../../../api/firebase/pulsecheckProvisioning/types';
import { analyzePulseCheckInviteOneLink, buildPulseCheckTeamInviteWebUrl, isPulseCheckInviteOneLink } from '../../../utils/pulsecheckInviteLinks';
import { useUser } from '../../../hooks/useUser';
import Tier3RoutingReadinessBanner from '../../../components/clinical-escalation/Tier3RoutingReadinessBanner';
import { showToast } from '../../../redux/toastSlice';
import type {
  PilotDashboardDetail,
  PilotHypothesisAssistSuggestion,
  PilotHypothesisConfidenceLevel,
  PilotHypothesisStatus,
  PilotResearchReadoutClaim,
  PilotResearchReadout,
  PilotResearchReadoutBaselineMode,
  PilotResearchReadoutReviewState,
  PilotResearchReadoutSection,
  PilotResearchReadoutSectionResolution,
  PulseCheckPilotInviteConfig,
  PulseCheckPilotHypothesis,
} from '../../../api/firebase/pulsecheckPilotDashboard/types';

type DetailTab = 'overview' | 'engine-health' | 'findings' | 'hypotheses' | 'research-readout';
type InviteCreationMode = 'single-use' | 'general';
type InviteActivityParticipantRow = {
  key: string;
  email: string;
  emailSource: PulseCheckInviteActivity['emailSource'];
  sessionId: string;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  lastEventType: PulseCheckInviteActivity['eventType'];
  lastError: string;
  userAgent: string;
  token: string;
  hasPageView: boolean;
  hasRedeemSucceeded: boolean;
  hasRedeemFailed: boolean;
  hasFollowUpRequest: boolean;
  needsFollowUp: boolean;
};
type AthleteCommunicationPreviewModalState = {
  athlete: PilotDashboardDetail['rosterAthletes'][number];
  channel: PilotAthleteCommunicationChannel;
  preview: PilotAthleteCommunicationPreview | null;
  loading: boolean;
  sending: boolean;
  error: string | null;
};
type AthleteTransferModalState = {
  athlete: PilotDashboardDetail['rosterAthletes'][number];
  loading: boolean;
  saving: boolean;
  error: string | null;
  teams: PulseCheckTeam[];
  pilots: PulseCheckPilot[];
  cohorts: PulseCheckPilotCohort[];
  selectedTeamId: string;
  selectedPilotId: string;
  selectedCohortId: string;
};

const STUDY_MODE_DISCLOSURE_PACKAGE_META: Record<PulseCheckPilot['studyMode'], { label: string; actionLabel: string }> = {
  research: {
    label: 'Research study disclosures',
    actionLabel: 'Reset To Research Package',
  },
  pilot: {
    label: 'Pilot disclosures',
    actionLabel: 'Reset To Pilot Package',
  },
  operational: {
    label: 'Operational disclosures',
    actionLabel: 'Reset To Operational Package',
  },
};

const STATUS_OPTIONS: Array<{ value: PilotHypothesisStatus; label: string }> = [
  { value: 'not-enough-data', label: 'Not enough data' },
  { value: 'promising', label: 'Promising' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'not-supported', label: 'Not supported' },
];

const CONFIDENCE_OPTIONS: Array<{ value: PilotHypothesisConfidenceLevel; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'engine-health', label: 'Engine Health' },
  { id: 'findings', label: 'Findings' },
  { id: 'hypotheses', label: 'Hypotheses' },
  { id: 'research-readout', label: 'Research Readout' },
];

const READOUT_REVIEW_STATE_OPTIONS: Array<{ value: PilotResearchReadoutReviewState; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'approved', label: 'Approved' },
  { value: 'superseded', label: 'Superseded' },
];

const READOUT_SECTION_RESOLUTION_OPTIONS: Array<{ value: PilotResearchReadoutSectionResolution; label: string }> = [
  { value: 'accepted', label: 'Accepted' },
  { value: 'revised', label: 'Revised' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'carry-forward', label: 'Carry Forward' },
];

type InvitePreviewField =
  | 'welcomeHeadline'
  | 'welcomeBody'
  | 'existingAthleteInstructions'
  | 'newAthleteInstructions'
  | 'wearableRequirements'
  | 'baselineExpectations'
  | 'supportName'
  | 'supportEmail'
  | 'supportPhone'
  | 'iosAppUrl'
  | 'androidAppUrl';

const cloneHypothesis = (hypothesis: PulseCheckPilotHypothesis): PulseCheckPilotHypothesis => ({ ...hypothesis });
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatAverage = (value: number) => value.toFixed(1);
const toScopedPercent = (numerator: number, denominator: number) => (denominator > 0 ? (numerator / denominator) * 100 : 0);
const normalizeInvitePreviewValue = (value: string) => value.replace(/\r\n/g, '\n').trim();
const inviteRedemptionModeClassName = (mode?: InviteCreationMode) =>
  mode === 'general'
    ? 'border border-sky-400/20 bg-sky-400/10 text-sky-100'
    : 'border border-white/10 bg-white/5 text-zinc-200';
const formatInviteUsageCount = (count?: number) => {
  const safeCount = Math.max(0, Number(count || 0));
  return `Used ${safeCount} time${safeCount === 1 ? '' : 's'}`;
};
const athleteRosterStatusRank = (status?: PulseCheckPilotEnrollmentStatus | null) => {
  if (status === 'active') return 0;
  if (status === 'pending-consent') return 1;
  return 2;
};
const athleteEnrollmentBadgePresentation = (status?: PulseCheckPilotEnrollmentStatus | null) => {
  if (status === 'active') {
    return {
      label: 'Enrolled',
      className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    };
  }

  if (status === 'pending-consent') {
    return {
      label: 'Pending consent',
      className: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    };
  }

  return {
    label: 'Not enrolled',
    className: 'border-white/10 bg-white/5 text-zinc-300',
  };
};
const getInviteShareOrigin = () =>
  (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai'
  ).replace(/\/+$/, '');
const resolveInviteShareUrl = (invite?: PulseCheckInviteLink | null) => {
  if (!invite) return '';
  return invite.activationUrl || buildPulseCheckTeamInviteWebUrl(invite.token || invite.id, getInviteShareOrigin());
};
const analyzeInviteShareTarget = (invite?: PulseCheckInviteLink | null) => {
  if (!invite) {
    return analyzePulseCheckInviteOneLink('');
  }
  return analyzePulseCheckInviteOneLink(resolveInviteShareUrl(invite));
};
const normalizeRequiredConsentDraft = (consent: PulseCheckRequiredConsentDocument, index: number): PulseCheckRequiredConsentDocument => ({
  id: consent.id.trim() || `consent-${index + 1}`,
  title: consent.title.trim(),
  body: consent.body.trim(),
  version: consent.version.trim() || 'v1',
});
const toDateValue = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  return null;
};
const toInputDateValue = (value: Date | null) => {
  if (!value) return '';
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatTimeValue = (value: any) => {
  const nextDate = toDateValue(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleString();
  }
  return nextDate ? nextDate.toLocaleString() : 'Not available';
};
const getTimeValueMs = (value: any) => {
  const nextDate = toDateValue(value);
  return nextDate ? nextDate.getTime() : null;
};
const METRICS_STATUS_STALE_AFTER_MS = 1000 * 60 * 60 * 24;
const isHealthyMetricsStatus = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return ['ok', 'success', 'succeeded'].includes(normalized);
};
const formatMetricsStatusLabel = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'No status recorded yet';
  return normalized
    .split(/[_-\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};
const formatMetricsDuration = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)} sec`;
  return `${(value / 60_000).toFixed(1)} min`;
};

type MetricsOpsScopeStatus = {
  status?: string;
  startedAt?: any;
  completedAt?: any;
  durationMs?: number | null;
  lastError?: string | null;
} | null;

type StudyMetricsStatusModalProps = {
  isOpen: boolean;
  pilotName: string;
  state: 'healthy' | 'stale' | 'broken';
  refreshScope: MetricsOpsScopeStatus;
  repairScope: MetricsOpsScopeStatus;
  onClose: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

const StudyMetricsStatusModal: React.FC<StudyMetricsStatusModalProps> = ({
  isOpen,
  pilotName,
  state,
  refreshScope,
  repairScope,
  onClose,
  onRefresh,
  refreshing = false,
}) => {
  if (!isOpen) return null;

  const stateTone =
    state === 'broken'
      ? {
          badgeClassName: 'border-rose-400/25 bg-rose-400/10 text-rose-100',
          label: 'Needs attention',
          helper: 'The last metrics refresh or repair recorded an issue. Open this panel when the study metrics look missing, stale, or inconsistent.',
        }
      : state === 'stale'
        ? {
            badgeClassName: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
            label: 'May be stale',
            helper: 'The latest refresh status is old or missing, so the pilot summary may not reflect the newest records yet.',
          }
        : {
            badgeClassName: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
            label: 'Healthy',
            helper: 'The pilot summary has a recent successful refresh on record.',
          };

  const scopeCards = [
    {
      key: 'refresh',
      label: 'Last metrics refresh',
      helper: 'This is the job that recalculates the pilot-level study metrics summary from enrollment, survey, adherence, and care records.',
      scope: refreshScope,
    },
    {
      key: 'repair',
      label: 'Last repair pass',
      helper: 'This is the follow-up repair pass that runs when the metrics summary needs cleanup or correction.',
      scope: repairScope,
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[130] flex items-center justify-center bg-[#03060d]/88 px-4 py-6 backdrop-blur-xl"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-4xl overflow-hidden rounded-[30px] border border-white/10 bg-[#0a0f18]/95 shadow-[0_28px_120px_rgba(0,0,0,0.45)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-metrics-status-title"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.1),_transparent_26%)]" />
          <div className="relative border-b border-white/10 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Admin status</div>
                <h2 id="study-metrics-status-title" className="mt-2 text-2xl font-semibold text-white">
                  Study Metrics Status
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Study metrics are pilot-level summaries calculated from the underlying enrollment, survey, adherence,
                  and care records. This panel shows when that summary last refreshed for {pilotName}.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Close study metrics status"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-2 text-xs font-medium ${stateTone.badgeClassName}`}>
                {stateTone.label}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
                Admin-only metrics diagnostics
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-400">{stateTone.helper}</p>
          </div>

          <div className="relative max-h-[78vh] overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {scopeCards.map(({ key, label, helper, scope }) => {
                const hasIssue = Boolean(scope?.lastError) || (scope?.status ? !isHealthyMetricsStatus(scope.status) : false);
                return (
                  <div key={key} className="rounded-3xl border border-white/10 bg-[#0f1522] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</div>
                        <div className="mt-2 text-lg font-semibold text-white">{formatMetricsStatusLabel(scope?.status)}</div>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1.5 text-[11px] ${
                          hasIssue
                            ? 'border-rose-400/25 bg-rose-400/10 text-rose-100'
                            : isHealthyMetricsStatus(scope?.status)
                              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                              : 'border-amber-400/25 bg-amber-400/10 text-amber-100'
                        }`}
                      >
                        {hasIssue ? 'Needs review' : isHealthyMetricsStatus(scope?.status) ? 'Healthy' : 'Waiting on status'}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-zinc-400">{helper}</p>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Started</div>
                        <div className="mt-2 text-sm text-white">{formatTimeValue(scope?.startedAt)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Completed</div>
                        <div className="mt-2 text-sm text-white">{formatTimeValue(scope?.completedAt)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Duration</div>
                        <div className="mt-2 text-sm text-white">{formatMetricsDuration(scope?.durationMs)}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Last recorded issue</div>
                      <div className="mt-2 text-sm text-white">{scope?.lastError || 'No recorded issue'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
            <div className="text-sm text-zinc-400">Use refresh if the study metrics look missing or obviously behind the latest pilot activity.</div>
            <div className="flex items-center gap-3">
              {onRefresh ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing Metrics...' : 'Refresh Metrics Now'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
const formatInviteActivityEventLabel = (value?: PulseCheckInviteActivity['eventType']) =>
  (value || 'page-view')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
const inviteActivityStatusPresentation = (participant: InviteActivityParticipantRow) => {
  if (participant.hasRedeemSucceeded) {
    return {
      label: 'Joined',
      className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    };
  }

  if (participant.needsFollowUp) {
    return {
      label: 'Needs follow-up',
      className: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    };
  }

  if (participant.email) {
    return {
      label: 'Identified scan',
      className: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    };
  }

  return {
    label: 'Anonymous scan',
    className: 'border-white/10 bg-white/5 text-zinc-200',
  };
};

const INVITE_PREVIEW_FIELDS: Array<{ field: InvitePreviewField; label: string }> = [
  { field: 'welcomeHeadline', label: 'Headline' },
  { field: 'welcomeBody', label: 'Welcome copy' },
  { field: 'existingAthleteInstructions', label: 'Existing athlete instructions' },
  { field: 'newAthleteInstructions', label: 'New athlete instructions' },
  { field: 'wearableRequirements', label: 'Wearable requirements' },
  { field: 'baselineExpectations', label: 'Baseline expectations' },
  { field: 'supportName', label: 'Support name' },
  { field: 'supportEmail', label: 'Support email' },
  { field: 'supportPhone', label: 'Support phone' },
  { field: 'iosAppUrl', label: 'iOS app link' },
  { field: 'androidAppUrl', label: 'Android app link' },
];

const buildFallbackInvitePreviewConfig = (detail: PilotDashboardDetail): PulseCheckPilotInviteConfig => ({
  id: detail.pilot.id,
  pilotId: detail.pilot.id,
  organizationId: detail.organization.id,
  teamId: detail.team.id,
  welcomeHeadline: `Welcome to ${detail.pilot.name || 'your PulseCheck pilot'}`,
  welcomeBody: `You are joining ${detail.team.displayName} inside ${detail.organization.displayName}. This page explains how to get the app set up, what you need to complete, and how to move into the pilot without confusion.`,
  existingAthleteInstructions:
    'Open the Pulse app and sign in with your existing account.\nConfirm the team and pilot show up in your account.\nComplete only any pilot-specific consent or baseline step that appears.',
  newAthleteInstructions:
    'Download the Pulse app on your phone.\nSign in with the invited email and complete athlete onboarding.\nAccept the required consent prompts and finish your baseline setup.',
  wearableRequirements:
    'Connect the wearable or health data source required for this pilot as early as possible. If no wearable is available yet, follow the fallback instructions from staff.',
  baselineExpectations:
    'Complete the baseline path promptly after joining so the pilot can start collecting usable signal and place you into the correct workflow.',
  supportName: '',
  supportEmail: '',
  supportPhone: '',
  iosAppUrl: 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729',
  androidAppUrl: 'https://play.google.com/store/apps/details?id=ai.fitwithpulse.pulse',
  createdAt: null,
  updatedAt: null,
});

const cloneResearchReadout = (readout: PilotResearchReadout): PilotResearchReadout => ({
  ...readout,
  readiness: readout.readiness.map((gate) => ({ ...gate })),
  sections: readout.sections.map((section) => ({
    ...section,
    citations: section.citations.map((citation) => ({ ...citation, hypothesisCodes: [...citation.hypothesisCodes], limitationKeys: [...citation.limitationKeys] })),
    claims: section.claims.map((claim) => ({ ...claim, evidenceSources: [...claim.evidenceSources] })),
  })),
  frozenEvidenceFrame: readout.frozenEvidenceFrame ? { ...readout.frozenEvidenceFrame } : undefined,
});

const RESEARCH_SECTION_ORDER: PilotResearchReadoutSection['sectionKey'][] = [
  'pilot-summary',
  'hypothesis-mapper',
  'findings-interpreter',
  'research-notes',
  'limitations',
];

const RESEARCH_SECTION_PRESENTATION: Record<
  PilotResearchReadoutSection['sectionKey'],
  { eyebrow: string; title: string; helper: string }
> = {
  'pilot-summary': {
    eyebrow: 'Research Brief',
    title: 'Pilot Summary',
    helper: 'Start here for the plain-language read of what happened in this pilot frame and how much evidence is actually in play.',
  },
  'hypothesis-mapper': {
    eyebrow: 'Hypothesis Map',
    title: 'Hypothesis Mapper',
    helper: 'This is where the draft connects pilot evidence back to the hypotheses you said mattered before the pilot started.',
  },
  'findings-interpreter': {
    eyebrow: 'Interpretation',
    title: 'Findings Interpreter',
    helper: 'Read this as a disciplined interpretation layer, not as proof. Stronger sections should still stay denominator-aware and caveated.',
  },
  'research-notes': {
    eyebrow: 'Research Notes',
    title: 'Candidate Publishable Findings',
    helper: 'Treat these as leads worth discussing, not finished conclusions. Strong candidates still need stronger validation and replication.',
  },
  limitations: {
    eyebrow: 'Limitations',
    title: 'Limitations',
    helper: 'The most useful readout is honest about what weakens confidence, narrows interpretation, or blocks causal claims altogether.',
  },
};

const hypothesisStatusLabel = (value: PilotHypothesisStatus) =>
  STATUS_OPTIONS.find((option) => option.value === value)?.label || value;

const hypothesisStatusClassName = (value: PilotHypothesisStatus) => {
  switch (value) {
    case 'promising':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
    case 'mixed':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-100';
    case 'not-supported':
      return 'border-rose-400/30 bg-rose-400/10 text-rose-100';
    case 'not-enough-data':
    default:
      return 'border-white/10 bg-white/5 text-zinc-300';
  }
};

const confidenceLabel = (value: PilotHypothesisConfidenceLevel) =>
  CONFIDENCE_OPTIONS.find((option) => option.value === value)?.label || value;

const confidenceClassName = (value: PilotHypothesisConfidenceLevel) => {
  switch (value) {
    case 'high':
      return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100';
    case 'medium':
      return 'border-blue-400/30 bg-blue-400/10 text-blue-100';
    case 'low':
    default:
      return 'border-white/10 bg-white/5 text-zinc-300';
  }
};

const formatClaimTypeLabel = (value: PilotResearchReadoutClaim['claimType']) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const claimTypeClassName = (value: PilotResearchReadoutClaim['claimType']) => {
  switch (value) {
    case 'observed':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
    case 'inferred':
      return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100';
    case 'speculative':
    default:
      return 'border-amber-400/30 bg-amber-400/10 text-amber-100';
  }
};

const formatBaselineModeLabel = (value: PilotResearchReadoutBaselineMode) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatReadinessStatusLabel = (value: PilotResearchReadoutSection['readinessStatus']) =>
  value === 'suppressed' ? 'Suppressed' : 'Ready';

const OUTCOME_CARD_ORDER = ['enrollment', 'adherence', 'escalations', 'speedToCare', 'athleteTrust', 'athleteNps'] as const;
const OUTCOME_CARD_PRESENTATION: Record<typeof OUTCOME_CARD_ORDER[number], { label: string; help: string }> = {
  enrollment: { label: 'Enrollment', help: 'Enrollment complete rate' },
  adherence: { label: 'Adherence', help: 'Full-day adherence rate' },
  escalations: { label: 'Care Escalations', help: 'Pilot care-escalation volume' },
  speedToCare: { label: 'Speed to Care', help: 'Median minutes to handoff initiated' },
  athleteTrust: { label: 'Athlete Trust', help: 'Average trust score' },
  athleteNps: { label: 'Athlete NPS', help: 'Average recommendation score' },
};

type SurveyMetricKey = 'athleteTrust' | 'coachTrust' | 'clinicianTrust' | 'athleteNps' | 'coachNps' | 'clinicianNps';

const SURVEY_METRIC_CARDS: Array<{
  key: SurveyMetricKey;
  label: string;
  helpKey: PilotDashboardMetricExplanationKey;
  accentClassName: string;
}> = [
  { key: 'athleteTrust', label: 'Athlete Trust', helpKey: 'athlete-trust', accentClassName: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100' },
  { key: 'coachTrust', label: 'Coach Trust', helpKey: 'coach-trust', accentClassName: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' },
  { key: 'clinicianTrust', label: 'Clinician Trust', helpKey: 'clinician-trust', accentClassName: 'border-violet-400/20 bg-violet-400/10 text-violet-100' },
  { key: 'athleteNps', label: 'Athlete NPS', helpKey: 'athlete-nps', accentClassName: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100' },
  { key: 'coachNps', label: 'Coach NPS', helpKey: 'coach-nps', accentClassName: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' },
  { key: 'clinicianNps', label: 'Clinician NPS', helpKey: 'clinician-nps', accentClassName: 'border-violet-400/20 bg-violet-400/10 text-violet-100' },
];

const RECOMMENDATION_CONSUMER_ORDER = ['profile', 'nora', 'coach', 'protocol_planner', 'ops', 'research'] as const;
const RECOMMENDATION_CONSUMER_LABELS: Record<typeof RECOMMENDATION_CONSUMER_ORDER[number], string> = {
  profile: 'Profile',
  nora: 'Nora',
  coach: 'Coach',
  protocol_planner: 'Protocol Planner',
  ops: 'Ops',
  research: 'Research',
};

const formatOutcomeValue = (metricKey: typeof OUTCOME_CARD_ORDER[number], metrics: PilotDashboardDetail['outcomeMetrics'] | null | undefined) => {
  if (!metrics) return 'No study metrics yet';
  switch (metricKey) {
    case 'enrollment':
      return `${metrics.enrollmentRate.toFixed(1)}%`;
    case 'adherence':
      return `${metrics.adherenceRate.toFixed(1)}%`;
    case 'escalations':
      return `${metrics.escalationsTotal}`;
    case 'speedToCare':
      return metrics.medianMinutesToCare !== null ? `${metrics.medianMinutesToCare.toFixed(1)} min` : 'No escalations yet';
    case 'athleteTrust':
      return metrics.athleteTrust !== null ? metrics.athleteTrust.toFixed(1) : 'Not enough responses yet';
    case 'athleteNps':
      return metrics.athleteNps !== null ? metrics.athleteNps.toFixed(1) : 'Not enough responses yet';
    default:
      return 'No study metrics yet';
  }
};

const formatOutcomeSubtext = (
  metricKey: typeof OUTCOME_CARD_ORDER[number],
  metrics: PilotDashboardDetail['outcomeMetrics'] | null | undefined,
  diagnostics: PilotDashboardDetail['outcomeDiagnostics'] | null | undefined,
  enrollmentCount?: { enrolledCount: number; totalCount: number } | null
) => {
  if (!metrics) return '';
  const surveySummary =
    metricKey === 'athleteTrust'
      ? diagnostics?.athleteTrust
      : metricKey === 'athleteNps'
        ? diagnostics?.athleteNps
        : null;
  switch (metricKey) {
    case 'enrollment':
      return enrollmentCount
        ? `${enrollmentCount.enrolledCount} of ${enrollmentCount.totalCount} fully enrolled · ${metrics.consentCompletionRate.toFixed(1)}% consent completion`
        : `${metrics.consentCompletionRate.toFixed(1)}% consent completion`;
    case 'adherence':
      return `${metrics.dailyCheckInRate.toFixed(1)}% check-ins, ${metrics.assignmentCompletionRate.toFixed(1)}% assignments`;
    case 'escalations':
      return `${metrics.escalationsTier1} coach review, ${metrics.escalationsTier2} T2, ${metrics.escalationsTier3} T3`;
    case 'speedToCare':
      return metrics.medianMinutesToCare !== null ? 'Median minutes to handoff initiated' : 'No handoffs yet';
    case 'athleteTrust':
      return metrics.athleteTrust !== null
        ? 'Average athlete trust score'
        : surveySummary
          ? `${surveySummary.responseCount}/${diagnostics?.minimumResponseThreshold || 5} responses collected`
          : 'Minimum 5 responses required';
    case 'athleteNps':
      return metrics.athleteNps !== null
        ? 'Average athlete NPS score'
        : surveySummary
          ? `${surveySummary.responseCount}/${diagnostics?.minimumResponseThreshold || 5} responses collected`
          : 'Minimum 5 responses required';
    default:
      return '';
  }
};

const formatSurveyMetricValue = (
  metricKey: SurveyMetricKey,
  metrics: PilotDashboardDetail['outcomeMetrics'] | null | undefined
) => {
  if (!metrics) return 'No study metrics yet';
  const value = metrics[metricKey];
  return value !== null ? value.toFixed(1) : 'Not enough responses yet';
};

const formatSurveyMetricSubtext = (
  metricKey: SurveyMetricKey,
  diagnostics: PilotDashboardDetail['outcomeDiagnostics'] | null | undefined
) => {
  if (!diagnostics) {
    return 'Trust and NPS diagnostics will appear once this frame has a saved survey metrics summary.';
  }
  const summary = diagnostics[metricKey];
  if (!summary) {
    return `Minimum ${diagnostics.minimumResponseThreshold} responses required`;
  }
  return summary.minimumSampleMet
    ? `${summary.responseCount} responses collected · sample threshold met`
    : `${summary.responseCount}/${diagnostics.minimumResponseThreshold} responses collected · below sample threshold`;
};
const hasSurveyMetricSliceValues = (metrics: PilotDashboardDetail['outcomeMetrics'] | null | undefined) =>
  Boolean(
    metrics
    && SURVEY_METRIC_CARDS.some(({ key }) => typeof metrics[key] === 'number' && Number.isFinite(metrics[key]))
  );

const formatConsumerLabel = (consumer: typeof RECOMMENDATION_CONSUMER_ORDER[number]) => RECOMMENDATION_CONSUMER_LABELS[consumer];
const formatSignedDelta = (value: number | null | undefined, suffix = '') => {
  if (value === null || value === undefined) return 'No comparison yet';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}${suffix}`;
};
const formatComparisonMetricValue = (value: number | null | undefined, kind: 'percent' | 'score') => {
  if (value === null || value === undefined) return 'Not enough data yet';
  return kind === 'percent' ? `${value.toFixed(1)}%` : value.toFixed(1);
};
const hasRecommendationTypeSliceMetrics = (slices: Record<string, any> | null | undefined) => {
  if (!slices) return false;
  const values = [
    slices.stateAwareVsFallback?.stateAware?.adherenceRate,
    slices.stateAwareVsFallback?.stateAware?.athleteTrust,
    slices.stateAwareVsFallback?.fallbackOrNone?.adherenceRate,
    slices.stateAwareVsFallback?.fallbackOrNone?.athleteTrust,
    slices.stateAwareVsFallback?.delta?.adherenceRate,
    slices.stateAwareVsFallback?.delta?.athleteTrust,
    slices.protocolCompletion?.completedProtocol?.adherenceRate,
    slices.protocolCompletion?.completedProtocol?.athleteTrust,
    slices.protocolCompletion?.incompleteOrSkippedProtocol?.adherenceRate,
    slices.protocolCompletion?.incompleteOrSkippedProtocol?.athleteTrust,
    slices.protocolCompletion?.delta?.adherenceRate,
    slices.protocolCompletion?.delta?.athleteTrust,
  ];
  return values.some((value) => typeof value === 'number' && Number.isFinite(value));
};
const formatAthleteCountLabel = (count: number | null | undefined) => {
  const safeCount = Number.isFinite(count) ? Number(count) : 0;
  return `${safeCount} athlete${safeCount === 1 ? '' : 's'}`;
};
const formatDurationMetricValue = (value: number | null | undefined) =>
  value === null || value === undefined ? 'Not enough data yet' : `${value.toFixed(1)} min`;
const PILOT_ATHLETE_COMMUNICATIONS_COLLECTION = 'pulsecheck-pilot-athlete-communications';
const PULSECHECK_APP_DEEP_LINK_URL = 'pulsecheck://open';
const PULSECHECK_IOS_APP_STORE_URL = 'https://apps.apple.com/by/app/pulsecheck-mindset-coaching/id6747253393';
const buildAthleteCommunicationKey = (athleteId: string, channel: PilotAthleteCommunicationChannel) => `${athleteId}::${channel}`;
const normalizeCommunicationStatus = (value?: string | null) => {
  if (value === 'sent' || value === 'delivered' || value === 'opened' || value === 'failed') return value;
  return 'not-sent';
};
const toFirstName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'there';
  const safeBase = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  return safeBase.split(/[.\s_-]+/).find(Boolean) || 'there';
};
const buildPilotReadyPushTitle = (detail: PilotDashboardDetail) => {
  const baseLabel = detail.team.displayName || detail.organization.displayName || detail.pilot.name || 'PulseCheck';
  return /\bpilot\b/i.test(baseLabel) ? baseLabel : `${baseLabel} Pilot`;
};
const buildPilotReadyPushBody = (athlete: PilotDashboardDetail['rosterAthletes'][number]) =>
  athlete.pilotEnrollment?.status === 'active'
    ? 'Your PulseCheck app is ready! Open the app and you should be good to go.'
    : 'Your PulseCheck app is ready! Open the app, complete consent, and you should be good to go.';
const buildDefaultPushPreview = (detail: PilotDashboardDetail, athlete: PilotDashboardDetail['rosterAthletes'][number]): PilotAthleteCommunicationPreview => ({
  channel: 'push',
  title: buildPilotReadyPushTitle(detail),
  subtitle: 'Open the app to continue',
  body: buildPilotReadyPushBody(athlete),
  ctaLabel: 'Open Pulse Check App',
  ctaUrl: PULSECHECK_APP_DEEP_LINK_URL,
});
const COMMUNICATION_STATUS_STAGES = ['sent', 'delivered', 'opened'] as const;
const toCommunicationDateValue = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};
const formatCommunicationTimestamp = (value: any) => {
  const date = toCommunicationDateValue(value);
  return date
    ? date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not yet';
};
const communicationStageLabel = (stage: typeof COMMUNICATION_STATUS_STAGES[number]) => `${stage.charAt(0).toUpperCase()}${stage.slice(1)}`;
const communicationStageIsComplete = (
  record: PilotAthleteCommunicationRecord | null,
  stage: typeof COMMUNICATION_STATUS_STAGES[number]
) => {
  if (!record) return false;
  if (stage === 'sent') {
    return Boolean(record.sentAt || record.messageId || ['sent', 'delivered', 'opened'].includes(record.status));
  }
  if (stage === 'delivered') {
    return Boolean(record.deliveredAt || ['delivered', 'opened'].includes(record.status));
  }
  return Boolean(record.openedAt || record.status === 'opened');
};
const communicationStageClassName = (active: boolean) =>
  active
    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
    : 'border-white/10 bg-white/5 text-zinc-500';
const summarizeCommunicationStatus = (record: PilotAthleteCommunicationRecord | null) => {
  if (!record) return 'Not sent yet';
  if (record.status === 'failed') return record.lastError || 'Last send failed';
  if (record.status === 'opened') return `Opened ${formatCommunicationTimestamp(record.openedAt)}`;
  if (record.status === 'delivered') return `Delivered ${formatCommunicationTimestamp(record.deliveredAt)}`;
  if (record.status === 'sent') return `Sent ${formatCommunicationTimestamp(record.sentAt)}`;
  return 'Not sent yet';
};

const PulseCheckPilotDashboardDetailPage: React.FC = () => {
  const currentUser = useUser();
  const dispatch = useDispatch();
  const router = useRouter();
  const pilotId = typeof router.query.pilotId === 'string' ? router.query.pilotId : '';
  const [detail, setDetail] = useState<PilotDashboardDetail | null>(null);
  const [inviteLinks, setInviteLinks] = useState<PulseCheckInviteLink[]>([]);
  const [inviteActivity, setInviteActivity] = useState<PulseCheckInviteActivity[]>([]);
  const [communicationRecordsByKey, setCommunicationRecordsByKey] = useState<Record<string, PilotAthleteCommunicationRecord>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [cohortFilter, setCohortFilter] = useState('');
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');
  const [inviteCohortId, setInviteCohortId] = useState('');
  const [athleteCohortDrafts, setAthleteCohortDrafts] = useState<Record<string, string>>({});
  const [editingHypotheses, setEditingHypotheses] = useState<Record<string, PulseCheckPilotHypothesis>>({});
  const [inviteConfigDraft, setInviteConfigDraft] = useState<PulseCheckPilotInviteConfig | null>(null);
  const [requiredConsentDrafts, setRequiredConsentDrafts] = useState<PulseCheckRequiredConsentDocument[]>([]);
  const [savingHypothesisId, setSavingHypothesisId] = useState<string | null>(null);
  const [generatingHypothesisAssist, setGeneratingHypothesisAssist] = useState(false);
  const [creatingSuggestedHypothesisKey, setCreatingSuggestedHypothesisKey] = useState<string | null>(null);
  const [savingInviteConfig, setSavingInviteConfig] = useState(false);
  const [savingRequiredConsents, setSavingRequiredConsents] = useState(false);
  const [recomputingOutcomeRollups, setRecomputingOutcomeRollups] = useState(false);
  const [savingInviteDefaultScope, setSavingInviteDefaultScope] = useState<'team' | 'organization' | null>(null);
  const [resettingInviteConfig, setResettingInviteConfig] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [creatingInviteMode, setCreatingInviteMode] = useState<InviteCreationMode | null>(null);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [unenrollingAthleteId, setUnenrollingAthleteId] = useState<string | null>(null);
  const [savingAthleteCohortId, setSavingAthleteCohortId] = useState<string | null>(null);
  const [seedingAthleteDataId, setSeedingAthleteDataId] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [qrInvite, setQrInvite] = useState<PulseCheckInviteLink | null>(null);
  const [staffSurveyModalRole, setStaffSurveyModalRole] = useState<'coach' | 'clinician' | null>(null);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [generatingResearchReadout, setGeneratingResearchReadout] = useState(false);
  const [savingResearchReadoutReview, setSavingResearchReadoutReview] = useState(false);
  const [readoutDateWindowStart, setReadoutDateWindowStart] = useState('');
  const [readoutDateWindowEnd, setReadoutDateWindowEnd] = useState('');
  const [readoutBaselineMode, setReadoutBaselineMode] = useState<PilotResearchReadoutBaselineMode>('no-baseline');
  const [selectedReadoutId, setSelectedReadoutId] = useState('');
  const [editingReadout, setEditingReadout] = useState<PilotResearchReadout | null>(null);
  const [compareReadoutId, setCompareReadoutId] = useState('');
  const [hypothesisAssistSuggestions, setHypothesisAssistSuggestions] = useState<PilotHypothesisAssistSuggestion[]>([]);
  const [hypothesisAssistMeta, setHypothesisAssistMeta] = useState<{ modelVersion: string; promptVersion: string } | null>(null);
  const [historyReviewStateFilter, setHistoryReviewStateFilter] = useState<'all' | PilotResearchReadoutReviewState>('all');
  const [historyCohortScopeFilter, setHistoryCohortScopeFilter] = useState<'all' | 'whole-pilot' | 'cohort-only'>('all');
  const [historyWindowStartFilter, setHistoryWindowStartFilter] = useState('');
  const [historyWindowEndFilter, setHistoryWindowEndFilter] = useState('');
  const [communicationPreviewModal, setCommunicationPreviewModal] = useState<AthleteCommunicationPreviewModalState | null>(null);
  const [athleteTransferModal, setAthleteTransferModal] = useState<AthleteTransferModalState | null>(null);
  const [studyMetricsStatusModalOpen, setStudyMetricsStatusModalOpen] = useState(false);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const loadRequestIdRef = useRef(0);
  const communicationLoadRequestIdRef = useRef(0);

  const loadCommunicationRecords = async (resolvedPilotId: string) => {
    if (!resolvedPilotId) {
      setCommunicationRecordsByKey({});
      return;
    }

    const requestId = ++communicationLoadRequestIdRef.current;
    try {
      const communicationSnapshot = await getDocs(
        query(collection(db, PILOT_ATHLETE_COMMUNICATIONS_COLLECTION), where('pilotId', '==', resolvedPilotId))
      );
      if (requestId !== communicationLoadRequestIdRef.current) return;

      const nextRecords = communicationSnapshot.docs.reduce<Record<string, PilotAthleteCommunicationRecord>>((result, docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        const athleteId = typeof data.athleteId === 'string' ? data.athleteId.trim() : '';
        const channel = data.channel === 'push' ? 'push' : data.channel === 'email' ? 'email' : null;
        if (!athleteId || !channel) return result;

        result[buildAthleteCommunicationKey(athleteId, channel)] = {
          id: docSnap.id,
          channel,
          status: normalizeCommunicationStatus(data.status),
          messageId: typeof data.messageId === 'string' ? data.messageId : null,
          sentAt: data.sentAt || null,
          deliveredAt: data.deliveredAt || null,
          openedAt: data.openedAt || null,
          updatedAt: data.updatedAt || null,
          lastError: typeof data.lastError === 'string' ? data.lastError : null,
          preview: data.preview || null,
        };
        return result;
      }, {});

      setCommunicationRecordsByKey(nextRecords);
    } catch (loadError) {
      console.error('[PulseCheckPilotDashboard] Failed to load athlete communication records:', loadError);
    }
  };

  const load = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!pilotId) return;
    const requestId = ++loadRequestIdRef.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const isDemoMode = pulseCheckPilotDashboardService.isDemoModeEnabled();
      setDemoModeEnabled(isDemoMode);
      if (isDemoMode && pilotId !== pulseCheckPilotDashboardService.getDemoPilotId()) {
        await router.replace(`/admin/pulsecheckPilotDashboard/${encodeURIComponent(pulseCheckPilotDashboardService.getDemoPilotId())}`);
        return;
      }
      const nextDetail = await pulseCheckPilotDashboardService.getPilotDashboardDetail(pilotId);
      if (requestId !== loadRequestIdRef.current) return;
      setDetail(nextDetail);
      if (nextDetail?.pilot.id) {
        await loadCommunicationRecords(nextDetail.pilot.id);
        if (requestId !== loadRequestIdRef.current) return;
      } else {
        setCommunicationRecordsByKey({});
      }
      if (nextDetail?.team.id) {
        const nextInviteLinks = pulseCheckPilotDashboardService.isDemoModeEnabled()
          ? pulseCheckPilotDashboardService.listDemoInviteLinks()
          : await pulseCheckProvisioningService.listTeamInviteLinks(nextDetail.team.id);
        const nextInviteActivity = pulseCheckPilotDashboardService.isDemoModeEnabled()
          ? []
          : await pulseCheckProvisioningService.listPilotInviteActivity(nextDetail.pilot.id);
        if (requestId !== loadRequestIdRef.current) return;
        setInviteLinks(nextInviteLinks);
        setInviteActivity(nextInviteActivity);
      } else {
        setInviteLinks([]);
        setInviteActivity([]);
      }
      setCohortFilter((current) => {
        if (!current) return '';
        return nextDetail?.cohorts.some((cohort) => cohort.id === current) ? current : '';
      });
      setInviteCohortId((current) => {
        if (!current) return '';
        return nextDetail?.cohorts.some((cohort) => cohort.id === current) ? current : '';
      });
      setAthleteCohortDrafts(
        Object.fromEntries(
          (nextDetail?.rosterAthletes || []).map((athlete) => [athlete.athleteId, athlete.pilotEnrollment?.cohortId || ''])
        )
      );
      const hypothesisMap = Object.fromEntries((nextDetail?.hypotheses || []).map((hypothesis) => [hypothesis.id, cloneHypothesis(hypothesis)]));
      setEditingHypotheses(hypothesisMap);
      setInviteConfigDraft(nextDetail?.inviteConfig || null);
      setRequiredConsentDrafts(nextDetail?.pilot.requiredConsents || []);
      setSelectedReadoutId((current) => {
        if (!nextDetail?.researchReadouts?.length) return '';
        if (current && nextDetail.researchReadouts.some((readout) => readout.id === current)) return current;
        return nextDetail.researchReadouts[0].id;
      });
    } catch (loadError: any) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(loadError?.message || 'Failed to load pilot dashboard.');
    } finally {
      if (requestId !== loadRequestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [pilotId]);

  useEffect(() => {
    setAthleteSearchQuery('');
  }, [pilotId]);

  useEffect(() => {
    if (!detail?.pilot.id) return;
    const intervalId = window.setInterval(() => {
      void loadCommunicationRecords(detail.pilot.id);
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [detail?.pilot.id]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const getAthleteCommunicationRecord = (
    athleteId: string,
    channel: PilotAthleteCommunicationChannel
  ): PilotAthleteCommunicationRecord | null => communicationRecordsByKey[buildAthleteCommunicationKey(athleteId, channel)] || null;

  const buildAthleteCommunicationRequestPayload = (
    athlete: PilotDashboardDetail['rosterAthletes'][number],
    channel: PilotAthleteCommunicationChannel
  ) => {
    if (!detail) return null;
    return {
      userId: athlete.athleteId,
      athleteId: athlete.athleteId,
      athleteName: athlete.displayName,
      athleteEmail: athlete.email,
      firstName: toFirstName(athlete.displayName || athlete.email),
      organizationId: detail.organization.id,
      organizationName: detail.organization.displayName,
      teamId: detail.team.id,
      teamName: detail.team.displayName,
      pilotId: detail.pilot.id,
      pilotName: detail.pilot.name,
      enrollmentStatus: athlete.pilotEnrollment?.status || '',
      openAppUrl: PULSECHECK_APP_DEEP_LINK_URL,
      iosAppUrl: PULSECHECK_IOS_APP_STORE_URL,
      channel,
    };
  };

  const openAthleteCommunicationPreview = async (
    athlete: PilotDashboardDetail['rosterAthletes'][number],
    channel: PilotAthleteCommunicationChannel
  ) => {
    if (!detail) return;
    const requestPayload = buildAthleteCommunicationRequestPayload(athlete, channel);
    if (!requestPayload) return;

    if (channel === 'push' && !athlete.canReceivePulseCheckPush) {
      setPageMessage({ type: 'error', text: `${athlete.displayName} does not currently have a PulseCheck push token on file.` });
      return;
    }

    if (channel === 'email' && !athlete.email.trim()) {
      setPageMessage({ type: 'error', text: `${athlete.displayName} does not have an email address on file.` });
      return;
    }

    setCommunicationPreviewModal({
      athlete,
      channel,
      preview: channel === 'push' ? buildDefaultPushPreview(detail, athlete) : null,
      loading: true,
      sending: false,
      error: null,
    });

    try {
      const endpoint =
        channel === 'email'
          ? '/.netlify/functions/send-pulsecheck-pilot-activation-email'
          : '/.netlify/functions/send-pulsecheck-pilot-activation-push';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getFirebaseModeRequestHeaders(),
        },
        body: JSON.stringify({
          ...requestPayload,
          previewOnly: true,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || json?.message || `Failed to load ${channel} preview (HTTP ${response.status})`);
      }

      if (json?.outreach?.id) {
        setCommunicationRecordsByKey((current) => ({
          ...current,
          [buildAthleteCommunicationKey(athlete.athleteId, channel)]: json.outreach as PilotAthleteCommunicationRecord,
        }));
      }

      setCommunicationPreviewModal((current) =>
        current && current.athlete.athleteId === athlete.athleteId && current.channel === channel
          ? {
              ...current,
              preview: (json.preview as PilotAthleteCommunicationPreview) || current.preview,
              loading: false,
              error: null,
            }
          : current
      );
    } catch (previewError: any) {
      console.error('[PulseCheckPilotDashboard] Failed to load communication preview:', previewError);
      setCommunicationPreviewModal((current) =>
        current && current.athlete.athleteId === athlete.athleteId && current.channel === channel
          ? {
              ...current,
              loading: false,
              error: previewError?.message || `Failed to load ${channel} preview.`,
            }
          : current
      );
    }
  };

  const confirmCommunicationSend = async () => {
    if (!detail || !communicationPreviewModal) return;
    const { athlete, channel } = communicationPreviewModal;
    const requestPayload = buildAthleteCommunicationRequestPayload(athlete, channel);
    if (!requestPayload) return;

    if (channel === 'push' && !athlete.canReceivePulseCheckPush) {
      const message = `${athlete.displayName} does not currently have a PulseCheck push token on file.`;
      setCommunicationPreviewModal((current) => (current ? { ...current, sending: false, error: message } : current));
      dispatch(showToast({ message, type: 'error' }));
      return;
    }

    if (channel === 'email' && !athlete.email.trim()) {
      const message = `${athlete.displayName} does not have an email address on file.`;
      setCommunicationPreviewModal((current) => (current ? { ...current, sending: false, error: message } : current));
      dispatch(showToast({ message, type: 'error' }));
      return;
    }

    setCommunicationPreviewModal((current) => (current ? { ...current, sending: true, error: null } : current));
    setPageMessage(null);

    try {
      const endpoint =
        channel === 'email'
          ? '/.netlify/functions/send-pulsecheck-pilot-activation-email'
          : '/.netlify/functions/send-pulsecheck-pilot-activation-push';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getFirebaseModeRequestHeaders(),
        },
        body: JSON.stringify(requestPayload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || json?.message || `Failed to send ${channel} notification (HTTP ${response.status})`);
      }

      if (json?.outreach?.id) {
        setCommunicationRecordsByKey((current) => ({
          ...current,
          [buildAthleteCommunicationKey(athlete.athleteId, channel)]: json.outreach as PilotAthleteCommunicationRecord,
        }));
      } else {
        await loadCommunicationRecords(detail.pilot.id);
      }

      setCommunicationPreviewModal((current) =>
        current && current.athlete.athleteId === athlete.athleteId && current.channel === channel
          ? {
              ...current,
              preview: (json.preview as PilotAthleteCommunicationPreview) || current.preview,
              loading: false,
              sending: false,
              error: null,
            }
          : current
      );

      dispatch(
        showToast({
          message:
            channel === 'email'
              ? `Activation email sent to ${athlete.email}.`
              : `Activation push sent to ${athlete.displayName}.`,
          type: 'success',
        })
      );
    } catch (sendError: any) {
      const message = sendError?.message || `Failed to send ${channel} notification.`;
      console.error(`[PulseCheckPilotDashboard] Failed to send ${channel} outreach:`, sendError);
      setCommunicationPreviewModal((current) => (current ? { ...current, sending: false, error: message } : current));
      dispatch(showToast({ message, type: 'error' }));
    }
  };

  const openAthleteTransferModal = async (athlete: PilotDashboardDetail['rosterAthletes'][number]) => {
    if (!detail) return;
    if (pulseCheckPilotDashboardService.isDemoModeEnabled()) {
      setPageMessage({ type: 'error', text: 'Demo mode does not support team transfers.' });
      return;
    }

    if (!athlete.teamMembership || athlete.teamMembership.teamId !== detail.team.id) {
      setPageMessage({ type: 'error', text: `${athlete.displayName} is not currently attached to this team.` });
      return;
    }

    setPageMessage(null);
    setAthleteTransferModal({
      athlete,
      loading: true,
      saving: false,
      error: null,
      teams: [],
      pilots: [],
      cohorts: [],
      selectedTeamId: '',
      selectedPilotId: '',
      selectedCohortId: '',
    });

    try {
      const [teams, pilots, cohorts] = await Promise.all([
        pulseCheckProvisioningService.listTeams(),
        pulseCheckProvisioningService.listPilots(),
        pulseCheckProvisioningService.listPilotCohorts(),
      ]);
      const eligibleTeams = teams.filter((team) => team.organizationId === detail.organization.id && team.id !== detail.team.id);
      const defaultTeamId = eligibleTeams.length === 1 ? eligibleTeams[0].id : '';

      setAthleteTransferModal((current) =>
        current && current.athlete.athleteId === athlete.athleteId
          ? {
              ...current,
              loading: false,
              teams,
              pilots,
              cohorts,
              selectedTeamId: defaultTeamId,
              selectedPilotId: '',
              selectedCohortId: '',
              error: eligibleTeams.length > 0 ? null : 'No other teams are available under this organization yet.',
            }
          : current
      );
    } catch (loadError: any) {
      console.error('[PulseCheckPilotDashboard] Failed to load athlete transfer options:', loadError);
      setAthleteTransferModal((current) =>
        current && current.athlete.athleteId === athlete.athleteId
          ? {
              ...current,
              loading: false,
              error: loadError?.message || 'Failed to load destination team options.',
            }
          : current
      );
    }
  };

  const handleTransferTeamChange = (teamId: string) => {
    setAthleteTransferModal((current) =>
      current
        ? {
            ...current,
            selectedTeamId: teamId,
            selectedPilotId: '',
            selectedCohortId: '',
            error: null,
          }
        : current
    );
  };

  const handleTransferPilotChange = (pilotId: string) => {
    setAthleteTransferModal((current) =>
      current
        ? {
            ...current,
            selectedPilotId: pilotId,
            selectedCohortId: '',
            error: null,
          }
        : current
    );
  };

  const handleTransferCohortChange = (cohortId: string) => {
    setAthleteTransferModal((current) =>
      current
        ? {
            ...current,
            selectedCohortId: cohortId,
            error: null,
          }
        : current
    );
  };

  const confirmAthleteTransfer = async () => {
    if (!detail || !athleteTransferModal) return;
      const { athlete, selectedTeamId, selectedPilotId, selectedCohortId } = athleteTransferModal;

    if (!selectedTeamId) {
      setAthleteTransferModal((current) =>
        current ? { ...current, error: 'Choose a destination team before transferring this athlete.' } : current
      );
      return;
    }

    setAthleteTransferModal((current) => (current ? { ...current, saving: true, error: null } : current));
    setPageMessage(null);

    try {
      await pulseCheckProvisioningService.transferAthleteToTeam({
        athleteId: athlete.athleteId,
        sourceTeamId: detail.team.id,
        sourcePilotId: detail.pilot.id,
        destinationTeamId: selectedTeamId,
        destinationPilotId: selectedPilotId || undefined,
        destinationCohortId: selectedCohortId || undefined,
        actorUserId: currentUser?.id || undefined,
        actorEmail: currentUser?.email || undefined,
      });

      const destinationTeam = athleteTransferModal.teams.find((team) => team.id === selectedTeamId) || null;
      const destinationPilot = athleteTransferModal.pilots.find((pilot) => pilot.id === selectedPilotId) || null;
      const successText = destinationPilot
        ? `${athlete.displayName} was transferred to ${destinationTeam?.displayName || 'the destination team'} and enrolled in ${destinationPilot.name}.`
        : `${athlete.displayName} was transferred to ${destinationTeam?.displayName || 'the destination team'}.`;

      setAthleteTransferModal(null);
      setPageMessage({ type: 'success', text: successText });
      dispatch(showToast({ message: successText, type: 'success' }));
      await load('refresh');
    } catch (transferError: any) {
      const message = transferError?.message || 'Failed to transfer this athlete to the selected team.';
      console.error('[PulseCheckPilotDashboard] Failed to transfer athlete:', transferError);
      setAthleteTransferModal((current) => (current ? { ...current, saving: false, error: message } : current));
      dispatch(showToast({ message, type: 'error' }));
    }
  };

  const toggleDemoMode = async () => {
    const nextValue = !pulseCheckPilotDashboardService.isDemoModeEnabled();
    pulseCheckPilotDashboardService.setDemoModeEnabled(nextValue);
    if (nextValue) {
      pulseCheckPilotDashboardService.resetDemoModeData();
      await router.push(`/admin/pulsecheckPilotDashboard/${encodeURIComponent(pulseCheckPilotDashboardService.getDemoPilotId())}`);
      return;
    }
    await router.push('/admin/pulsecheckPilotDashboard');
  };

  const resetDemoModeData = async () => {
    pulseCheckPilotDashboardService.resetDemoModeData();
    await load('refresh');
  };

  useEffect(() => {
    if (!detail) return;
    const pilotStart = toDateValue(detail.pilot.startAt);
    const pilotEnd = toDateValue(detail.pilot.endAt);
    const now = new Date();
    const defaultEnd = pilotEnd && pilotEnd.getTime() < now.getTime() ? pilotEnd : now;
    const defaultStart = pilotStart || new Date(defaultEnd.getTime() - 1000 * 60 * 60 * 24 * 30);
    setReadoutDateWindowStart((current) => current || toInputDateValue(defaultStart));
    setReadoutDateWindowEnd((current) => current || toInputDateValue(defaultEnd));
  }, [detail]);

  useEffect(() => {
    if (!detail?.researchReadouts?.length) {
      setEditingReadout(null);
      return;
    }
    const activeReadout =
      detail.researchReadouts.find((readout) => readout.id === selectedReadoutId) ||
      detail.researchReadouts[0] ||
      null;
    setEditingReadout(activeReadout ? cloneResearchReadout(activeReadout) : null);
  }, [detail, selectedReadoutId]);

  const filteredResearchReadouts = useMemo(() => {
    const readouts = detail?.researchReadouts || [];
    return readouts.filter((readout) => {
      if (historyReviewStateFilter !== 'all' && readout.reviewState !== historyReviewStateFilter) {
        return false;
      }
      if (historyCohortScopeFilter === 'whole-pilot' && readout.cohortId) {
        return false;
      }
      if (historyCohortScopeFilter === 'cohort-only' && !readout.cohortId) {
        return false;
      }
      if (historyWindowStartFilter && readout.dateWindowEnd < historyWindowStartFilter) {
        return false;
      }
      if (historyWindowEndFilter && readout.dateWindowStart > historyWindowEndFilter) {
        return false;
      }
      return true;
    });
  }, [detail, historyCohortScopeFilter, historyReviewStateFilter, historyWindowEndFilter, historyWindowStartFilter]);

  useEffect(() => {
    if (!filteredResearchReadouts.length) {
      setSelectedReadoutId('');
      return;
    }
    if (!filteredResearchReadouts.some((readout) => readout.id === selectedReadoutId)) {
      setSelectedReadoutId(filteredResearchReadouts[0].id);
    }
  }, [filteredResearchReadouts, selectedReadoutId]);

  const availableCohorts = detail?.cohorts || [];

  const selectedCohort = useMemo(
    () => availableCohorts.find((cohort) => cohort.id === cohortFilter) || null,
    [availableCohorts, cohortFilter]
  );

  const inviteScopeCohorts = detail?.cohorts || [];

  const selectedInviteCohort = useMemo(
    () => inviteScopeCohorts.find((cohort) => cohort.id === inviteCohortId) || null,
    [inviteCohortId, inviteScopeCohorts]
  );

  useEffect(() => {
    setHypothesisAssistSuggestions([]);
    setHypothesisAssistMeta(null);
  }, [pilotId, cohortFilter]);

  const visibleActiveAthletes = useMemo(() => {
    if (!detail) return [];
    if (!cohortFilter) return detail.athletes;
    return detail.athletes.filter((athlete) => athlete.pilotEnrollment.cohortId === cohortFilter);
  }, [detail, cohortFilter]);

  const visibleRosterAthletes = useMemo(() => {
    if (!detail) return [];
    const normalizedQuery = athleteSearchQuery.trim().toLowerCase();
    const filtered = (cohortFilter
      ? detail.rosterAthletes.filter((athlete) => athlete.pilotEnrollment?.cohortId === cohortFilter)
      : detail.rosterAthletes
    ).filter((athlete) => {
      if (!normalizedQuery) return true;
      const enrollmentBadge = athleteEnrollmentBadgePresentation(athlete.pilotEnrollment?.status);
      const searchableText = [
        athlete.displayName,
        athlete.email,
        athlete.athleteId,
        athlete.cohort?.name,
        athlete.pilotEnrollment?.cohortId,
        athlete.pilotEnrollment?.status,
        enrollmentBadge.label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
    return [...filtered].sort(
      (left, right) =>
        athleteRosterStatusRank(left.pilotEnrollment?.status) - athleteRosterStatusRank(right.pilotEnrollment?.status) ||
        left.displayName.localeCompare(right.displayName)
    );
  }, [athleteSearchQuery, cohortFilter, detail]);

  const transferTeamOptions = useMemo(() => {
    if (!athleteTransferModal || !detail) return [];
    return athleteTransferModal.teams
      .filter((team) => team.organizationId === detail.organization.id && team.id !== detail.team.id)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [athleteTransferModal, detail]);

  const transferPilotOptions = useMemo(() => {
    if (!athleteTransferModal) return [];
    return athleteTransferModal.pilots
      .filter((pilot) => pilot.teamId === athleteTransferModal.selectedTeamId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [athleteTransferModal]);

  const transferCohortOptions = useMemo(() => {
    if (!athleteTransferModal) return [];
    return athleteTransferModal.cohorts
      .filter((cohort) => cohort.pilotId === athleteTransferModal.selectedPilotId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [athleteTransferModal]);

  const visibleMetrics = useMemo(() => {
    const activeCohortCount = detail?.cohorts.length || 0;
    return {
      activeAthleteCount: visibleActiveAthletes.length,
      cohortCount: cohortFilter ? (selectedCohort ? 1 : 0) : activeCohortCount,
      athletesWithEngineRecord: visibleActiveAthletes.filter((athlete) => athlete.engineSummary.hasEngineRecord).length,
      athletesWithStablePatterns: visibleActiveAthletes.filter((athlete) => athlete.engineSummary.stablePatternCount > 0).length,
      totalEvidenceRecords: visibleActiveAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.evidenceRecordCount, 0),
      totalPatternModels: visibleActiveAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.patternModelCount, 0),
      totalRecommendationProjections: visibleActiveAthletes.reduce(
        (sum, athlete) => sum + athlete.engineSummary.recommendationProjectionCount,
        0
      ),
    };
  }, [cohortFilter, detail?.cohorts.length, selectedCohort, visibleActiveAthletes]);

  const visibleCohortSummaries = useMemo(() => {
    if (!detail) return [];
    if (!cohortFilter) return detail.cohortSummaries;
    return detail.cohortSummaries.filter((summary) => summary.cohortId === cohortFilter);
  }, [cohortFilter, detail]);

  const visibleCoverage = useMemo(() => ({
    engineCoverageRate: toScopedPercent(visibleMetrics.athletesWithEngineRecord, visibleMetrics.activeAthleteCount),
    stablePatternRate: toScopedPercent(visibleMetrics.athletesWithStablePatterns, visibleMetrics.activeAthleteCount),
    avgEvidenceRecordsPerActiveAthlete:
      visibleMetrics.activeAthleteCount > 0 ? visibleMetrics.totalEvidenceRecords / visibleMetrics.activeAthleteCount : 0,
    avgPatternModelsPerActiveAthlete:
      visibleMetrics.activeAthleteCount > 0 ? visibleMetrics.totalPatternModels / visibleMetrics.activeAthleteCount : 0,
    avgRecommendationProjectionsPerActiveAthlete:
      visibleMetrics.activeAthleteCount > 0
        ? visibleMetrics.totalRecommendationProjections / visibleMetrics.activeAthleteCount
        : 0,
  }), [visibleMetrics]);

  const visibleRecommendationProjectionConsumerCounts = useMemo(() => {
    return visibleActiveAthletes.reduce<Record<string, number>>((accumulator, athlete) => {
      const counts = athlete.engineSummary.recommendationProjectionCountsByConsumer || {};
      Object.entries(counts).forEach(([consumer, count]) => {
        if (!count) return;
        accumulator[consumer] = (accumulator[consumer] || 0) + count;
      });
      return accumulator;
    }, {});
  }, [visibleActiveAthletes]);

  const visibleOutcomeMetrics = useMemo(() => {
    if (!detail) return null;
    if (cohortFilter) {
      return detail.outcomeMetricsByCohort?.[cohortFilter] || null;
    }
    return detail.outcomeMetrics || null;
  }, [cohortFilter, detail]);

  const visibleOutcomeDiagnostics = useMemo(() => {
    if (!detail) return null;
    if (cohortFilter) {
      return detail.outcomeDiagnosticsByCohort?.[cohortFilter] || null;
    }
    return detail.outcomeDiagnostics || null;
  }, [cohortFilter, detail]);

  const visibleHypothesisEvaluation = useMemo(() => {
    if (!detail) return null;
    if (cohortFilter) {
      return detail.hypothesisEvaluationByCohort?.[cohortFilter] || null;
    }
    return detail.hypothesisEvaluation || null;
  }, [cohortFilter, detail]);

  const visibleRecommendationTypeSlices = useMemo(() => {
    if (!detail) return null;
    const recommendationTypeSlices = cohortFilter
      ? detail.outcomeRecommendationTypeSlicesByCohort?.[cohortFilter] || null
      : detail.outcomeRecommendationTypeSlices || null;
    return hasRecommendationTypeSliceMetrics(recommendationTypeSlices) ? recommendationTypeSlices : null;
  }, [cohortFilter, detail]);
  const visibleSurveyMetricSlices = useMemo(() => (
    hasSurveyMetricSliceValues(visibleOutcomeMetrics) ? visibleOutcomeMetrics : null
  ), [visibleOutcomeMetrics]);

  const visibleOperationalDiagnostics = detail?.outcomeOperationalDiagnostics || null;
  const visibleEscalationOperationalDiagnostics = visibleOperationalDiagnostics?.escalations || null;
  const visibleOperationalWatchListSummary = detail?.operationalWatchListSummary || null;
  const outcomeOpsStatus = detail?.outcomeOpsStatus || null;
  const metricsRefreshScope = (outcomeOpsStatus?.scopes?.rollup_recompute || null) as MetricsOpsScopeStatus;
  const metricsRepairScope = (outcomeOpsStatus?.scopes?.scheduled_rollup_repair || null) as MetricsOpsScopeStatus;
  const metricsRefreshCompletedMs = getTimeValueMs(
    metricsRefreshScope?.completedAt || metricsRefreshScope?.startedAt || outcomeOpsStatus?.root?.updatedAt
  );
  const metricsRefreshBroken = Boolean(
    (metricsRefreshScope?.status && !isHealthyMetricsStatus(metricsRefreshScope.status))
      || metricsRefreshScope?.lastError
      || (metricsRepairScope?.status && !isHealthyMetricsStatus(metricsRepairScope.status))
      || metricsRepairScope?.lastError
  );
  const metricsRefreshStale = !metricsRefreshCompletedMs || Date.now() - metricsRefreshCompletedMs > METRICS_STATUS_STALE_AFTER_MS;
  const metricsRefreshState: 'healthy' | 'stale' | 'broken' = metricsRefreshBroken ? 'broken' : metricsRefreshStale ? 'stale' : 'healthy';
  const showStudyMetricsStatusLink = metricsRefreshState !== 'healthy';
  const careEscalationTimingSteps = [
    ['Coach notified', visibleEscalationOperationalDiagnostics?.supportingSpeedToCare?.coachNotification],
    ['Consent accepted', visibleEscalationOperationalDiagnostics?.supportingSpeedToCare?.consentAccepted],
    ['Handoff initiated', visibleEscalationOperationalDiagnostics?.supportingSpeedToCare?.handoffInitiated],
    ['Handoff accepted', visibleEscalationOperationalDiagnostics?.supportingSpeedToCare?.handoffAccepted],
    ['First clinician response', visibleEscalationOperationalDiagnostics?.supportingSpeedToCare?.firstClinicianResponse],
    ['Care completed', visibleEscalationOperationalDiagnostics?.supportingSpeedToCare?.careCompleted],
  ] as const;
  const currentCareEscalationCount =
    visibleEscalationOperationalDiagnostics?.secondaryCounts?.groupedIncidents
    ?? visibleOutcomeMetrics?.escalationsTotal
    ?? 0;
  const hasCareTimingData = careEscalationTimingSteps.some(([, summary]) => {
    const timingSummary = summary as any;
    return Boolean(
      (typeof timingSummary?.sampleCount === 'number' && timingSummary.sampleCount > 0)
      || timingSummary?.medianMinutes !== null && timingSummary?.medianMinutes !== undefined
      || timingSummary?.p75Minutes !== null && timingSummary?.p75Minutes !== undefined
    );
  });
  const hasCareEscalationData = (
    [
      currentCareEscalationCount,
      visibleEscalationOperationalDiagnostics?.secondaryCounts?.openCareEscalations ?? 0,
      visibleEscalationOperationalDiagnostics?.secondaryCounts?.coachReviewFlags ?? 0,
      visibleEscalationOperationalDiagnostics?.secondaryCounts?.supportFlags ?? 0,
      visibleEscalationOperationalDiagnostics?.statusCounts?.active ?? 0,
      visibleEscalationOperationalDiagnostics?.statusCounts?.resolved ?? 0,
      visibleEscalationOperationalDiagnostics?.statusCounts?.declined ?? 0,
      visibleOutcomeMetrics?.escalationsTier1 ?? 0,
      visibleOutcomeMetrics?.escalationsTier2 ?? 0,
      visibleOutcomeMetrics?.escalationsTier3 ?? 0,
    ].some((value) => value > 0)
    || hasCareTimingData
    || (visibleOutcomeMetrics?.medianMinutesToCare !== null && visibleOutcomeMetrics?.medianMinutesToCare !== undefined)
  );

  const visibleEnrollmentCount = useMemo(() => {
    if (!visibleOutcomeMetrics) return null;
    const totalCount = cohortFilter ? visibleActiveAthletes.length : (detail?.metrics.totalEnrollmentCount || 0);
    const enrolledCount = totalCount > 0 ? Math.round((visibleOutcomeMetrics.enrollmentRate / 100) * totalCount) : 0;
    return { enrolledCount, totalCount };
  }, [cohortFilter, detail?.metrics.totalEnrollmentCount, visibleActiveAthletes.length, visibleOutcomeMetrics]);

  const operationalWatchListSummaryCards: Array<{
    label: string;
    value: string;
    helper: string;
    accentClassName: string;
  }> = [
    {
      label: 'Watch-list states',
      value: String(visibleOperationalWatchListSummary?.stateCount ?? 0),
      helper: 'All operational watch-list records on this pilot, including requests, active restrictions, and cleared records.',
      accentClassName: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    },
    {
      label: 'Active',
      value: String(visibleOperationalWatchListSummary?.activeCount ?? 0),
      helper: 'Athletes currently on an active operational watch list with restriction flags in effect.',
      accentClassName: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    },
    {
      label: 'Review queued',
      value: String(visibleOperationalWatchListSummary?.requestedCount ?? 0),
      helper: 'Review items queued by request; no athlete-facing restriction is active until apply.',
      accentClassName: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    },
    {
      label: 'Survey suppression',
      value: String(visibleOperationalWatchListSummary?.suppressSurveysCount ?? 0),
      helper: 'Current active restriction states that suppress trust and NPS prompting.',
      accentClassName: 'border-white/10 bg-white/5 text-zinc-100',
    },
    {
      label: 'Assignment suppression',
      value: String(visibleOperationalWatchListSummary?.suppressAssignmentsCount ?? 0),
      helper: 'Current active restriction states that suppress assignment delivery.',
      accentClassName: 'border-white/10 bg-white/5 text-zinc-100',
    },
    {
      label: 'Nudge suppression',
      value: String(visibleOperationalWatchListSummary?.suppressNudgesCount ?? 0),
      helper: 'Current active restriction states that suppress nudges and reminder delivery.',
      accentClassName: 'border-white/10 bg-white/5 text-zinc-100',
    },
    {
      label: 'Adherence exclusions',
      value: String(visibleOperationalWatchListSummary?.excludeFromAdherenceCount ?? 0),
      helper: 'Current active restriction states excluded from adherence denominators.',
      accentClassName: 'border-white/10 bg-white/5 text-zinc-100',
    },
    {
      label: 'Manual hold',
      value: String(visibleOperationalWatchListSummary?.manualHoldCount ?? 0),
      helper: 'Current active restriction states using manual hold across athlete-facing flows.',
      accentClassName: 'border-white/10 bg-white/5 text-zinc-100',
    },
  ];

  const selectedResearchReadout = useMemo(
    () => detail?.researchReadouts.find((readout) => readout.id === selectedReadoutId) || detail?.researchReadouts[0] || null,
    [detail, selectedReadoutId]
  );

  const compareReadout = useMemo(
    () => detail?.researchReadouts.find((readout) => readout.id === compareReadoutId) || null,
    [compareReadoutId, detail]
  );

  const compareReadoutCandidates = useMemo(
    () => (detail?.researchReadouts || []).filter((readout) => readout.id !== selectedResearchReadout?.id),
    [detail, selectedResearchReadout]
  );

  useEffect(() => {
    if (!compareReadoutCandidates.length) {
      setCompareReadoutId('');
      return;
    }
    if (compareReadoutId && compareReadoutCandidates.some((readout) => readout.id === compareReadoutId)) {
      return;
    }
    setCompareReadoutId('');
  }, [compareReadoutCandidates, compareReadoutId]);

  const researchReadoutDiff = useMemo(() => {
    if (!selectedResearchReadout || !compareReadout) return null;

    const metadataChanges: string[] = [];
    if (selectedResearchReadout.reviewState !== compareReadout.reviewState) {
      metadataChanges.push(`Review state changed from ${compareReadout.reviewState} to ${selectedResearchReadout.reviewState}.`);
    }
    if (selectedResearchReadout.baselineMode !== compareReadout.baselineMode) {
      metadataChanges.push(`Baseline mode changed from ${compareReadout.baselineMode} to ${selectedResearchReadout.baselineMode}.`);
    }
    if (
      selectedResearchReadout.dateWindowStart !== compareReadout.dateWindowStart ||
      selectedResearchReadout.dateWindowEnd !== compareReadout.dateWindowEnd
    ) {
      metadataChanges.push(
        `Window changed from ${compareReadout.dateWindowStart} to ${compareReadout.dateWindowEnd} into ${selectedResearchReadout.dateWindowStart} to ${selectedResearchReadout.dateWindowEnd}.`
      );
    }
    if (selectedResearchReadout.modelVersion !== compareReadout.modelVersion) {
      metadataChanges.push(`Model changed from ${compareReadout.modelVersion || 'unknown'} to ${selectedResearchReadout.modelVersion || 'unknown'}.`);
    }

    const priorSectionMap = new Map(compareReadout.sections.map((section) => [section.sectionKey, section]));
    const sectionChanges = selectedResearchReadout.sections
      .map((section) => {
        const prior = priorSectionMap.get(section.sectionKey);
        if (!prior) return `${section.title} was added in the newer readout.`;

        const changes: string[] = [];
        if (section.readinessStatus !== prior.readinessStatus) {
          changes.push(`readiness ${prior.readinessStatus} -> ${section.readinessStatus}`);
        }
        if (section.summary !== prior.summary) {
          changes.push('summary changed');
        }
        if ((section.reviewerResolution || '') !== (prior.reviewerResolution || '')) {
          changes.push(`reviewer resolution ${prior.reviewerResolution || 'unset'} -> ${section.reviewerResolution || 'unset'}`);
        }
        if ((section.reviewerNotes || '') !== (prior.reviewerNotes || '')) {
          changes.push('reviewer notes changed');
        }
        if (section.claims.length !== prior.claims.length) {
          changes.push(`claims ${prior.claims.length} -> ${section.claims.length}`);
        }
        if (section.citations.length !== prior.citations.length) {
          changes.push(`citations ${prior.citations.length} -> ${section.citations.length}`);
        }

        return changes.length > 0 ? `${section.title}: ${changes.join(', ')}.` : null;
      })
      .filter(Boolean) as string[];

    return { metadataChanges, sectionChanges };
  }, [compareReadout, selectedResearchReadout]);

  const orderedEditingReadoutSections = useMemo(() => {
    if (!editingReadout) return [];
    const sectionMap = new Map(editingReadout.sections.map((section) => [section.sectionKey, section]));
    return RESEARCH_SECTION_ORDER.map((sectionKey) => sectionMap.get(sectionKey)).filter(Boolean) as PilotResearchReadoutSection[];
  }, [editingReadout]);

  const hypothesesByCode = useMemo(
    () => new Map((detail?.hypotheses || []).map((hypothesis) => [hypothesis.code, hypothesis])),
    [detail?.hypotheses]
  );

  const existingHypothesisStatementSet = useMemo(
    () =>
      new Set(
        (detail?.hypotheses || [])
          .map((hypothesis) => normalizeInvitePreviewValue(hypothesis.statement).toLowerCase())
          .filter(Boolean)
      ),
    [detail?.hypotheses]
  );

  const nextHypothesisCode = useMemo(() => {
    const nextNumericCode =
      (detail?.hypotheses || [])
        .map((hypothesis) => {
          const match = /^H(\d+)$/i.exec(hypothesis.code || '');
          return match ? Number(match[1]) : 0;
        })
        .reduce((max, current) => Math.max(max, current), 0) + 1;
    return `H${nextNumericCode}`;
  }, [detail?.hypotheses]);

  const scopedInvites = useMemo(() => {
    if (!detail) return [] as PulseCheckInviteLink[];
    return inviteLinks.filter((invite) => {
      if (invite.inviteType !== 'team-access') return false;
      if (invite.teamMembershipRole !== 'athlete') return false;
      if ((invite.pilotId || '') !== detail.pilot.id) return false;
      if (selectedInviteCohort) {
        return (invite.cohortId || '') === selectedInviteCohort.id;
      }
      return !(invite.cohortId || '');
    });
  }, [detail, inviteLinks, selectedInviteCohort]);

  const scopedSingleUseInvites = useMemo(
    () => scopedInvites.filter((invite) => invite.redemptionMode !== 'general'),
    [scopedInvites]
  );
  const scopedGeneralInvites = useMemo(
    () => scopedInvites.filter((invite) => invite.redemptionMode === 'general'),
    [scopedInvites]
  );
  const scopedInvite = scopedGeneralInvites?.[0] || scopedInvites?.[0] || null;
  const scopedInviteDiagnostic = useMemo(
    () => analyzeInviteShareTarget(scopedInvite),
    [scopedInvite]
  );
  const scopedInviteSummary = useMemo(() => {
    if (!scopedInvites.length) {
      return 'No invite links exist for this scope yet.';
    }

    const statusSummary = `${scopedInvites.length} invite link${scopedInvites.length === 1 ? '' : 's'} currently visible for this scope.`;
    const modeSegments: string[] = [];
    if (scopedSingleUseInvites.length > 0) {
      modeSegments.push(`${scopedSingleUseInvites.length} single-use`);
    }
    if (scopedGeneralInvites.length > 0) {
      modeSegments.push(`${scopedGeneralInvites.length} general`);
    }

    return modeSegments.length > 0 ? `${statusSummary} ${modeSegments.join(', ')}.` : statusSummary;
  }, [
    scopedGeneralInvites.length,
    scopedInvites.length,
    scopedSingleUseInvites.length,
  ]);

  const inviteActivityParticipants = useMemo(() => {
    const grouped = new Map<string, InviteActivityParticipantRow>();

    inviteActivity.forEach((activity) => {
      const participantKey = activity.email || activity.sessionId || activity.id;
      const eventDate = toDateValue(activity.createdAt);
      const existing = grouped.get(participantKey);

      if (!existing) {
        grouped.set(participantKey, {
          key: participantKey,
          email: activity.email || '',
          emailSource: activity.emailSource || 'unknown',
          sessionId: activity.sessionId || '',
          firstSeenAt: eventDate,
          lastSeenAt: eventDate,
          lastEventType: activity.eventType,
          lastError: activity.errorMessage || '',
          userAgent: activity.userAgent || '',
          token: activity.token || '',
          hasPageView: activity.eventType === 'page-view' || activity.eventType === 'authenticated-view',
          hasRedeemSucceeded: activity.eventType === 'redeem-succeeded',
          hasRedeemFailed: activity.eventType === 'redeem-failed',
          hasFollowUpRequest: activity.eventType === 'follow-up-requested',
          needsFollowUp: Boolean(activity.needsFollowUp),
        });
        return;
      }

      const shouldReplaceLatest =
        (eventDate?.getTime() || 0) >= (existing.lastSeenAt?.getTime() || 0);

      if (!existing.email && activity.email) {
        existing.email = activity.email;
        existing.emailSource = activity.emailSource || existing.emailSource;
      }

      if (eventDate && (!existing.firstSeenAt || eventDate.getTime() < existing.firstSeenAt.getTime())) {
        existing.firstSeenAt = eventDate;
      }

      if (shouldReplaceLatest) {
        existing.lastSeenAt = eventDate;
        existing.lastEventType = activity.eventType;
        existing.lastError = activity.errorMessage || existing.lastError;
        existing.userAgent = activity.userAgent || existing.userAgent;
        existing.token = activity.token || existing.token;
      }

      existing.hasPageView ||= activity.eventType === 'page-view' || activity.eventType === 'authenticated-view';
      existing.hasRedeemSucceeded ||= activity.eventType === 'redeem-succeeded';
      existing.hasRedeemFailed ||= activity.eventType === 'redeem-failed';
      existing.hasFollowUpRequest ||= activity.eventType === 'follow-up-requested';
      existing.needsFollowUp ||= Boolean(activity.needsFollowUp);
    });

    return Array.from(grouped.values())
      .map((participant) => ({
        ...participant,
        needsFollowUp: (participant.hasRedeemFailed || participant.hasFollowUpRequest || participant.needsFollowUp)
          && !participant.hasRedeemSucceeded,
      }))
      .sort((left, right) => (right.lastSeenAt?.getTime() || 0) - (left.lastSeenAt?.getTime() || 0));
  }, [inviteActivity]);

  const inviteActivitySummary = useMemo(() => ({
    scannedCount: inviteActivityParticipants.filter((participant) => participant.hasPageView).length,
    identifiedCount: inviteActivityParticipants.filter((participant) => Boolean(participant.email)).length,
    needsFollowUpCount: inviteActivityParticipants.filter((participant) => participant.needsFollowUp).length,
    joinedCount: inviteActivityParticipants.filter((participant) => participant.hasRedeemSucceeded).length,
  }), [inviteActivityParticipants]);

  const inviteConfigSource = useMemo(() => {
    if (!detail) {
      return {
        label: 'Base fallback',
        description: 'No saved defaults were found yet, so this pilot is using the built-in starter instructions.',
        className: 'border-white/10 bg-white/5 text-zinc-300',
      };
    }

    if (detail.hasPilotInviteConfigOverride) {
      return {
        label: 'Pilot override',
        description: 'This pilot has its own saved invite instructions and does not currently inherit the team or organization copy.',
        className: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
      };
    }

    if (detail.teamInviteConfigDefault) {
      return {
        label: 'Team default',
        description: 'This pilot is currently inheriting the team-level invite instructions.',
        className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
      };
    }

    if (detail.organizationInviteConfigDefault) {
      return {
        label: 'Organization default',
        description: 'This pilot is currently inheriting the organization-level invite instructions.',
        className: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
      };
    }

    return {
      label: 'Base fallback',
      description: 'No organization, team, or pilot config exists yet, so this pilot is using the built-in starter instructions.',
      className: 'border-white/10 bg-white/5 text-zinc-300',
    };
  }, [detail]);

  const inviteConfigPreviewDiff = useMemo(() => {
    if (!detail || !inviteConfigDraft || !detail.hasPilotInviteConfigOverride) {
      return null;
    }

    const baseline =
      detail.teamInviteConfigDefault ||
      detail.organizationInviteConfigDefault ||
      buildFallbackInvitePreviewConfig(detail);

    const baselineLabel = detail.teamInviteConfigDefault
      ? 'team default'
      : detail.organizationInviteConfigDefault
        ? 'organization default'
        : 'built-in fallback';

    const changedFields = INVITE_PREVIEW_FIELDS.filter(({ field }) => {
      const currentValue = normalizeInvitePreviewValue(inviteConfigDraft[field]);
      const baselineValue = normalizeInvitePreviewValue(baseline[field]);
      return currentValue !== baselineValue;
    });

    return {
      baselineLabel,
      changedFields,
    };
  }, [detail, inviteConfigDraft]);

  const overviewCards = useMemo(() => {
    if (!detail) return [];
    return [
      {
        label: 'Active Pilot Athletes',
        value: String(visibleMetrics.activeAthleteCount),
        icon: <Users2 className="h-5 w-5" />,
        metricKey: 'active-pilot-athletes' as PilotDashboardMetricExplanationKey,
      },
      {
        label: cohortFilter ? 'Selected Cohort' : 'Active Cohorts',
        value: String(visibleMetrics.cohortCount),
        icon: <FlaskConical className="h-5 w-5" />,
        metricKey: (cohortFilter ? 'selected-cohort' : 'active-cohorts') as PilotDashboardMetricExplanationKey,
      },
      {
        label: 'Athletes With Stable Patterns',
        value: String(visibleMetrics.athletesWithStablePatterns),
        icon: <Brain className="h-5 w-5" />,
        metricKey: 'athletes-with-stable-patterns' as PilotDashboardMetricExplanationKey,
      },
      {
        label: 'Hypotheses',
        value: String(detail.metrics.hypothesisCount),
        icon: <CheckCircle2 className="h-5 w-5" />,
        metricKey: 'hypotheses' as PilotDashboardMetricExplanationKey,
      },
    ];
  }, [cohortFilter, detail, visibleMetrics.activeAthleteCount, visibleMetrics.athletesWithStablePatterns, visibleMetrics.cohortCount]);

  const updateHypothesisField = (id: string, field: keyof PulseCheckPilotHypothesis, value: string) => {
    setEditingHypotheses((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
  };

  const saveHypothesis = async (hypothesis: PulseCheckPilotHypothesis) => {
    setSavingHypothesisId(hypothesis.id);
    setPageMessage(null);
    try {
      await pulseCheckPilotDashboardService.saveHypothesis({
        id: hypothesis.id,
        pilotId: hypothesis.pilotId,
        code: hypothesis.code,
        statement: hypothesis.statement,
        leadingIndicator: hypothesis.leadingIndicator,
        status: hypothesis.status,
        confidenceLevel: hypothesis.confidenceLevel,
        keyEvidence: hypothesis.keyEvidence,
        notes: hypothesis.notes,
      });
      await load('refresh');
    } catch (saveError: any) {
      setPageMessage({ type: 'error', text: saveError?.message || 'Failed to save hypothesis.' });
    } finally {
      setSavingHypothesisId(null);
    }
  };

  const seedDefaults = async () => {
    if (!pilotId) return;
    setSeedingDefaults(true);
    setPageMessage(null);
    try {
      await pulseCheckPilotDashboardService.seedDefaultHypotheses(pilotId);
      await load('refresh');
      setActiveTab('hypotheses');
    } catch (seedError: any) {
      setPageMessage({ type: 'error', text: seedError?.message || 'Failed to seed default hypotheses.' });
    } finally {
      setSeedingDefaults(false);
    }
  };

  const handleGenerateHypothesisAssist = async () => {
    if (!detail) return;

    setGeneratingHypothesisAssist(true);
    setPageMessage(null);
    try {
      const result = await pulseCheckPilotDashboardService.generatePilotHypothesisAssist({
        options: {
          pilotId: detail.pilot.id,
          cohortId: selectedCohort?.id || '',
        },
        frame: {
          pilotId: detail.pilot.id,
          organizationId: detail.organization.id,
          organizationName: detail.organization.displayName,
          teamId: detail.team.id,
          teamName: detail.team.displayName,
          pilotName: detail.pilot.name,
          pilotStatus: detail.pilot.status,
          pilotStudyMode: detail.pilot.studyMode,
          cohortId: selectedCohort?.id || '',
          cohortName: selectedCohort?.name || '',
          metrics: {
            ...visibleMetrics,
            totalEnrollmentCount: detail.metrics.totalEnrollmentCount,
            hypothesisCount: detail.metrics.hypothesisCount,
          },
          coverage: visibleCoverage,
          outcomes: visibleOutcomeMetrics
            ? {
                enrollmentRate: visibleOutcomeMetrics.enrollmentRate,
                adherenceRate: visibleOutcomeMetrics.adherenceRate,
                mentalPerformanceDelta: visibleOutcomeMetrics.mentalPerformanceDelta,
                athleteTrust: visibleOutcomeMetrics.athleteTrust,
                athleteNps: visibleOutcomeMetrics.athleteNps,
                coachTrust: visibleOutcomeMetrics.coachTrust,
                coachNps: visibleOutcomeMetrics.coachNps,
                clinicianTrust: visibleOutcomeMetrics.clinicianTrust,
                clinicianNps: visibleOutcomeMetrics.clinicianNps,
              }
            : undefined,
          outcomeSurveyDiagnostics: visibleOutcomeDiagnostics || undefined,
          hypothesisEvaluation: visibleHypothesisEvaluation || undefined,
          cohortSummaries: visibleCohortSummaries,
          hypotheses: detail.hypotheses.map((hypothesis) => ({
            code: hypothesis.code,
            statement: hypothesis.statement,
            leadingIndicator: hypothesis.leadingIndicator,
            status: hypothesis.status,
            confidenceLevel: hypothesis.confidenceLevel,
            keyEvidence: hypothesis.keyEvidence || '',
            notes: hypothesis.notes || '',
          })),
        },
      });

      setHypothesisAssistSuggestions(result.suggestions);
      setHypothesisAssistMeta({
        modelVersion: result.modelVersion,
        promptVersion: result.promptVersion,
      });
      setPageMessage({
        type: 'success',
        text:
          result.suggestions.length > 0
            ? `Hypothesis Assist generated ${result.suggestions.length} pilot-scoped suggestion${result.suggestions.length === 1 ? '' : 's'}.`
            : 'Hypothesis Assist did not find a strong new suggestion in the current pilot frame.',
      });
    } catch (assistError) {
      console.error('[PulseCheckPilotDashboard] Failed to generate hypothesis suggestions:', assistError);
      setPageMessage({ type: 'error', text: 'Failed to generate pilot hypothesis suggestions.' });
    } finally {
      setGeneratingHypothesisAssist(false);
    }
  };

  const handleCreateSuggestedHypothesis = async (suggestion: PilotHypothesisAssistSuggestion) => {
    if (!detail) return;

    setCreatingSuggestedHypothesisKey(suggestion.suggestionKey);
    setPageMessage(null);
    try {
      const assignedCode = nextHypothesisCode;
      await pulseCheckPilotDashboardService.saveHypothesis({
        pilotId: detail.pilot.id,
        code: assignedCode,
        statement: suggestion.statement,
        leadingIndicator: suggestion.leadingIndicator,
        status: 'not-enough-data',
        confidenceLevel: suggestion.confidenceLevel,
        keyEvidence: '',
        notes: `Seeded by Hypothesis Assist (${hypothesisAssistMeta?.modelVersion || 'unknown model'}). Why suggested: ${suggestion.whySuggested}${suggestion.caveat ? ` Caveat: ${suggestion.caveat}` : ''}`,
      });
      setHypothesisAssistSuggestions((current) => current.filter((item) => item.suggestionKey !== suggestion.suggestionKey));
      await load('refresh');
      setActiveTab('hypotheses');
      setPageMessage({
        type: 'success',
        text: `Created ${assignedCode} from Hypothesis Assist.`,
      });
    } catch (createError) {
      console.error('[PulseCheckPilotDashboard] Failed to create suggested hypothesis:', createError);
      setPageMessage({ type: 'error', text: 'Failed to create suggested hypothesis.' });
    } finally {
      setCreatingSuggestedHypothesisKey(null);
    }
  };

  const copyInviteLink = async (inviteId: string, shareUrl: string, successText: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedInviteId(inviteId);
      if (copyFeedbackTimeoutRef.current) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopiedInviteId((current) => (current === inviteId ? null : current));
      }, 1800);
      setPageMessage({ type: 'success', text: successText });
    } catch (copyError) {
      console.error('[PulseCheckPilotDashboard] Failed to copy invite link:', copyError);
      setPageMessage({ type: 'error', text: 'Failed to copy invite link.' });
    }
  };

  const handleCreatePilotInviteLink = async (redemptionMode: InviteCreationMode) => {
    if (!detail) return;
    setCreatingInviteMode(redemptionMode);
    setPageMessage(null);
    try {
      if (demoModeEnabled) {
        const createdInvite = pulseCheckPilotDashboardService.createDemoInviteLink({
          pilotId: detail.pilot.id,
          pilotName: detail.pilot.name,
          redemptionMode,
          cohortId: selectedInviteCohort?.id || '',
          cohortName: selectedInviteCohort?.name || '',
          createdByUserId: currentUser?.id || '',
          createdByEmail: currentUser?.email || '',
        });
        setInviteLinks(pulseCheckPilotDashboardService.listDemoInviteLinks());
        if (createdInvite) {
          await navigator.clipboard.writeText(resolveInviteShareUrl(createdInvite));
        }
        setPageMessage({
          type: 'success',
          text: selectedInviteCohort
            ? `${redemptionMode === 'general' ? 'General' : 'Single-use'} pilot share link for ${selectedInviteCohort.name} is ready and copied.`
            : `${redemptionMode === 'general' ? 'General' : 'Single-use'} pilot athlete share link is ready and copied.`,
        });
        return;
      }

      const inviteId = await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: detail.organization.id,
        teamId: detail.team.id,
        teamMembershipRole: 'athlete',
        redemptionMode,
        revokeExistingMatchingLinks: redemptionMode === 'general',
        pilotId: detail.pilot.id,
        pilotName: detail.pilot.name,
        cohortId: selectedInviteCohort?.id || '',
        cohortName: selectedInviteCohort?.name || '',
        createdByUserId: currentUser?.id || '',
        createdByEmail: currentUser?.email || '',
      });

      const refreshedInviteLinks = await pulseCheckProvisioningService.listTeamInviteLinks(detail.team.id);
      setInviteLinks(refreshedInviteLinks);
      const createdInvite = refreshedInviteLinks.find((invite) => invite.id === inviteId);
      if (createdInvite) {
        await navigator.clipboard.writeText(resolveInviteShareUrl(createdInvite));
      }

      setPageMessage({
        type: 'success',
        text: selectedInviteCohort
          ? `${redemptionMode === 'general' ? 'General' : 'Single-use'} pilot share link for ${selectedInviteCohort.name} is ready and copied.`
          : `${redemptionMode === 'general' ? 'General' : 'Single-use'} pilot athlete share link is ready and copied.`,
      });
    } catch (inviteError) {
      console.error('[PulseCheckPilotDashboard] Failed to create pilot invite link:', inviteError);
      setPageMessage({ type: 'error', text: 'Failed to create pilot athlete invite link.' });
    } finally {
      setCreatingInviteMode(null);
    }
  };

  const handleDeletePilotInviteLink = async (invite: PulseCheckInviteLink) => {
    const confirmed = window.confirm(
      invite.redemptionMode === 'general'
        ? 'Delete this general invite link? Once removed, the QR code and share URL will stop working until you generate a new link.'
        : 'Delete this invite link? Once removed, this share URL will stop working.'
    );
    if (!confirmed) return;

    setDeletingInviteId(invite.id);
    setPageMessage(null);
    try {
      if (demoModeEnabled) {
        pulseCheckPilotDashboardService.deleteDemoInviteLink(invite.id);
        setInviteLinks(pulseCheckPilotDashboardService.listDemoInviteLinks());
      } else {
        await pulseCheckProvisioningService.deleteInviteLink(invite.id);
        const refreshedInviteLinks = await pulseCheckProvisioningService.listTeamInviteLinks(detail?.team.id || '');
        setInviteLinks(refreshedInviteLinks);
      }

      setPageMessage({
        type: 'success',
        text: invite.redemptionMode === 'general' ? 'General invite link deleted.' : 'Invite link deleted.',
      });
    } catch (deleteError) {
      console.error('[PulseCheckPilotDashboard] Failed to delete pilot invite link:', deleteError);
      setPageMessage({ type: 'error', text: 'Failed to delete pilot invite link.' });
    } finally {
      setDeletingInviteId(null);
    }
  };

  const handleUnenrollAthlete = async (athlete: PilotDashboardDetail['rosterAthletes'][number]) => {
    if (!detail) return;
    if (!athlete.isEnrolled || !athlete.pilotEnrollment) {
      setPageMessage({ type: 'error', text: `${athlete.displayName} is not currently enrolled in this pilot.` });
      return;
    }

    const confirmed = window.confirm(
      `Unenroll ${athlete.displayName} from ${detail.pilot.name}? They will stop appearing in this pilot's active athlete reporting.`
    );
    if (!confirmed) return;

    if (demoModeEnabled) {
      setPageMessage({ type: 'error', text: 'Demo mode does not support unenrolling athletes.' });
      return;
    }

    setUnenrollingAthleteId(athlete.athleteId);
    setPageMessage(null);
    try {
      await pulseCheckProvisioningService.unenrollAthleteFromPilot({
        pilotId: detail.pilot.id,
        athleteId: athlete.athleteId,
        actorUserId: currentUser?.id || '',
        actorEmail: currentUser?.email || '',
      });
      await load('refresh');
      setPageMessage({
        type: 'success',
        text: `${athlete.displayName} was unenrolled from this pilot and no longer counts toward active pilot reporting.`,
      });
    } catch (unenrollError: any) {
      console.error('[PulseCheckPilotDashboard] Failed to unenroll athlete from pilot:', unenrollError);
      setPageMessage({ type: 'error', text: unenrollError?.message || 'Failed to unenroll athlete from this pilot.' });
    } finally {
      setUnenrollingAthleteId(null);
    }
  };

  const handleSaveAthleteCohort = async (athlete: PilotDashboardDetail['rosterAthletes'][number]) => {
    if (!detail) return;
    if (!athlete.isEnrolled || !athlete.pilotEnrollment) {
      setPageMessage({ type: 'error', text: `${athlete.displayName} is not currently enrolled in this pilot.` });
      return;
    }

    const nextCohortId = athleteCohortDrafts[athlete.athleteId] ?? athlete.pilotEnrollment.cohortId ?? '';
    const currentCohortId = athlete.pilotEnrollment.cohortId || '';
    if (nextCohortId === currentCohortId) return;

    setSavingAthleteCohortId(athlete.athleteId);
    setPageMessage(null);
    try {
      if (demoModeEnabled) {
        pulseCheckPilotDashboardService.assignDemoAthleteToCohort({
          athleteId: athlete.athleteId,
          cohortId: nextCohortId,
          actorUserId: currentUser?.id || '',
          actorEmail: currentUser?.email || '',
        });
      } else {
        await pulseCheckProvisioningService.assignAthleteToPilotCohort({
          pilotId: detail.pilot.id,
          athleteId: athlete.athleteId,
          cohortId: nextCohortId,
          actorUserId: currentUser?.id || '',
          actorEmail: currentUser?.email || '',
        });
      }

      await load('refresh');
      const cohortName = detail.cohorts.find((cohort) => cohort.id === nextCohortId)?.name || '';
      setPageMessage({
        type: 'success',
        text: cohortName
          ? `${athlete.displayName} is now assigned to ${cohortName}.`
          : `${athlete.displayName} was moved out of a cohort and is now unassigned.`,
      });
    } catch (assignmentError: any) {
      console.error('[PulseCheckPilotDashboard] Failed to update athlete cohort assignment:', assignmentError);
      setPageMessage({ type: 'error', text: assignmentError?.message || 'Failed to update athlete cohort assignment.' });
    } finally {
      setSavingAthleteCohortId(null);
    }
  };

  const handleSeedAthleteData = async (athlete: PilotDashboardDetail['rosterAthletes'][number]) => {
    if (!detail) return;
    if (!athlete.pilotEnrollment || athlete.pilotEnrollment.status !== 'active') {
      setPageMessage({ type: 'error', text: `${athlete.displayName} needs an active pilot enrollment before seeding data.` });
      return;
    }

    if (demoModeEnabled) {
      setPageMessage({ type: 'error', text: 'Demo mode does not support seeding pilot athlete data.' });
      return;
    }

    setSeedingAthleteDataId(athlete.athleteId);
    setPageMessage(null);
    try {
      await pulseCheckProvisioningService.backfillPilotAthleteOutcomeHistory({
        pilotId: detail.pilot.id,
        athleteId: athlete.athleteId,
        pilotEnrollmentId: athlete.pilotEnrollment.id,
        teamMembershipId: athlete.pilotEnrollment.teamMembershipId,
        lookbackDays: 14,
        source: 'pilot_athlete_manual_seed',
        actorRole: 'admin',
      });
      await load('refresh');
      setPageMessage({
        type: 'success',
        text: `${athlete.displayName}'s recent PulseCheck history was seeded into this pilot study-metrics frame.`,
      });
    } catch (seedError: any) {
      console.error('[PulseCheckPilotDashboard] Failed to seed pilot athlete outcome history:', seedError);
      setPageMessage({ type: 'error', text: seedError?.message || 'Failed to seed this athlete into the pilot study metrics summary.' });
    } finally {
      setSeedingAthleteDataId(null);
    }
  };

  const updateInviteConfigField = (field: keyof PulseCheckPilotInviteConfig, value: string) => {
    setInviteConfigDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const updateRequiredConsentField = (
    index: number,
    field: keyof PulseCheckRequiredConsentDocument,
    value: string
  ) => {
    setRequiredConsentDrafts((current) =>
      current.map((consent, consentIndex) =>
        consentIndex === index ? { ...consent, [field]: value } : consent
      )
    );
  };

  const addRequiredConsentDraft = () => {
    setRequiredConsentDrafts((current) => [
      ...current,
      {
        id: `custom-disclosure-${current.length + 1}`,
        title: '',
        body: '',
        version: 'v1',
      },
    ]);
  };

  const removeRequiredConsentDraft = (index: number) => {
    setRequiredConsentDrafts((current) => current.filter((_, consentIndex) => consentIndex !== index));
  };

  const applyCurrentStudyModeDisclosureDefaults = () => {
    if (!detail) return;
    setRequiredConsentDrafts(getDefaultPulseCheckRequiredConsents(detail.pilot.studyMode));
    setPageMessage(null);
  };

  const saveInviteConfig = async () => {
    if (!detail || !inviteConfigDraft) return;
    setSavingInviteConfig(true);
    setPageMessage(null);
    try {
      await pulseCheckPilotDashboardService.saveInviteConfig({
        pilotId: detail.pilot.id,
        organizationId: detail.organization.id,
        teamId: detail.team.id,
        welcomeHeadline: inviteConfigDraft.welcomeHeadline,
        welcomeBody: inviteConfigDraft.welcomeBody,
        existingAthleteInstructions: inviteConfigDraft.existingAthleteInstructions,
        newAthleteInstructions: inviteConfigDraft.newAthleteInstructions,
        wearableRequirements: inviteConfigDraft.wearableRequirements,
        baselineExpectations: inviteConfigDraft.baselineExpectations,
        supportName: inviteConfigDraft.supportName,
        supportEmail: inviteConfigDraft.supportEmail,
        supportPhone: inviteConfigDraft.supportPhone,
        iosAppUrl: inviteConfigDraft.iosAppUrl,
        androidAppUrl: inviteConfigDraft.androidAppUrl,
      });
      await load('refresh');
      setPageMessage({ type: 'success', text: 'Pilot invite instructions saved.' });
    } catch (saveError) {
      console.error('[PulseCheckPilotDashboard] Failed to save invite config:', saveError);
      setPageMessage({ type: 'error', text: 'Failed to save pilot invite instructions.' });
    } finally {
      setSavingInviteConfig(false);
    }
  };

  const saveRequiredConsents = async () => {
    if (!detail) return;
    setSavingRequiredConsents(true);
    setPageMessage(null);

    try {
      const normalized = requiredConsentDrafts
        .map((consent, index) => normalizeRequiredConsentDraft(consent, index))
        .filter((consent) => consent.title && consent.body);

      await pulseCheckPilotDashboardService.savePilotRequiredConsents({
        pilotId: detail.pilot.id,
        requiredConsents: normalized,
      });
      await load('refresh');
      setPageMessage({
        type: 'success',
        text: normalized.length === 0 ? 'Required disclosures cleared for this pilot.' : 'Required disclosures saved for this pilot.',
      });
    } catch (saveError) {
      console.error('[PulseCheckPilotDashboard] Failed to save required consents:', saveError);
      setPageMessage({ type: 'error', text: 'Failed to save required disclosures.' });
    } finally {
      setSavingRequiredConsents(false);
    }
  };

  const openStaffSurveyModal = (role: 'coach' | 'clinician') => {
    setStaffSurveyModalRole(role);
  };

  const handleStaffSurveySubmitted = () => {
    setPageMessage({
      type: 'success',
      text: 'Staff feedback submitted. Study metrics will refresh as the survey response is recorded.',
    });
    void load('refresh');
  };

  const saveInviteDefault = async (scopeType: 'team' | 'organization') => {
    if (!detail || !inviteConfigDraft) return;
    setSavingInviteDefaultScope(scopeType);
    setPageMessage(null);
    try {
      await pulseCheckPilotDashboardService.saveInviteDefault({
        scopeType,
        organizationId: detail.organization.id,
        teamId: detail.team.id,
        welcomeHeadline: inviteConfigDraft.welcomeHeadline,
        welcomeBody: inviteConfigDraft.welcomeBody,
        existingAthleteInstructions: inviteConfigDraft.existingAthleteInstructions,
        newAthleteInstructions: inviteConfigDraft.newAthleteInstructions,
        wearableRequirements: inviteConfigDraft.wearableRequirements,
        baselineExpectations: inviteConfigDraft.baselineExpectations,
        supportName: inviteConfigDraft.supportName,
        supportEmail: inviteConfigDraft.supportEmail,
        supportPhone: inviteConfigDraft.supportPhone,
        iosAppUrl: inviteConfigDraft.iosAppUrl,
        androidAppUrl: inviteConfigDraft.androidAppUrl,
      });
      await load('refresh');
      setPageMessage({
        type: 'success',
        text: scopeType === 'team' ? 'Saved current invite config as the team default.' : 'Saved current invite config as the organization default.',
      });
    } catch (saveError) {
      console.error('[PulseCheckPilotDashboard] Failed to save invite default:', saveError);
      setPageMessage({
        type: 'error',
        text: scopeType === 'team' ? 'Failed to save team invite default.' : 'Failed to save organization invite default.',
      });
    } finally {
      setSavingInviteDefaultScope(null);
    }
  };

  const handleGenerateResearchReadout = async () => {
    if (!detail) return;
    if (!readoutDateWindowStart || !readoutDateWindowEnd) {
      setPageMessage({ type: 'error', text: 'Choose a valid date window before generating a research readout.' });
      return;
    }

    setGeneratingResearchReadout(true);
    setPageMessage(null);
    try {
      await pulseCheckPilotDashboardService.generatePilotResearchReadout({
        options: {
          pilotId: detail.pilot.id,
          cohortId: selectedCohort?.id || '',
          dateWindowStart: readoutDateWindowStart,
          dateWindowEnd: readoutDateWindowEnd,
          baselineMode: readoutBaselineMode,
        },
        frame: {
          pilotId: detail.pilot.id,
          organizationId: detail.organization.id,
          organizationName: detail.organization.displayName,
          teamId: detail.team.id,
          teamName: detail.team.displayName,
          pilotName: detail.pilot.name,
          pilotStatus: detail.pilot.status,
          pilotStudyMode: detail.pilot.studyMode,
          cohortId: selectedCohort?.id || '',
          cohortName: selectedCohort?.name || '',
          dateWindowStart: readoutDateWindowStart,
          dateWindowEnd: readoutDateWindowEnd,
          baselineMode: readoutBaselineMode,
          metrics: {
            ...visibleMetrics,
            totalEnrollmentCount: detail.metrics.totalEnrollmentCount,
            hypothesisCount: detail.metrics.hypothesisCount,
          },
          coverage: visibleCoverage,
          cohortSummaries: visibleCohortSummaries,
          hypotheses: detail.hypotheses.map((hypothesis) => ({
            code: hypothesis.code,
            statement: hypothesis.statement,
            leadingIndicator: hypothesis.leadingIndicator,
            status: hypothesis.status,
            confidenceLevel: hypothesis.confidenceLevel,
            keyEvidence: hypothesis.keyEvidence || '',
            notes: hypothesis.notes || '',
          })),
        },
      });
      await load('refresh');
      setActiveTab('research-readout');
      setPageMessage({ type: 'success', text: 'Pilot research readout generated and saved as a draft.' });
    } catch (generateError) {
      console.error('[PulseCheckPilotDashboard] Failed to generate research readout:', generateError);
      setPageMessage({ type: 'error', text: 'Failed to generate pilot research readout.' });
    } finally {
      setGeneratingResearchReadout(false);
    }
  };

  const updateReadoutSection = (sectionKey: PilotResearchReadoutSection['sectionKey'], patch: Partial<PilotResearchReadoutSection>) => {
    setEditingReadout((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) => (section.sectionKey === sectionKey ? { ...section, ...patch } : section)),
      };
    });
  };

  const saveResearchReadoutReview = async () => {
    if (!editingReadout) return;
    setSavingResearchReadoutReview(true);
    setPageMessage(null);
    try {
      await pulseCheckPilotDashboardService.updatePilotResearchReadoutReview({
        readoutId: editingReadout.id,
        reviewState: editingReadout.reviewState,
        sections: editingReadout.sections.map((section) => ({
          sectionKey: section.sectionKey,
          reviewerResolution: section.reviewerResolution,
          reviewerNotes: section.reviewerNotes || '',
        })),
      });
      await load('refresh');
      setPageMessage({ type: 'success', text: 'Research readout review was saved.' });
    } catch (reviewError) {
      console.error('[PulseCheckPilotDashboard] Failed to save research readout review:', reviewError);
      setPageMessage({ type: 'error', text: 'Failed to save research readout review.' });
    } finally {
      setSavingResearchReadoutReview(false);
    }
  };

  const resetInviteConfigOverride = async () => {
    if (!detail?.hasPilotInviteConfigOverride) return;
    setResettingInviteConfig(true);
    setPageMessage(null);
    try {
      await pulseCheckPilotDashboardService.resetInviteConfigOverride(detail.pilot.id);
      await load('refresh');
      setPageMessage({ type: 'success', text: 'Pilot override removed. This pilot now inherits the team and organization invite defaults.' });
    } catch (resetError) {
      console.error('[PulseCheckPilotDashboard] Failed to reset invite override:', resetError);
      setPageMessage({ type: 'error', text: 'Failed to reset the pilot invite override.' });
    } finally {
      setResettingInviteConfig(false);
    }
  };

  const triggerOutcomeRecompute = async () => {
    if (!detail) return;
    setRecomputingOutcomeRollups(true);
    setPageMessage(null);
    try {
      await pulseCheckPilotDashboardService.triggerPilotOutcomeRollupRecompute({
        pilotId: detail.pilot.id,
        lookbackDays: 30,
      });
      await load('refresh');
      setPageMessage({
        type: 'success',
        text: 'Study metrics refresh queued for this pilot.',
      });
    } catch (recomputeError) {
      console.error('[PulseCheckPilotDashboard] Failed to recompute outcome rollups:', recomputeError);
      setPageMessage({ type: 'error', text: 'Failed to refresh pilot study metrics.' });
    } finally {
      setRecomputingOutcomeRollups(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>{detail ? `${detail.pilot.name} | Pilot Dashboard` : 'Pilot Dashboard'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="pilot-detail-theme pilot-font-body min-h-screen text-white">
        <div className="pilot-ambient-layer" aria-hidden="true">
          <div className="pilot-ambient-orb pilot-ambient-orb-teal" />
          <div className="pilot-ambient-orb pilot-ambient-orb-blue" />
          <div className="pilot-ambient-orb pilot-ambient-orb-amber" />
        </div>

        <div className="relative z-10">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(7,9,15,0.82)] backdrop-blur-2xl">
            <div className="mx-auto flex h-[52px] max-w-[1700px] items-center justify-between px-4 sm:px-8">
              <div className="flex min-w-0 items-center gap-4">
                <Link
                  href="/admin/pulsecheckPilotDashboard"
                  className="pilot-font-display flex items-center gap-2 text-sm font-bold tracking-[-0.03em] text-white"
                >
                  <span className="pilot-logo-dot" />
                  PulseCheck
                </Link>
                <div className="hidden h-5 w-px bg-white/10 sm:block" />
                <Link
                  href="/admin/pulsecheckPilotDashboard"
                  className="inline-flex items-center gap-2 truncate text-xs text-white/40 transition hover:text-white/75"
                >
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                  Active Pilots
                </Link>
              </div>

              <div className="flex items-center gap-2">
                {detail ? (
                  <span className="hidden rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/60 lg:inline-flex">
                    {detail.pilot.studyMode}
                  </span>
                ) : null}
                <span
                  className={`hidden rounded-lg border px-3 py-1.5 text-[11px] md:inline-flex ${
                    demoModeEnabled
                      ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
                      : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                  }`}
                >
                  {demoModeEnabled ? 'Demo dataset' : 'Live dataset'}
                </span>
                <LocalFirebaseModeButton />
              </div>
            </div>
          </header>

          <div className="border-b border-white/10">
            <div className="mx-auto max-w-[1700px] px-4 pb-5 pt-6 sm:px-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-4xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#00d4aa]">
                    {detail ? `${detail.organization.displayName} / ${detail.team.displayName}` : 'PulseCheck Admin'}
                  </div>
                  <h1 className="pilot-font-display mt-2 text-3xl font-bold tracking-[-0.04em] text-white sm:text-[2.35rem]">
                    {detail?.pilot.name || 'Pilot dashboard'}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50 sm:text-[15px]">
                    Active-pilot monitoring surface rooted in PilotEnrollment. Athletes outside this pilot are excluded from
                    every KPI, comparison, and drill-down on this page.
                  </p>

                  {detail ? (
                    <>
                      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-cyan-100">
                          Study mode: {detail.pilot.studyMode}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-white/65">
                          Cadence: {detail.pilot.checkpointCadence || 'Not set'}
                        </span>
                      </div>

                      {detail.pilot.objective ? (
                        <div className="mt-4 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">Objective</div>
                          <div className="mt-2 text-sm leading-6 text-zinc-300">{detail.pilot.objective}</div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2.5 xl:max-w-[640px] xl:justify-end">
                  <button
                    onClick={() => void load('refresh')}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </button>

                  <button
                    onClick={() => void toggleDemoMode()}
                    data-testid="pilot-dashboard-detail-demo-toggle"
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                      demoModeEnabled
                        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15'
                        : 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15'
                    }`}
                  >
                    <MonitorPlay className="h-4 w-4" />
                    {demoModeEnabled ? 'Exit Demo Mode' : 'Switch To Demo Mode'}
                  </button>

                  {demoModeEnabled ? (
                    <button
                      onClick={() => void resetDemoModeData()}
                      data-testid="pilot-dashboard-detail-demo-reset"
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-400/15"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Reset Demo Data
                    </button>
                  ) : null}
                </div>
              </div>

              {demoModeEnabled ? (
                <div
                  data-testid="pilot-dashboard-detail-demo-banner"
                  className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
                >
                  Demo mode is on. This pilot dashboard is using safe local mock data, mock athlete enrollments, and
                  mock AI research briefs so you can demo and QA without touching live pilot records.
                </div>
              ) : null}

              {detail?.team?.id ? (
                <div className="mt-5">
                  <Tier3RoutingReadinessBanner
                    teamId={detail.team.id}
                    membershipsHref={`/admin/pulsecheckProvisioning?team=${encodeURIComponent(detail.team.id)}`}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <main className="px-4 py-6 sm:px-8 sm:py-7">
            <div className="mx-auto max-w-[1700px]">
              {loading ? (
                <div className="pilot-detail-panel rounded-[28px] p-8 text-sm text-white/50">Loading pilot dashboard...</div>
              ) : error ? (
                <div className="rounded-[28px] border border-rose-500/30 bg-rose-500/10 p-8 text-sm text-rose-200">{error}</div>
              ) : !detail ? (
                <div className="pilot-detail-panel rounded-[28px] p-8 text-sm text-white/50">Pilot not found.</div>
              ) : (
                <>
                  <div className="grid gap-3 xl:grid-cols-4">
                    {overviewCards.map((card) => (
                      <div key={card.label} className="pilot-detail-panel rounded-[22px] border border-white/10 bg-[#11151f] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-[#7cefd6]">
                              {card.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                                {card.label}
                              </div>
                              <div className="pilot-font-mono mt-4 text-[2rem] leading-none text-white">{card.value}</div>
                            </div>
                          </div>
                          <NoraMetricHelpButton
                            metricKey={card.metricKey}
                            className="border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#7cefd6] hover:bg-white/[0.08]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 overflow-x-auto border-b border-white/10">
                    <div className="flex min-w-max gap-1">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          data-testid={`pilot-dashboard-tab-${tab.id}`}
                          className={`relative -mb-px whitespace-nowrap px-5 py-3 text-sm font-medium transition ${
                            activeTab === tab.id
                              ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#00d4aa]'
                              : 'text-white/35 hover:text-white/75'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pilot-detail-panel mt-4 grid grid-cols-1 gap-4 rounded-[22px] border border-white/10 bg-[#11151f] p-4 lg:grid-cols-[minmax(0,300px),1fr]">
                    <label className="space-y-2 text-sm text-white/75">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Cohort</span>
                      <select
                        value={cohortFilter}
                        onChange={(event) => setCohortFilter(event.target.value)}
                        className="pilot-detail-select w-full rounded-xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                      >
                        <option value="">All pilot cohorts</option>
                        {availableCohorts.map((cohort) => (
                          <option key={cohort.id} value={cohort.id}>
                            {cohort.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="pilot-detail-inset rounded-[18px] border border-white/5 bg-black/20 p-4 text-sm leading-6 text-white/55">
                      All KPI cards, comparisons, and tables on this page stay locked to active <code>PilotEnrollment</code>{' '}
                      records in this pilot
                      {selectedCohort ? ` and the ${selectedCohort.name} cohort filter.` : '.'} Athletes outside this pilot
                      are excluded.
                    </div>
                  </div>

              {activeTab === 'overview' ? (
                <div className="mt-6 space-y-6">
                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Operational Watch List</div>
                        <h2 className="mt-2 text-lg font-semibold text-white">Restriction summary</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          Compact view of review-queued states and active suppression flags across this pilot.
                        </p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-300">
                        Internal-only operational overlay
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4 2xl:grid-cols-8">
                      {operationalWatchListSummaryCards.map((card) => (
                        <div key={card.label} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{card.label}</div>
                          <div className={`pilot-font-mono mt-3 text-2xl leading-none ${card.accentClassName.replace(/border-[^ ]+ bg-[^ ]+ /g, '')}`}>
                            {card.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Study Metrics</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">Study Metrics Snapshot</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          {selectedCohort
                            ? `Showing ${selectedCohort.name} when cohort-specific study metrics are available.`
                            : 'Showing the whole-pilot study metrics summary for the active pilot.'}
                        </p>
                      </div>
                      {selectedCohort ? (
                        <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                          Cohort view
                        </div>
                      ) : null}
                      {!demoModeEnabled && showStudyMetricsStatusLink ? (
                        <button
                          type="button"
                          onClick={() => setStudyMetricsStatusModalOpen(true)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${
                            metricsRefreshState === 'broken'
                              ? 'border-rose-400/25 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15'
                              : 'border-amber-400/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15'
                          }`}
                        >
                          <Database className="h-3.5 w-3.5" />
                          Check status
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {OUTCOME_CARD_ORDER.map((metricKey) => {
                        const metric = visibleOutcomeMetrics;
                        return (
                          <div key={metricKey} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                              {OUTCOME_CARD_PRESENTATION[metricKey].label}
                            </div>
                            <div className="mt-3 text-3xl font-semibold text-white">
                              {formatOutcomeValue(metricKey, metric)}
                            </div>
                            <div className="mt-2 text-sm text-zinc-400">
                              {formatOutcomeSubtext(
                                metricKey,
                                metric,
                                visibleOutcomeDiagnostics,
                                metricKey === 'enrollment' ? visibleEnrollmentCount : null
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 text-xs text-zinc-500">
                      Trust and NPS stay separate. When the sample is below the minimum threshold, the dashboard shows
                      “Not enough responses yet” instead of a misleading score.
                    </div>

                    {visibleSurveyMetricSlices ? (
                      <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Survey Diagnostics</div>
                            <h3 className="mt-2 text-lg font-semibold text-white">Role-Sliced Trust and NPS</h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              These cards expose the full athlete, coach, and clinician trust/NPS breakdown with low-sample handling preserved.
                            </p>
                          </div>
                          {visibleOutcomeDiagnostics ? (
                            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                              Minimum sample: {visibleOutcomeDiagnostics.minimumResponseThreshold} responses
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {SURVEY_METRIC_CARDS.map((card) => (
                            <div key={card.key} className="relative rounded-3xl border border-white/10 bg-[#0b0f17] p-4">
                              <NoraMetricHelpButton metricKey={card.helpKey} className="absolute right-4 top-4" />
                              <div className="flex items-center gap-2 text-sm font-medium text-white">
                                <span className={`rounded-full border px-2 py-1 text-[11px] ${card.accentClassName}`}>{card.label}</span>
                              </div>
                              <div className="mt-3 text-3xl font-semibold text-white">
                                {formatSurveyMetricValue(card.key, visibleSurveyMetricSlices)}
                              </div>
                              <div className="mt-2 text-sm text-zinc-400">
                                {formatSurveyMetricSubtext(card.key, visibleOutcomeDiagnostics)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className={`mt-6 grid grid-cols-1 gap-4 ${visibleRecommendationTypeSlices ? 'xl:grid-cols-2' : ''}`}>
                      {visibleRecommendationTypeSlices ? (
                        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Recommendation-Type Study Metric Slices</div>
                          <h3 className="mt-2 text-lg font-semibold text-white">Trust and adherence by recommendation path</h3>
                          <p className="mt-1 text-sm text-zinc-400">
                            These slices stay study-metric based: they compare trust and adherence by recommendation exposure rather than by raw projection counts.
                          </p>
                          <div className="mt-4 space-y-4">
                            <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">State-Aware vs Fallback</div>
                              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-zinc-400">State-aware</div>
                                  <div className="mt-1 text-white">{formatComparisonMetricValue(visibleRecommendationTypeSlices.stateAwareVsFallback?.stateAware?.adherenceRate, 'percent')} adherence</div>
                                  <div className="mt-1 text-white">{formatComparisonMetricValue(visibleRecommendationTypeSlices.stateAwareVsFallback?.stateAware?.athleteTrust, 'score')} trust</div>
                                </div>
                                <div>
                                  <div className="text-zinc-400">Fallback / none</div>
                                  <div className="mt-1 text-white">{formatComparisonMetricValue(visibleRecommendationTypeSlices.stateAwareVsFallback?.fallbackOrNone?.adherenceRate, 'percent')} adherence</div>
                                  <div className="mt-1 text-white">{formatComparisonMetricValue(visibleRecommendationTypeSlices.stateAwareVsFallback?.fallbackOrNone?.athleteTrust, 'score')} trust</div>
                                </div>
                              </div>
                              <div className="mt-3 text-xs text-zinc-500">
                                Delta: {formatSignedDelta(visibleRecommendationTypeSlices.stateAwareVsFallback?.delta?.adherenceRate, ' pts')} adherence, {formatSignedDelta(visibleRecommendationTypeSlices.stateAwareVsFallback?.delta?.athleteTrust)} trust
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Completed Protocol vs Incomplete / Skipped</div>
                              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-zinc-400">Completed protocol</div>
                                  <div className="mt-1 text-white">{formatComparisonMetricValue(visibleRecommendationTypeSlices.protocolCompletion?.completedProtocol?.adherenceRate, 'percent')} adherence</div>
                                  <div className="mt-1 text-white">{formatComparisonMetricValue(visibleRecommendationTypeSlices.protocolCompletion?.completedProtocol?.athleteTrust, 'score')} trust</div>
                                </div>
                                <div>
                                  <div className="text-zinc-400">Incomplete / skipped</div>
                                  <div className="mt-1 text-white">{formatComparisonMetricValue(visibleRecommendationTypeSlices.protocolCompletion?.incompleteOrSkippedProtocol?.adherenceRate, 'percent')} adherence</div>
                                  <div className="mt-1 text-white">{formatComparisonMetricValue(visibleRecommendationTypeSlices.protocolCompletion?.incompleteOrSkippedProtocol?.athleteTrust, 'score')} trust</div>
                                </div>
                              </div>
                              <div className="mt-3 text-xs text-zinc-500">
                                Delta: {formatSignedDelta(visibleRecommendationTypeSlices.protocolCompletion?.delta?.adherenceRate, ' pts')} adherence, {formatSignedDelta(visibleRecommendationTypeSlices.protocolCompletion?.delta?.athleteTrust)} trust
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Care Escalations</div>
                            <h3 className="mt-2 text-lg font-semibold text-white">Current care activity</h3>
                            <p className="mt-1 text-sm text-zinc-400">
                              {selectedCohort
                                ? 'Care activity stays on the whole-pilot view so case counts and timing stay readable.'
                                : 'A simpler view of current care cases, status, and timing for this pilot.'}
                            </p>
                          </div>
                          {selectedCohort ? (
                            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-300">
                              Whole-pilot view
                            </div>
                          ) : null}
                        </div>

                        {!hasCareEscalationData ? (
                          <div className="mt-4 rounded-2xl border border-white/5 bg-[#0b0f17] p-5">
                            <div className="text-base font-semibold text-white">No care escalations recorded yet</div>
                            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                              This section will start showing current cases, status, and care timing once someone enters the current care workflow.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Current Cases</div>
                                <div className="mt-2 text-2xl font-semibold text-white">{currentCareEscalationCount}</div>
                                <div className="mt-1 text-xs text-zinc-500">Grouped care cases currently tracked on this pilot.</div>
                              </div>
                              <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Open Care</div>
                                <div className="mt-2 text-2xl font-semibold text-white">{visibleEscalationOperationalDiagnostics?.secondaryCounts?.openCareEscalations ?? 0}</div>
                                <div className="mt-1 text-xs text-zinc-500">Cases still waiting on care follow-through or closure.</div>
                              </div>
                              <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Resolved</div>
                                <div className="mt-2 text-2xl font-semibold text-white">{visibleEscalationOperationalDiagnostics?.statusCounts?.resolved ?? 0}</div>
                                <div className="mt-1 text-xs text-zinc-500">Cases already closed out in the current workflow.</div>
                              </div>
                              <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Median To Care</div>
                                <div className="mt-2 text-2xl font-semibold text-white">
                                  {visibleOutcomeMetrics?.medianMinutesToCare !== null && visibleOutcomeMetrics?.medianMinutesToCare !== undefined
                                    ? `${visibleOutcomeMetrics.medianMinutesToCare.toFixed(1)} min`
                                    : 'No sample yet'}
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">Median time from escalation to handoff initiation.</div>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,340px),1fr]">
                              <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Current Status</div>
                                <div className="mt-4 space-y-3">
                                  {[
                                    ['Active', visibleEscalationOperationalDiagnostics?.statusCounts?.active ?? 0],
                                    ['Declined', visibleEscalationOperationalDiagnostics?.statusCounts?.declined ?? 0],
                                    ['Coach Review Flags', visibleEscalationOperationalDiagnostics?.secondaryCounts?.coachReviewFlags ?? 0],
                                    ['Support Flags', visibleEscalationOperationalDiagnostics?.secondaryCounts?.supportFlags ?? 0],
                                  ].map(([label, value]) => (
                                    <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                                      <div className="text-sm text-zinc-300">{label}</div>
                                      <div className="pilot-font-mono text-lg text-white">{value}</div>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4">
                                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Tier Split</div>
                                  <div className="mt-2 text-sm text-white">
                                    Tier 1: {visibleOutcomeMetrics?.escalationsTier1 ?? 0} · Tier 2: {visibleOutcomeMetrics?.escalationsTier2 ?? 0} · Tier 3: {visibleOutcomeMetrics?.escalationsTier3 ?? 0}
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Care Timing</div>
                                    <div className="mt-2 text-sm text-zinc-300">
                                      Median and p75 timing across the current care steps.
                                    </div>
                                  </div>
                                  {visibleOutcomeMetrics?.medianMinutesToCare !== null && visibleOutcomeMetrics?.medianMinutesToCare !== undefined ? (
                                    <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[11px] text-cyan-100">
                                      Median to care {visibleOutcomeMetrics.medianMinutesToCare.toFixed(1)} min
                                    </div>
                                  ) : null}
                                </div>

                                {hasCareTimingData ? (
                                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {careEscalationTimingSteps.map(([label, summary]) => (
                                      <div key={label} className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm">
                                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</div>
                                        <div className="mt-2 text-white">Median: {formatDurationMetricValue((summary as any)?.medianMinutes)}</div>
                                        <div className="mt-1 text-zinc-400">P75: {formatDurationMetricValue((summary as any)?.p75Minutes)}</div>
                                        <div className="mt-1 text-zinc-500">{(summary as any)?.sampleCount ?? 0} cases in sample</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-400">
                                    No care timing sample yet. Timing will appear once a case moves through the current care steps.
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5" data-testid="pilot-readout-workspace">
                    <div className="max-w-3xl">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">V1 Lock</div>
                      <div className="mt-3 text-sm text-zinc-300">
                        Overview, engine health, athlete drill-down, and manual hypothesis tracking are in scope here. Adoption automation and review queue stay deferred to V2.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Staff Feedback</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">Coach and clinician survey entry</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          Capture trust, NPS, and optional diagnostic trust battery feedback without leaving the pilot detail page.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openStaffSurveyModal('coach')}
                          className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
                        >
                          Submit Coach Feedback
                        </button>
                        <button
                          onClick={() => openStaffSurveyModal('clinician')}
                          className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 transition hover:bg-emerald-400/15"
                        >
                          Submit Clinician Feedback
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-3xl">
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Athlete Onboarding</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">Athlete Join Links</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          Choose where athletes should land, then create either a one-person link or a reusable group link
                          for this pilot.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,320px),1fr]">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <label className="space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Join Scope</span>
                          <select
                            value={inviteCohortId}
                            onChange={(event) => setInviteCohortId(event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          >
                            <option value="">Whole pilot (no cohort)</option>
                            {inviteScopeCohorts.map((cohort) => (
                              <option key={cohort.id} value={cohort.id}>
                                {cohort.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="mt-4 rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Athletes will land in</div>
                          <div className="mt-2 text-sm font-medium text-white">
                            {selectedInviteCohort ? `${detail.pilot.name} -> ${selectedInviteCohort.name}` : `${detail.pilot.name} (no cohort)`}
                          </div>
                          <div className="mt-2 text-sm text-zinc-400">
                            {selectedInviteCohort
                              ? `New joins will enter ${detail.pilot.name} and start in ${selectedInviteCohort.name}.`
                              : `New joins will enter ${detail.pilot.name} without a cohort assignment.`}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                            {scopedInviteSummary}
                          </span>
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                            {scopedSingleUseInvites.length} one-person
                          </span>
                          <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sky-100">
                            {scopedGeneralInvites.length} reusable
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">One athlete</div>
                              <h3 className="mt-2 text-base font-semibold text-white">Single-use link</h3>
                            </div>
                            <Clipboard className="h-4 w-4 text-cyan-200" />
                          </div>
                          <p className="mt-3 text-sm leading-6 text-zinc-300">
                            Best when you are sending a link to one specific athlete and want it redeemed once.
                          </p>
                          <button
                            onClick={() => void handleCreatePilotInviteLink('single-use')}
                            disabled={Boolean(creatingInviteMode)}
                            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Clipboard className="h-4 w-4" />
                            {creatingInviteMode === 'single-use' ? 'Generating Single Link...' : 'Create Single-Use Link'}
                          </button>
                        </div>

                        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-sky-200">Group or roster</div>
                              <h3 className="mt-2 text-base font-semibold text-white">Reusable link</h3>
                            </div>
                            <Users2 className="h-4 w-4 text-sky-200" />
                          </div>
                          <p className="mt-3 text-sm leading-6 text-zinc-300">
                            Best when the same QR code or shared URL needs to work for a whole group in this pilot scope.
                          </p>
                          <button
                            onClick={() => void handleCreatePilotInviteLink('general')}
                            disabled={Boolean(creatingInviteMode)}
                            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Users2 className="h-4 w-4" />
                            {creatingInviteMode === 'general' ? 'Generating General Link...' : 'Create Reusable Link'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {scopedInvite && scopedInviteDiagnostic.status !== 'valid' ? (
                      <div
                        data-testid="pilot-invite-diagnostics"
                        className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Link Check</span>
                          <span className="rounded-full border border-amber-400/25 bg-amber-400/15 px-3 py-1 text-[11px] text-amber-100">
                            Needs attention
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-zinc-200">{scopedInviteDiagnostic.summary}</p>
                        {scopedInviteDiagnostic.fallbackUrl ? (
                          <div className="mt-2 text-xs text-zinc-400">
                            Current target: <span className="break-all text-zinc-200">{scopedInviteDiagnostic.fallbackUrl}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Active Links</div>
                          <h3 className="mt-2 text-base font-semibold text-white">
                            {selectedInviteCohort ? `Links for ${selectedInviteCohort.name}` : 'Links for whole pilot'}
                          </h3>
                          <p className="mt-1 text-sm text-zinc-400">
                            Copy, open, or delete the athlete join links currently tied to this scope.
                          </p>
                        </div>
                      </div>

                      {scopedInvites.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {scopedInvites.map((invite) => (
                            <div key={invite.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-3 py-1 text-[11px] ${inviteRedemptionModeClassName(invite.redemptionMode)}`}>
                                      {invite.redemptionMode === 'general' ? 'Reusable link' : 'Single-use link'}
                                    </span>
                                    {invite.redemptionMode === 'general' && Number(invite.redemptionCount || 0) > 0 ? (
                                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
                                        {formatInviteUsageCount(invite.redemptionCount)}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="mt-2 text-xs text-zinc-500">
                                    Created {formatTimeValue(invite.createdAt)}
                                    {invite.redeemedAt
                                      ? ` • ${invite.redemptionMode === 'general' ? 'Last used' : 'Redeemed'} ${formatTimeValue(invite.redeemedAt)}`
                                      : ''}
                                  </div>

                                  <div className="mt-3 rounded-2xl border border-white/5 bg-[#0b0f17] px-4 py-3 break-all text-xs text-cyan-100">
                                    {resolveInviteShareUrl(invite)}
                                  </div>

                                  <div className="mt-2 text-xs text-zinc-400">
                                    {invite.redemptionMode === 'general'
                                      ? 'Reusable link for a group in this scope.'
                                      : 'One athlete can redeem this link once.'}
                                  </div>

                                  {invite.redeemedByEmail ? (
                                    <div className="mt-1 text-xs text-zinc-400">
                                      {invite.redemptionMode === 'general' ? 'Last used by' : 'Redeemed by'} {invite.redeemedByEmail}
                                    </div>
                                  ) : null}

                                  {!isPulseCheckInviteOneLink(resolveInviteShareUrl(invite)) ? (
                                    <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2 text-xs text-amber-100">
                                      This link is currently using the fallback web invite path.
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    data-testid={`pilot-invite-copy-${invite.id}`}
                                    onClick={() => void copyInviteLink(invite.id, resolveInviteShareUrl(invite), 'Pilot athlete share link copied to clipboard.')}
                                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition-all duration-200 ${
                                      copiedInviteId === invite.id
                                        ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.08)]'
                                        : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                                    }`}
                                  >
                                    {copiedInviteId === invite.id ? <CheckCircle2 className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                                    {copiedInviteId === invite.id ? 'Copied' : 'Copy Link'}
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`pilot-invite-qr-${invite.id}`}
                                    onClick={() => setQrInvite(invite)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100 transition hover:bg-sky-400/15"
                                  >
                                    <QrCode className="h-4 w-4" />
                                    QR Code
                                  </button>
                                  <a
                                    href={resolveInviteShareUrl(invite)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    Open
                                  </a>
                                  <button
                                    onClick={() => void handleDeletePilotInviteLink(invite)}
                                    disabled={deletingInviteId === invite.id}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {deletingInviteId === invite.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[#0b0f17] px-4 py-6 text-sm text-zinc-400">
                          No athlete join links exist for this scope yet.
                        </div>
                      )}
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/5 bg-black/20 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Web Invite Activity</div>
                          <h3 className="mt-2 text-base font-semibold text-white">Recovery Queue</h3>
                          <p className="mt-1 text-sm text-zinc-400">
                            Use this when someone reaches the web invite flow and needs follow-up. It is not the full join ledger.
                          </p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-300">
                          Web only
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-[#0b0f17] p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Scans Captured</div>
                          <div className="mt-3 text-2xl font-semibold text-white">{inviteActivitySummary.scannedCount}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-[#0b0f17] p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Identified People</div>
                          <div className="mt-3 text-2xl font-semibold text-white">{inviteActivitySummary.identifiedCount}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-[#0b0f17] p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Needs Follow-Up</div>
                          <div className="mt-3 text-2xl font-semibold text-amber-100">{inviteActivitySummary.needsFollowUpCount}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-[#0b0f17] p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Joined Successfully</div>
                          <div className="mt-3 text-2xl font-semibold text-emerald-100">{inviteActivitySummary.joinedCount}</div>
                        </div>
                      </div>

                      <div className="mt-4 text-xs leading-6 text-zinc-500">
                        Native-app deep links that resolve fully inside PulseCheck may not create a row here, so treat this
                        as a recovery queue for web invite issues rather than a full scan history.
                      </div>

                      {inviteActivityParticipants.length > 0 ? (
                        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                            <thead className="bg-white/5 text-xs uppercase tracking-[0.16em] text-zinc-500">
                              <tr>
                                <th className="px-4 py-3 font-medium">Person</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Latest Event</th>
                                <th className="px-4 py-3 font-medium">Last Seen</th>
                                <th className="px-4 py-3 font-medium">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 bg-[#0b0f17]">
                              {inviteActivityParticipants.slice(0, 50).map((participant) => {
                                const status = inviteActivityStatusPresentation(participant);
                                const anonymousLabel = participant.sessionId
                                  ? `Anonymous scan ${participant.sessionId.slice(0, 8)}`
                                  : 'Anonymous scan';

                                return (
                                  <tr key={participant.key}>
                                    <td className="px-4 py-4 align-top">
                                      <div className="font-medium text-white">{participant.email || anonymousLabel}</div>
                                      <div className="mt-1 text-xs text-zinc-500">
                                        {participant.email
                                          ? participant.emailSource === 'manual-follow-up'
                                            ? 'Captured from follow-up request'
                                            : 'Captured from authenticated browser session'
                                          : 'No contact email captured yet'}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${status.className}`}>
                                        {status.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 align-top text-zinc-300">
                                      {formatInviteActivityEventLabel(participant.lastEventType)}
                                    </td>
                                    <td className="px-4 py-4 align-top text-zinc-300">
                                      {participant.lastSeenAt ? participant.lastSeenAt.toLocaleString() : 'Not available'}
                                    </td>
                                    <td className="px-4 py-4 align-top text-zinc-400">
                                      {participant.lastError || (participant.needsFollowUp
                                        ? 'Send an individual invite link to this email.'
                                        : participant.hasRedeemSucceeded
                                          ? 'Invite completed successfully.'
                                          : 'Scan captured.' )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[#0b0f17] px-4 py-6 text-sm text-zinc-400">
                          No web invite activity has been recorded for this pilot yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {inviteConfigDraft ? (
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">Pilot Invite Instructions</h2>
                          <p className="mt-1 text-sm text-zinc-400">
                            Configure the branded next-steps page athletes see after accepting this pilot invite.
                          </p>
                          <div className="mt-3 rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Live Config Source</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-3 py-1 text-xs ${inviteConfigSource.className}`}>
                                Inherited from: {inviteConfigSource.label}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-zinc-400">{inviteConfigSource.description}</p>
                          </div>
                          {inviteConfigPreviewDiff ? (
                            <div className="mt-3 rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Preview Diff</div>
                                  <p className="mt-1 text-sm text-zinc-400">
                                    Compared with the {inviteConfigPreviewDiff.baselineLabel}.
                                  </p>
                                </div>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                                  {inviteConfigPreviewDiff.changedFields.length === 0
                                    ? 'No field changes'
                                    : `${inviteConfigPreviewDiff.changedFields.length} field${inviteConfigPreviewDiff.changedFields.length === 1 ? '' : 's'} changed`}
                                </span>
                              </div>
                              {inviteConfigPreviewDiff.changedFields.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {inviteConfigPreviewDiff.changedFields.slice(0, 5).map((field) => (
                                    <span
                                      key={field.field}
                                      className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-100"
                                    >
                                      {field.label}
                                    </span>
                                  ))}
                                  {inviteConfigPreviewDiff.changedFields.length > 5 ? (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                                      +{inviteConfigPreviewDiff.changedFields.length - 5} more
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm text-zinc-400">
                                  The override currently matches the inherited baseline, so the reset action would not change the live text yet.
                                </p>
                              )}
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className={`rounded-full border px-3 py-1 ${detail.hasPilotInviteConfigOverride ? 'border-amber-400/30 bg-amber-400/10 text-amber-100' : 'border-white/10 bg-white/5 text-zinc-400'}`}>
                              {detail.hasPilotInviteConfigOverride ? 'Pilot override active' : 'Pilot is inheriting defaults'}
                            </span>
                            <span className={`rounded-full border px-3 py-1 ${detail.organizationInviteConfigDefault ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-white/5 text-zinc-400'}`}>
                              {detail.organizationInviteConfigDefault ? 'Organization default exists' : 'No organization default yet'}
                            </span>
                            <span className={`rounded-full border px-3 py-1 ${detail.teamInviteConfigDefault ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-white/5 text-zinc-400'}`}>
                              {detail.teamInviteConfigDefault ? 'Team default exists' : 'No team default yet'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void saveInviteDefault('organization')}
                            disabled={savingInviteDefaultScope !== null}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-60"
                          >
                            <Save className="h-4 w-4" />
                            {savingInviteDefaultScope === 'organization' ? 'Saving Org Default...' : 'Save As Org Default'}
                          </button>
                          <button
                            onClick={() => void saveInviteDefault('team')}
                            disabled={savingInviteDefaultScope !== null}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-60"
                          >
                            <Save className="h-4 w-4" />
                            {savingInviteDefaultScope === 'team' ? 'Saving Team Default...' : 'Save As Team Default'}
                          </button>
                          <button
                            onClick={() => void saveInviteConfig()}
                            disabled={savingInviteConfig}
                            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-60"
                          >
                            <Save className="h-4 w-4" />
                            {savingInviteConfig ? 'Saving...' : 'Save Pilot Override'}
                          </button>
                          {detail.hasPilotInviteConfigOverride ? (
                            <button
                              onClick={() => void resetInviteConfigOverride()}
                              disabled={resettingInviteConfig}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
                            >
                              <RefreshCcw className={`h-4 w-4 ${resettingInviteConfig ? 'animate-spin' : ''}`} />
                              {resettingInviteConfig ? 'Resetting...' : 'Reset To Inherited Defaults'}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Welcome Headline</span>
                          <input
                            value={inviteConfigDraft.welcomeHeadline}
                            onChange={(event) => updateInviteConfigField('welcomeHeadline', event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Support Name</span>
                          <input
                            value={inviteConfigDraft.supportName}
                            onChange={(event) => updateInviteConfigField('supportName', event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                      </div>

                      <label className="mt-4 block space-y-2 text-sm text-zinc-300">
                        <span className="text-xs uppercase tracking-wide text-zinc-500">Welcome Body</span>
                        <textarea
                          value={inviteConfigDraft.welcomeBody}
                          onChange={(event) => updateInviteConfigField('welcomeBody', event.target.value)}
                          rows={4}
                          className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                        />
                      </label>

                      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Support Email</span>
                          <input
                            value={inviteConfigDraft.supportEmail}
                            onChange={(event) => updateInviteConfigField('supportEmail', event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Support Phone</span>
                          <input
                            value={inviteConfigDraft.supportPhone}
                            onChange={(event) => updateInviteConfigField('supportPhone', event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">New Athlete Instructions</span>
                          <textarea
                            value={inviteConfigDraft.newAthleteInstructions}
                            onChange={(event) => updateInviteConfigField('newAthleteInstructions', event.target.value)}
                            rows={6}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Existing Athlete Instructions</span>
                          <textarea
                            value={inviteConfigDraft.existingAthleteInstructions}
                            onChange={(event) => updateInviteConfigField('existingAthleteInstructions', event.target.value)}
                            rows={6}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Wearable Requirements</span>
                          <textarea
                            value={inviteConfigDraft.wearableRequirements}
                            onChange={(event) => updateInviteConfigField('wearableRequirements', event.target.value)}
                            rows={4}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Baseline Expectations</span>
                          <textarea
                            value={inviteConfigDraft.baselineExpectations}
                            onChange={(event) => updateInviteConfigField('baselineExpectations', event.target.value)}
                            rows={4}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">iOS App Link</span>
                          <input
                            value={inviteConfigDraft.iosAppUrl}
                            onChange={(event) => updateInviteConfigField('iosAppUrl', event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Android App Link</span>
                          <input
                            value={inviteConfigDraft.androidAppUrl}
                            onChange={(event) => updateInviteConfigField('androidAppUrl', event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          />
                        </label>
                      </div>

                      <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0f17] p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Required Disclosures</div>
                            <div className="mt-2 max-w-2xl text-sm text-zinc-400">
                              Use a disclosure package that matches the pilot&apos;s current study mode before an athlete can use the app. Changing the study mode changes the default disclosure package used in onboarding.
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                                Study mode: {detail.pilot.studyMode}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                                {STUDY_MODE_DISCLOSURE_PACKAGE_META[detail.pilot.studyMode].label}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={applyCurrentStudyModeDisclosureDefaults}
                              className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
                            >
                              {STUDY_MODE_DISCLOSURE_PACKAGE_META[detail.pilot.studyMode].actionLabel}
                            </button>
                            <button
                              onClick={addRequiredConsentDraft}
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                            >
                              Add Disclosure
                            </button>
                            <button
                              onClick={() => void saveRequiredConsents()}
                              disabled={savingRequiredConsents}
                              className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 transition hover:bg-emerald-400/15 disabled:opacity-60"
                            >
                              {savingRequiredConsents ? 'Saving...' : 'Save Disclosures'}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-4">
                          {requiredConsentDrafts.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-zinc-500">
                              No disclosures are configured for this study mode yet.
                            </div>
                          ) : null}

                          {requiredConsentDrafts.map((consent, index) => (
                            <div key={`${consent.id}-${index}`} className="rounded-2xl border border-white/10 bg-[#11151f] p-4">
                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.4fr_auto]">
                                <label className="space-y-2 text-sm text-zinc-300">
                                  <span className="text-xs uppercase tracking-wide text-zinc-500">Disclosure Title</span>
                                  <input
                                    value={consent.title}
                                    onChange={(event) => updateRequiredConsentField(index, 'title', event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                                  />
                                </label>
                                <label className="space-y-2 text-sm text-zinc-300">
                                  <span className="text-xs uppercase tracking-wide text-zinc-500">Version</span>
                                  <input
                                    value={consent.version}
                                    onChange={(event) => updateRequiredConsentField(index, 'version', event.target.value)}
                                    className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                                  />
                                </label>
                                <div className="flex items-end">
                                  <button
                                    onClick={() => removeRequiredConsentDraft(index)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-400/15"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Remove
                                  </button>
                                </div>
                              </div>

                              <label className="mt-4 block space-y-2 text-sm text-zinc-300">
                                <span className="text-xs uppercase tracking-wide text-zinc-500">Disclosure Body</span>
                                <textarea
                                  value={consent.body}
                                  onChange={(event) => updateRequiredConsentField(index, 'body', event.target.value)}
                                  rows={6}
                                  className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                                />
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="enrollment-boundary" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Enrollment Boundary</div>
                      <div className="mt-3 text-2xl font-semibold text-white">
                        {visibleMetrics.activeAthleteCount} / {detail.metrics.totalEnrollmentCount}
                      </div>
                      <div className="mt-2 text-sm text-zinc-400">
                        Active pilot athletes in view versus total enrollments recorded for this pilot.
                      </div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="engine-coverage" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Engine Coverage</div>
                      <div className="mt-3 text-2xl font-semibold text-white">{formatPercent(visibleCoverage.engineCoverageRate)}</div>
                      <div className="mt-2 text-sm text-zinc-400">
                        Active pilot athletes with a correlation-engine record.
                      </div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="stable-pattern-rate" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Stable Pattern Rate</div>
                      <div className="mt-3 text-2xl font-semibold text-white">{formatPercent(visibleCoverage.stablePatternRate)}</div>
                      <div className="mt-2 text-sm text-zinc-400">
                        Share of active pilot athletes with at least one stable pattern.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Cohort Rollup</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          Pilot-native cohort comparison using only active athletes in this pilot{selectedCohort ? ` and filtered to ${selectedCohort.name}.` : '.'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-xs uppercase tracking-wide text-zinc-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Cohort</th>
                            <th className="px-3 py-2 text-left">Active Athletes</th>
                            <th className="px-3 py-2 text-left">Engine Coverage</th>
                            <th className="px-3 py-2 text-left">Stable Patterns</th>
                            <th className="px-3 py-2 text-left">Projections</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleCohortSummaries.length === 0 ? (
                            <tr className="border-t border-white/5">
                              <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                                No cohort study metrics match the current filter.
                              </td>
                            </tr>
                          ) : (
                            visibleCohortSummaries.map((summary) => (
                              <tr key={summary.cohortId} className="border-t border-white/5">
                                <td className="px-3 py-3 font-medium text-white">{summary.cohortName}</td>
                                <td className="px-3 py-3 text-zinc-300">{summary.activeAthleteCount}</td>
                                <td className="px-3 py-3 text-zinc-300">
                                  {formatPercent(
                                    summary.activeAthleteCount > 0
                                      ? (summary.athletesWithEngineRecord / summary.activeAthleteCount) * 100
                                      : 0
                                  )}
                                </td>
                                <td className="px-3 py-3 text-zinc-300">{summary.athletesWithStablePatterns}</td>
                                <td className="px-3 py-3 text-zinc-300">{summary.totalRecommendationProjections}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Pilot Athletes</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          All athlete team members appear here with active enrollments first, then consent-pending athletes, then not-enrolled athletes{selectedCohort ? `, filtered to ${selectedCohort.name}.` : '.'}
                        </p>
                      </div>
                    </div>
                    {detail.cohorts.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
                        This pilot does not have any cohort records yet, so every athlete is currently unassigned. Create cohorts in{' '}
                        <Link href="/admin/pulsecheckProvisioning" className="font-semibold underline hover:text-white">
                          PulseCheck provisioning
                        </Link>{' '}
                        first, then you can assign athletes here.
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <label className="relative block w-full max-w-xl">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          value={athleteSearchQuery}
                          onChange={(event) => setAthleteSearchQuery(event.target.value)}
                          placeholder="Search athletes by name, email, cohort, or status..."
                          className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 hover:border-white/15 focus:border-cyan-400/35"
                        />
                      </label>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{visibleRosterAthletes.length} athlete{visibleRosterAthletes.length === 1 ? '' : 's'} shown</span>
                        {athleteSearchQuery.trim() ? (
                          <button
                            type="button"
                            onClick={() => setAthleteSearchQuery('')}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
                          >
                            Clear search
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-xs uppercase tracking-wide text-zinc-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Athlete</th>
                            <th className="px-3 py-2 text-left">Cohort</th>
                            <th className="px-3 py-2 text-left">Evidence</th>
                            <th className="px-3 py-2 text-left">Patterns</th>
                            <th className="px-3 py-2 text-left">Projections</th>
                            <th className="px-3 py-2 text-left">Push notification</th>
                            <th className="px-3 py-2 text-left">Email</th>
                            <th className="px-3 py-2 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRosterAthletes.length === 0 ? (
                            <tr className="border-t border-white/5">
                              <td colSpan={8} className="px-3 py-6 text-center text-sm text-zinc-500">
                                No athlete team members match the current cohort filter or search.
                              </td>
                            </tr>
                          ) : (
                            visibleRosterAthletes.map((athlete) => {
                              const enrollmentBadge = athleteEnrollmentBadgePresentation(athlete.pilotEnrollment?.status);
                              const canManageEnrollment = Boolean(athlete.isEnrolled && athlete.pilotEnrollment);
                              const canTransferAthlete = Boolean(athlete.teamMembership && athlete.teamMembership.teamId === detail.team.id);
                              const hasActivePilotEnrollment = athlete.pilotEnrollment?.status === 'active';
                              const canSendActivationOutreach = Boolean(athlete.pilotEnrollment);
                              const hasEmailDestination = Boolean(athlete.email.trim());
                              const hasPilotCohortsConfigured = detail.cohorts.length > 0;
                              const pushRecord = getAthleteCommunicationRecord(athlete.athleteId, 'push');
                              const emailRecord = getAthleteCommunicationRecord(athlete.athleteId, 'email');
                              const pushActionLabel =
                                pushRecord && pushRecord.status !== 'not-sent' ? 'Preview & resend' : 'Preview & send';
                              const emailActionLabel =
                                emailRecord && emailRecord.status !== 'not-sent' ? 'Preview & resend' : 'Preview & send';

                              return (
                              <tr key={athlete.athleteId} className="border-t border-white/5">
                                <td className="px-3 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-medium text-white">{athlete.displayName}</div>
                                    <span className={`rounded-full border px-2 py-1 text-[11px] ${enrollmentBadge.className}`}>
                                      {enrollmentBadge.label}
                                    </span>
                                  </div>
                                  <div className="text-xs text-zinc-500">{athlete.email || athlete.athleteId}</div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                    {athlete.operationalWatchList ? (
                                      <>
                                        <span
                                          className={`rounded-full border px-2 py-1 ${
                                            athlete.operationalWatchList.watchListActive
                                              ? 'border-rose-400/25 bg-rose-400/10 text-rose-100'
                                              : athlete.operationalWatchList.watchListRequested
                                                ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
                                                : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                                          }`}
                                        >
                                          {athlete.operationalWatchList.watchListActive
                                            ? 'Watch list active'
                                            : athlete.operationalWatchList.watchListRequested
                                              ? 'Review queued'
                                              : 'Watch list state'}
                                        </span>
                                        {athlete.operationalWatchList.restrictionFlags.suppressSurveys ? (
                                          <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-rose-100">
                                            Surveys suppressed
                                          </span>
                                        ) : null}
                                        {athlete.operationalWatchList.restrictionFlags.suppressAssignments ? (
                                          <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-rose-100">
                                            Assignments suppressed
                                          </span>
                                        ) : null}
                                        {athlete.operationalWatchList.restrictionFlags.suppressNudges ? (
                                          <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-rose-100">
                                            Nudges suppressed
                                          </span>
                                        ) : null}
                                        {athlete.operationalWatchList.restrictionFlags.excludeFromAdherence ? (
                                          <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-rose-100">
                                            Adherence excluded
                                          </span>
                                        ) : null}
                                        {athlete.operationalWatchList.restrictionFlags.manualHold ? (
                                          <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-rose-100">
                                            Manual hold
                                          </span>
                                        ) : null}
                                      </>
                                    ) : (
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-zinc-400">
                                        No watch list
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-zinc-300">
                                  <div className="space-y-3">
                                    <div>
                                      {athlete.isEnrolled
                                        ? hasPilotCohortsConfigured
                                          ? athlete.cohort?.name || 'No cohort assigned'
                                          : 'No pilot cohorts configured'
                                        : 'Not enrolled'}
                                    </div>
                                    <select
                                      value={athleteCohortDrafts[athlete.athleteId] ?? athlete.pilotEnrollment?.cohortId ?? ''}
                                      onChange={(event) =>
                                        setAthleteCohortDrafts((current) => ({
                                          ...current,
                                          [athlete.athleteId]: event.target.value,
                                        }))
                                      }
                                      disabled={!canManageEnrollment || !hasPilotCohortsConfigured}
                                      className="w-full min-w-[180px] rounded-2xl border border-white/10 bg-[#0b0f17] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:text-zinc-500 disabled:opacity-60"
                                    >
                                      <option value="">
                                        {hasPilotCohortsConfigured ? 'No cohort' : 'No pilot cohorts created yet'}
                                      </option>
                                      {detail.cohorts.map((cohort) => (
                                        <option key={cohort.id} value={cohort.id}>
                                          {cohort.name}
                                        </option>
                                      ))}
                                    </select>
                                    {canManageEnrollment && !hasPilotCohortsConfigured ? (
                                      <div className="text-xs text-zinc-500">Create pilot cohorts first to assign this athlete.</div>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-zinc-300">{canManageEnrollment ? athlete.engineSummary.evidenceRecordCount : '—'}</td>
                                <td className="px-3 py-3 text-zinc-300">{canManageEnrollment ? athlete.engineSummary.patternModelCount : '—'}</td>
                                <td className="px-3 py-3 text-zinc-300">{canManageEnrollment ? athlete.engineSummary.recommendationProjectionCount : '—'}</td>
                                <td className="px-3 py-3 align-top">
                                  <div className="flex min-w-[220px] flex-col items-start gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void openAthleteCommunicationPreview(athlete, 'push')}
                                      disabled={!canSendActivationOutreach || !athlete.canReceivePulseCheckPush}
                                      className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-zinc-500"
                                    >
                                      {pushActionLabel}
                                    </button>
                                    <div className="flex flex-wrap gap-1">
                                      {COMMUNICATION_STATUS_STAGES.map((stage) => (
                                        <span
                                          key={`push-${athlete.athleteId}-${stage}`}
                                          className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${communicationStageClassName(
                                            communicationStageIsComplete(pushRecord, stage)
                                          )}`}
                                        >
                                          {communicationStageLabel(stage)}
                                        </span>
                                      ))}
                                    </div>
                                    <span className="text-xs text-zinc-500">
                                      {!canSendActivationOutreach
                                        ? 'Not enrolled in this pilot'
                                        : athlete.canReceivePulseCheckPush
                                          ? summarizeCommunicationStatus(pushRecord)
                                          : 'No PulseCheck push token on file'}
                                    </span>
                                    {pushRecord?.status === 'failed' ? (
                                      <span className="text-xs text-rose-200">{pushRecord.lastError || 'Last send failed'}</span>
                                    ) : (
                                      <span className="text-[11px] text-zinc-500">
                                        Delivery and open update when receipts are available.
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 align-top">
                                  <div className="flex min-w-[220px] flex-col items-start gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void openAthleteCommunicationPreview(athlete, 'email')}
                                      disabled={!canSendActivationOutreach || !hasEmailDestination}
                                      className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-zinc-500"
                                    >
                                      {emailActionLabel}
                                    </button>
                                    <div className="flex flex-wrap gap-1">
                                      {COMMUNICATION_STATUS_STAGES.map((stage) => (
                                        <span
                                          key={`email-${athlete.athleteId}-${stage}`}
                                          className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${communicationStageClassName(
                                            communicationStageIsComplete(emailRecord, stage)
                                          )}`}
                                        >
                                          {communicationStageLabel(stage)}
                                        </span>
                                      ))}
                                    </div>
                                    <span className="text-xs text-zinc-500">
                                      {!canSendActivationOutreach
                                        ? 'Not enrolled in this pilot'
                                        : hasEmailDestination
                                          ? summarizeCommunicationStatus(emailRecord)
                                          : 'No email address on file'}
                                    </span>
                                    {emailRecord?.status === 'failed' ? (
                                      <span className="text-xs text-rose-200">{emailRecord.lastError || 'Last send failed'}</span>
                                    ) : (
                                      <span className="text-[11px] text-zinc-500">Includes an Open Pulse Check App button.</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex flex-col items-start gap-2">
                                    {canManageEnrollment ? (
                                      <>
                                        {hasActivePilotEnrollment ? (
                                          <Link
                                            href={`/admin/pulsecheckPilotDashboard/${encodeURIComponent(detail.pilot.id)}/athletes/${encodeURIComponent(
                                              athlete.athleteId
                                            )}`}
                                            className="text-cyan-200 hover:text-cyan-100"
                                          >
                                            Open athlete
                                          </Link>
                                        ) : (
                                          <span className="text-zinc-500">Enrollment awaiting consent</span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => void handleSeedAthleteData(athlete)}
                                          disabled={seedingAthleteDataId === athlete.athleteId || !hasActivePilotEnrollment}
                                          className="text-amber-200 transition hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-500"
                                        >
                                          {seedingAthleteDataId === athlete.athleteId ? 'Seeding data...' : 'Seed data'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleSaveAthleteCohort(athlete)}
                                          disabled={
                                            !hasPilotCohortsConfigured ||
                                            savingAthleteCohortId === athlete.athleteId ||
                                            (athleteCohortDrafts[athlete.athleteId] ?? athlete.pilotEnrollment?.cohortId ?? '') ===
                                              (athlete.pilotEnrollment?.cohortId || '')
                                          }
                                          className="text-emerald-200 transition hover:text-emerald-100 disabled:cursor-not-allowed disabled:text-zinc-500"
                                        >
                                          {savingAthleteCohortId === athlete.athleteId ? 'Saving cohort...' : 'Save cohort'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleUnenrollAthlete(athlete)}
                                          disabled={unenrollingAthleteId === athlete.athleteId}
                                          className="text-rose-200 transition hover:text-rose-100 disabled:cursor-not-allowed disabled:text-zinc-500"
                                        >
                                          {unenrollingAthleteId === athlete.athleteId ? 'Unenrolling...' : 'Unenroll from pilot'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void openAthleteTransferModal(athlete)}
                                          disabled={athleteTransferModal?.saving || !canTransferAthlete}
                                          className="text-cyan-200 transition hover:text-cyan-100 disabled:cursor-not-allowed disabled:text-zinc-500"
                                        >
                                          Transfer team
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-zinc-500">Not enrolled in this pilot</span>
                                        <button
                                          type="button"
                                          onClick={() => void openAthleteTransferModal(athlete)}
                                          disabled={athleteTransferModal?.saving || !canTransferAthlete}
                                          className="text-cyan-200 transition hover:text-cyan-100 disabled:cursor-not-allowed disabled:text-zinc-500"
                                        >
                                          Transfer team
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'engine-health' ? (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3 pr-2 text-emerald-300">
                        <Database className="h-5 w-5" />
                          <span className="text-sm font-medium leading-tight">Athletes With Engine Record</span>
                        </div>
                        <NoraMetricHelpButton metricKey="athletes-with-engine-record" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.athletesWithEngineRecord}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3 pr-2 text-cyan-300">
                        <Activity className="h-5 w-5" />
                          <span className="text-sm font-medium leading-tight">Evidence Records</span>
                        </div>
                        <NoraMetricHelpButton metricKey="evidence-records" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.totalEvidenceRecords}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3 pr-2 text-amber-300">
                        <Brain className="h-5 w-5" />
                          <span className="text-sm font-medium leading-tight">Pattern Models</span>
                        </div>
                        <NoraMetricHelpButton metricKey="pattern-models" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.totalPatternModels}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3 pr-2 text-violet-300">
                        <Users2 className="h-5 w-5" />
                          <span className="text-sm font-medium leading-tight">Engine Coverage</span>
                        </div>
                        <NoraMetricHelpButton metricKey="engine-coverage" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{formatPercent(visibleCoverage.engineCoverageRate)}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3 pr-2 text-cyan-300">
                        <FlaskConical className="h-5 w-5" />
                          <span className="text-sm font-medium leading-tight">Avg Evidence / Athlete</span>
                        </div>
                        <NoraMetricHelpButton metricKey="avg-evidence-per-athlete" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{formatAverage(visibleCoverage.avgEvidenceRecordsPerActiveAthlete)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-4">
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-2 text-xs uppercase tracking-[0.18em] leading-tight text-zinc-500">Pattern Density</div>
                        <NoraMetricHelpButton metricKey="pattern-density" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-sm text-zinc-300">
                        Average pattern models per active pilot athlete: <span className="font-medium text-white">{formatAverage(visibleCoverage.avgPatternModelsPerActiveAthlete)}</span>
                      </div>
                      <div className="mt-2 text-sm text-zinc-300">
                        Average recommendation projections per active pilot athlete: <span className="font-medium text-white">{formatAverage(visibleCoverage.avgRecommendationProjectionsPerActiveAthlete)}</span>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-2 text-xs uppercase tracking-[0.18em] leading-tight text-zinc-500">Pilot Health Read</div>
                        <NoraMetricHelpButton metricKey="pilot-health-read" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-sm text-zinc-300">
                        Stable pattern rate currently sits at <span className="font-medium text-white">{formatPercent(visibleCoverage.stablePatternRate)}</span>. This remains a trustworthy V1 signal because it is derived from persisted pattern-model confidence tiers inside the active pilot population.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Recommendation Slices</div>
                        <h3 className="mt-2 text-lg font-semibold text-white">Recommendation Type Breakdown</h3>
                        <p className="mt-1 text-sm text-zinc-400">
                          This slices persisted recommendation projections by consumer so we can see whether the engine is actually serving multiple audiences.
                        </p>
                      </div>
                      <NoraMetricHelpButton metricKey="recommendation-type-slices" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                      {RECOMMENDATION_CONSUMER_ORDER.map((consumer) => {
                        const count = visibleRecommendationProjectionConsumerCounts[consumer] || 0;
                        return (
                          <div key={consumer} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{formatConsumerLabel(consumer)}</div>
                            <div className="mt-2 text-2xl font-semibold text-white">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 text-xs text-zinc-500">
                      Counts are summed from persisted recommendation projections on the active athletes currently in view, so cohort filtering is honored automatically.
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5 text-sm text-zinc-300">
                    The pilot scope and denominator rules are locked here. Additional stale-data, contradiction-rate, and source-quality metrics remain V1 contract items, but still need dedicated telemetry joins before they should be treated as trustworthy dashboard numbers.
                  </div>
                </div>
              ) : null}

              {activeTab === 'findings' ? (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Current V1 Read</div>
                      <div className="mt-3 text-sm text-zinc-300">
                        This pilot currently has {visibleMetrics.athletesWithStablePatterns} athletes with at least one stable pattern and {visibleMetrics.totalRecommendationProjections} persisted recommendation projections across the active pilot athletes in view.
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Evidence Maturity Proxy</div>
                      <div className="mt-3 text-sm text-zinc-300">
                        V1 uses evidence-record and stable-pattern coverage as the current proxy for whether this pilot is learning enough to justify personalization.
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Study Metrics Lens</div>
                      <div className="mt-3 text-sm text-zinc-300">
                        Study-metrics validation is now flowing through pilot summaries for adherence, trust, NPS, mental-performance change, and speed to care. The next interpretation risk is not missing data contracts, but over-reading small slices without checking the sample behind them.
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Cohort Findings Snapshot</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          Early pilot comparison of where the engine is producing usable structure across cohorts.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-xs uppercase tracking-wide text-zinc-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Cohort</th>
                            <th className="px-3 py-2 text-left">Stable Pattern Rate</th>
                            <th className="px-3 py-2 text-left">Evidence Records</th>
                            <th className="px-3 py-2 text-left">Pattern Models</th>
                            <th className="px-3 py-2 text-left">Recommendation Projections</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleCohortSummaries.length === 0 ? (
                            <tr className="border-t border-white/5">
                              <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                                No cohort findings are available for the current filter.
                              </td>
                            </tr>
                          ) : (
                            visibleCohortSummaries.map((summary) => (
                              <tr key={summary.cohortId} className="border-t border-white/5">
                                <td className="px-3 py-3 font-medium text-white">{summary.cohortName}</td>
                                <td className="px-3 py-3 text-zinc-300">
                                  {formatPercent(
                                    summary.activeAthleteCount > 0
                                      ? (summary.athletesWithStablePatterns / summary.activeAthleteCount) * 100
                                      : 0
                                  )}
                                </td>
                                <td className="px-3 py-3 text-zinc-300">{summary.totalEvidenceRecords}</td>
                                <td className="px-3 py-3 text-zinc-300">{summary.totalPatternModels}</td>
                                <td className="px-3 py-3 text-zinc-300">{summary.totalRecommendationProjections}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'hypotheses' ? (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-2 text-xs uppercase tracking-[0.18em] leading-tight text-zinc-500">Not Enough Data</div>
                        <NoraMetricHelpButton metricKey="not-enough-data" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.notEnoughDataCount}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-2 text-xs uppercase tracking-[0.18em] leading-tight text-zinc-500">Promising</div>
                        <NoraMetricHelpButton metricKey="promising" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.promisingCount}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-2 text-xs uppercase tracking-[0.18em] leading-tight text-zinc-500">Mixed</div>
                        <NoraMetricHelpButton metricKey="mixed" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.mixedCount}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-2 text-xs uppercase tracking-[0.18em] leading-tight text-zinc-500">Not Supported</div>
                        <NoraMetricHelpButton metricKey="not-supported" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.notSupportedCount}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-2 text-xs uppercase tracking-[0.18em] leading-tight text-zinc-500">High Confidence</div>
                        <NoraMetricHelpButton metricKey="high-confidence" className="shrink-0" />
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.highConfidenceCount}</div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5" data-testid="pilot-hypothesis-outcome-comparisons">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Study-Metrics Comparison Slices</div>
                        <h2 className="mt-2 text-lg font-semibold text-white">H3, H5, and H6 study-metrics comparisons</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          These governed slices read the current pilot study metrics summary instead of rescanning raw collections at render time.
                          They are designed to keep recommendation exposure, adherence, mental-performance delta, and trust in the same frame.
                        </p>
                      </div>
                      <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                        {selectedCohort ? `${selectedCohort.name} cohort` : 'Whole-pilot frame'}
                      </div>
                    </div>

                    {visibleHypothesisEvaluation ? (
                      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
                        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">H3</div>
                              <h3 className="mt-2 text-base font-semibold text-white">Recommendation specificity</h3>
                            </div>
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-100">
                              Metrics-backed
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">{visibleHypothesisEvaluation.h3.comparisonLabel}</p>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">State-aware exposure</div>
                              <div className="mt-2 text-sm text-zinc-300">{formatAthleteCountLabel(visibleHypothesisEvaluation.h3.stateAware.athleteCount)}</div>
                              <div className="mt-3 text-sm text-zinc-300">Adherence: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h3.stateAware.adherenceRate, 'percent')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Mental delta: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h3.stateAware.mentalPerformanceDelta, 'score')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Athlete trust: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h3.stateAware.athleteTrust, 'score')}</span></div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Fallback or none</div>
                              <div className="mt-2 text-sm text-zinc-300">{formatAthleteCountLabel(visibleHypothesisEvaluation.h3.fallbackOrNone.athleteCount)}</div>
                              <div className="mt-3 text-sm text-zinc-300">Adherence: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h3.fallbackOrNone.adherenceRate, 'percent')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Mental delta: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h3.fallbackOrNone.mentalPerformanceDelta, 'score')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Athlete trust: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h3.fallbackOrNone.athleteTrust, 'score')}</span></div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100">Adherence Delta</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{formatSignedDelta(visibleHypothesisEvaluation.h3.delta.adherenceRate, ' pts')}</div>
                            </div>
                            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100">Mental Delta</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{formatSignedDelta(visibleHypothesisEvaluation.h3.delta.mentalPerformanceDelta)}</div>
                            </div>
                            <div className="rounded-2xl border border-violet-400/15 bg-violet-400/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-violet-100">Trust Delta</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{formatSignedDelta(visibleHypothesisEvaluation.h3.delta.athleteTrust)}</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">H5</div>
                              <h3 className="mt-2 text-base font-semibold text-white">Coach actionability proxy</h3>
                            </div>
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-100">
                              Coach-aware
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">{visibleHypothesisEvaluation.h5.comparisonLabel}</p>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Body-state-aware exposure</div>
                              <div className="mt-2 text-sm text-zinc-300">{formatAthleteCountLabel(visibleHypothesisEvaluation.h5.bodyStateAwareExposure.athleteCount)}</div>
                              <div className="mt-3 text-sm text-zinc-300">Adherence: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h5.bodyStateAwareExposure.adherenceRate, 'percent')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Athlete trust: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h5.bodyStateAwareExposure.athleteTrust, 'score')}</span></div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Profile-only or none</div>
                              <div className="mt-2 text-sm text-zinc-300">{formatAthleteCountLabel(visibleHypothesisEvaluation.h5.profileOnlyOrNone.athleteCount)}</div>
                              <div className="mt-3 text-sm text-zinc-300">Adherence: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h5.profileOnlyOrNone.adherenceRate, 'percent')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Athlete trust: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h5.profileOnlyOrNone.athleteTrust, 'score')}</span></div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100">Adherence Delta</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{formatSignedDelta(visibleHypothesisEvaluation.h5.delta.adherenceRate, ' pts')}</div>
                            </div>
                            <div className="rounded-2xl border border-violet-400/15 bg-violet-400/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-violet-100">Trust Delta</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{formatSignedDelta(visibleHypothesisEvaluation.h5.delta.athleteTrust)}</div>
                            </div>
                          </div>
                          <div className="mt-4 rounded-2xl border border-white/5 bg-[#0b0f17] p-4 text-sm text-zinc-300">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Coach Signal</div>
                            <div className="mt-2">Coach trust: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h5.coachTrust, 'score')}</span></div>
                            <div className="mt-1">Coach NPS: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h5.coachNps, 'score')}</span></div>
                            <div className="mt-1 text-xs text-zinc-500">{visibleHypothesisEvaluation.h5.coachResponseCount} coach trust responses in frame</div>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">H6</div>
                              <h3 className="mt-2 text-base font-semibold text-white">Protocol follow-through</h3>
                            </div>
                            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[11px] text-violet-100">
                              Completion slice
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">{visibleHypothesisEvaluation.h6.comparisonLabel}</p>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Completed protocol</div>
                              <div className="mt-2 text-sm text-zinc-300">{formatAthleteCountLabel(visibleHypothesisEvaluation.h6.completedProtocol.athleteCount)}</div>
                              <div className="mt-3 text-sm text-zinc-300">Adherence: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h6.completedProtocol.adherenceRate, 'percent')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Mental delta: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h6.completedProtocol.mentalPerformanceDelta, 'score')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Athlete trust: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h6.completedProtocol.athleteTrust, 'score')}</span></div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Incomplete or skipped</div>
                              <div className="mt-2 text-sm text-zinc-300">{formatAthleteCountLabel(visibleHypothesisEvaluation.h6.incompleteOrSkippedProtocol.athleteCount)}</div>
                              <div className="mt-3 text-sm text-zinc-300">Adherence: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h6.incompleteOrSkippedProtocol.adherenceRate, 'percent')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Mental delta: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h6.incompleteOrSkippedProtocol.mentalPerformanceDelta, 'score')}</span></div>
                              <div className="mt-1 text-sm text-zinc-300">Athlete trust: <span className="font-medium text-white">{formatComparisonMetricValue(visibleHypothesisEvaluation.h6.incompleteOrSkippedProtocol.athleteTrust, 'score')}</span></div>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100">Adherence Delta</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{formatSignedDelta(visibleHypothesisEvaluation.h6.delta.adherenceRate, ' pts')}</div>
                            </div>
                            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100">Mental Delta</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{formatSignedDelta(visibleHypothesisEvaluation.h6.delta.mentalPerformanceDelta)}</div>
                            </div>
                            <div className="rounded-2xl border border-violet-400/15 bg-violet-400/5 p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-violet-100">Trust Delta</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{formatSignedDelta(visibleHypothesisEvaluation.h6.delta.athleteTrust)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-400">
                        Study-metrics-backed hypothesis comparisons will appear once the current pilot study metrics summary has enough governed data for this frame.
                      </div>
                    )}
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                          <Sparkles className="h-3.5 w-3.5" />
                          Hypothesis Assist
                        </div>
                        <h2 className="mt-3 text-lg font-semibold">Ask Nora what this pilot should test next</h2>
                        <p className="mt-2 text-sm text-zinc-400">
                          Nora can suggest pilot-scoped hypotheses from the governed dashboard frame, including the current cohort filter.
                          These are candidate research questions, not conclusions. You still choose which ones become official pilot hypotheses.
                        </p>
                        <div className="mt-3 text-xs text-zinc-500">
                          Current frame: {selectedCohort ? `${selectedCohort.name}` : 'Whole pilot'} • {visibleMetrics.activeAthleteCount} active athletes • {formatPercent(visibleCoverage.engineCoverageRate)} coverage
                        </div>
                        {hypothesisAssistMeta ? (
                          <div className="mt-2 text-xs text-zinc-500">
                            Last assist run used {hypothesisAssistMeta.modelVersion} with prompt {hypothesisAssistMeta.promptVersion}.
                          </div>
                        ) : null}
                      </div>
                      <button
                        onClick={() => void handleGenerateHypothesisAssist()}
                        disabled={generatingHypothesisAssist}
                        data-testid="pilot-hypothesis-assist-generate"
                        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Sparkles className="h-4 w-4" />
                        {generatingHypothesisAssist ? 'Generating suggestions...' : 'Generate Suggested Hypotheses'}
                      </button>
                    </div>

                    {hypothesisAssistSuggestions.length > 0 ? (
                      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {hypothesisAssistSuggestions.map((suggestion) => {
                          const alreadyExists = existingHypothesisStatementSet.has(
                            normalizeInvitePreviewValue(suggestion.statement).toLowerCase()
                          );
                          const nextCodeLabel = alreadyExists ? 'Existing hypothesis' : nextHypothesisCode;

                          return (
                            <div
                              key={suggestion.suggestionKey}
                              data-testid={`pilot-hypothesis-assist-suggestion-${suggestion.suggestionKey}`}
                              className="rounded-3xl border border-cyan-400/15 bg-cyan-400/5 p-5"
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{suggestion.title}</div>
                                  <h3 className="mt-2 text-lg font-semibold text-white">{suggestion.statement}</h3>
                                </div>
                                <div className="inline-flex items-center gap-2">
                                  <span className={`rounded-full border px-2 py-1 text-[11px] ${confidenceClassName(suggestion.confidenceLevel)}`}>
                                    {confidenceLabel(suggestion.confidenceLevel)}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300">
                                    {nextCodeLabel}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                                <div>
                                  <div className="text-xs uppercase tracking-wide text-zinc-500">Why Nora Suggested It</div>
                                  <p className="mt-1 leading-6">{suggestion.whySuggested}</p>
                                </div>
                                <div>
                                  <div className="text-xs uppercase tracking-wide text-zinc-500">Leading Indicator</div>
                                  <p className="mt-1 leading-6">{suggestion.leadingIndicator}</p>
                                </div>
                                <div>
                                  <div className="text-xs uppercase tracking-wide text-zinc-500">Evidence Signals</div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {suggestion.evidenceSignals.map((signal) => (
                                      <span key={`${suggestion.suggestionKey}-${signal}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300">
                                        {signal}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-50">
                                  <div className="text-xs uppercase tracking-wide text-amber-100">Caveat</div>
                                  <p className="mt-1 leading-6">{suggestion.caveat}</p>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  onClick={() => void handleCreateSuggestedHypothesis(suggestion)}
                                  disabled={alreadyExists || creatingSuggestedHypothesisKey === suggestion.suggestionKey}
                                  data-testid={`pilot-hypothesis-assist-create-${suggestion.suggestionKey}`}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Save className="h-4 w-4" />
                                  {alreadyExists
                                    ? 'Already in hypotheses'
                                    : creatingSuggestedHypothesisKey === suggestion.suggestionKey
                                      ? 'Creating...'
                                      : `Create ${nextHypothesisCode}`}
                                </button>
                                <button
                                  onClick={() =>
                                    setHypothesisAssistSuggestions((current) =>
                                      current.filter((item) => item.suggestionKey !== suggestion.suggestionKey)
                                    )
                                  }
                                  className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-400">
                        No assist suggestions are loaded yet. Generate suggestions to see candidate hypotheses Nora thinks are worth testing from this pilot frame.
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div>
                      <h2 className="text-lg font-semibold">Manual Hypothesis Tracking</h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        Hypothesis persistence is in scope for V1. This is the manual governance layer for the selected pilot.
                      </p>
                    </div>
                    <button
                      onClick={() => void seedDefaults()}
                      disabled={seedingDefaults || detail.hypotheses.length > 0}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {seedingDefaults ? 'Seeding...' : detail.hypotheses.length > 0 ? 'Defaults Seeded' : 'Seed Default Hypotheses'}
                    </button>
                  </div>

                  {detail.hypotheses.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-8 text-sm text-zinc-400">
                      No hypotheses have been created for this pilot yet. Seed the default set to start manual hypothesis tracking.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {detail.hypotheses.map((hypothesis) => {
                        const editable = editingHypotheses[hypothesis.id] || hypothesis;
                        return (
                          <div key={hypothesis.id} className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{editable.code}</div>
                                <h3 className="mt-2 text-lg font-semibold">{editable.statement}</h3>
                              </div>
                              <button
                                onClick={() => void saveHypothesis(editable)}
                                disabled={savingHypothesisId === editable.id}
                                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
                              >
                                <Save className="h-4 w-4" />
                                {savingHypothesisId === editable.id ? 'Saving...' : 'Save'}
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                              <label className="space-y-2 text-sm text-zinc-300">
                                <span className="text-xs uppercase tracking-wide text-zinc-500">Leading Indicator</span>
                                <textarea
                                  value={editable.leadingIndicator}
                                  onChange={(event) => updateHypothesisField(editable.id, 'leadingIndicator', event.target.value)}
                                  rows={3}
                                  className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                                />
                              </label>
                              <label className="space-y-2 text-sm text-zinc-300">
                                <span className="text-xs uppercase tracking-wide text-zinc-500">Key Evidence</span>
                                <textarea
                                  value={editable.keyEvidence || ''}
                                  onChange={(event) => updateHypothesisField(editable.id, 'keyEvidence', event.target.value)}
                                  rows={3}
                                  className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                                />
                              </label>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                              <label className="space-y-2 text-sm text-zinc-300">
                                <span className="text-xs uppercase tracking-wide text-zinc-500">Status</span>
                                <select
                                  value={editable.status}
                                  onChange={(event) => updateHypothesisField(editable.id, 'status', event.target.value)}
                                  className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                                >
                                  {STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="space-y-2 text-sm text-zinc-300">
                                <span className="text-xs uppercase tracking-wide text-zinc-500">Confidence</span>
                                <select
                                  value={editable.confidenceLevel}
                                  onChange={(event) => updateHypothesisField(editable.id, 'confidenceLevel', event.target.value)}
                                  className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                                >
                                  {CONFIDENCE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="space-y-2 text-sm text-zinc-300">
                                <span className="text-xs uppercase tracking-wide text-zinc-500">Last Reviewed</span>
                                <div className="rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white">
                                  {editable.lastReviewedAt && typeof editable.lastReviewedAt.toDate === 'function'
                                    ? editable.lastReviewedAt.toDate().toLocaleString()
                                    : 'Not reviewed yet'}
                                </div>
                              </div>
                            </div>

                            <label className="mt-4 block space-y-2 text-sm text-zinc-300">
                              <span className="text-xs uppercase tracking-wide text-zinc-500">Notes / Interpretation</span>
                              <textarea
                                value={editable.notes || ''}
                                onChange={(event) => updateHypothesisField(editable.id, 'notes', event.target.value)}
                                rows={4}
                                className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              {activeTab === 'research-readout' ? (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="saved-readout" className="absolute right-4 top-4" />
                      <div className="flex items-center gap-3 text-cyan-300">
                        <FileText className="h-5 w-5" />
                        <span className="text-sm font-medium">Saved Readout</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{detail.researchReadouts.length}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="readiness-frame" className="absolute right-4 top-4" />
                      <div className="flex items-center gap-3 text-emerald-300">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="text-sm font-medium">Readiness Frame</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">
                        {selectedCohort ? selectedCohort.name : 'Whole Pilot'}
                      </div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="eligible-athletes" className="absolute right-4 top-4" />
                      <div className="flex items-center gap-3 text-amber-300">
                        <Users2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Eligible Athletes</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.activeAthleteCount}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="hypotheses-in-scope" className="absolute right-4 top-4" />
                      <div className="flex items-center gap-3 text-violet-300">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Hypotheses In Scope</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypotheses.length}</div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Research Brief</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          Generate a pilot-scoped research brief that reads more like a strong research partner than an admin report.
                          Every brief stays grounded in the governed pilot frame, keeps its caveats visible, and still requires human review before it becomes an approved readout.
                        </p>
                      </div>
                      <button
                        onClick={() => void handleGenerateResearchReadout()}
                        disabled={generatingResearchReadout}
                        data-testid="pilot-readout-generate-button"
                        className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {generatingResearchReadout ? 'Generating...' : 'Generate AI Readout'}
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Evidence Frame</span>
                      <p className="mt-2">
                        This brief will lock to pilot <span className="font-medium text-white">{detail.pilot.name}</span>
                        {selectedCohort ? `, cohort ${selectedCohort.name},` : ','} and the currently selected pilot-scoped denominator frame.
                        It will not interpret athletes outside this pilot.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <label className="space-y-2 text-sm text-zinc-300">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Window Start</span>
                      <input
                        type="date"
                        value={readoutDateWindowStart}
                        onChange={(event) => setReadoutDateWindowStart(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-zinc-300">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Window End</span>
                      <input
                        type="date"
                        value={readoutDateWindowEnd}
                        onChange={(event) => setReadoutDateWindowEnd(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-zinc-300">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Baseline Mode</span>
                      <select
                        value={readoutBaselineMode}
                        onChange={(event) => setReadoutBaselineMode(event.target.value as PilotResearchReadoutBaselineMode)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                      >
                        <option value="no-baseline">No baseline</option>
                        <option value="within-athlete">Within-athlete</option>
                        <option value="cross-cohort">Cross-cohort</option>
                        <option value="pre-pilot-baseline">Pre-pilot baseline</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">When This Brief Is Ready</div>
                      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                        <li>Pilot must be active or completed.</li>
                        <li>Readiness checks must pass for sample size, freshness, telemetry completeness, and denominator availability.</li>
                        <li>Sections that fail evidence thresholds will be suppressed instead of softened into generic prose.</li>
                      </ul>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">How This Brief Stays Honest</div>
                      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                        <li>Every claim must be tagged as Observed, Inferred, or Speculative.</li>
                        <li>Every section must cite its evidence frame, linked hypotheses, and active limitations.</li>
                        <li>The system may suggest hypothesis posture, but only a human reviewer sets the official hypothesis status.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px,1fr]">
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">Readout History</h2>
                          <p className="mt-1 text-sm text-zinc-400">
                            Saved drafts and reviewed readouts for this pilot frame.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Review State Filter</span>
                          <select
                            value={historyReviewStateFilter}
                            onChange={(event) => setHistoryReviewStateFilter(event.target.value as 'all' | PilotResearchReadoutReviewState)}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          >
                            <option value="all">All states</option>
                            {READOUT_REVIEW_STATE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2 text-sm text-zinc-300">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Scope Filter</span>
                          <select
                            value={historyCohortScopeFilter}
                            onChange={(event) => setHistoryCohortScopeFilter(event.target.value as 'all' | 'whole-pilot' | 'cohort-only')}
                            className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          >
                            <option value="all">All scopes</option>
                            <option value="whole-pilot">Whole pilot only</option>
                            <option value="cohort-only">Cohort-scoped only</option>
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="space-y-2 text-sm text-zinc-300">
                            <span className="text-xs uppercase tracking-wide text-zinc-500">Window Start</span>
                            <input
                              type="date"
                              value={historyWindowStartFilter}
                              onChange={(event) => setHistoryWindowStartFilter(event.target.value)}
                              className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                            />
                          </label>
                          <label className="space-y-2 text-sm text-zinc-300">
                            <span className="text-xs uppercase tracking-wide text-zinc-500">Window End</span>
                            <input
                              type="date"
                              value={historyWindowEndFilter}
                              onChange={(event) => setHistoryWindowEndFilter(event.target.value)}
                              className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                            />
                          </label>
                        </div>
                      </div>

                      {filteredResearchReadouts.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-400">
                          No saved readouts match the current history filters.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {filteredResearchReadouts.map((readout) => (
                            <button
                              key={readout.id}
                              onClick={() => setSelectedReadoutId(readout.id)}
                              data-testid={`pilot-readout-history-${readout.id}`}
                              className={`w-full rounded-2xl border p-4 text-left transition ${
                                selectedResearchReadout?.id === readout.id
                                  ? 'border-cyan-400/30 bg-cyan-400/10'
                                  : 'border-white/5 bg-black/20 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium text-white">{formatTimeValue(readout.generatedAt)}</div>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300">
                                  {readout.reviewState}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-zinc-500">
                                {readout.dateWindowStart} to {readout.dateWindowEnd}
                              </div>
                              <div className="mt-2 text-xs text-zinc-500">
                                {readout.cohortId ? `Cohort scoped` : 'Whole pilot'} • {readout.modelVersion || 'unknown model'}
                              </div>
                              <div className="mt-2 text-xs text-zinc-500">
                                Reviewed: {readout.reviewedAt ? formatTimeValue(readout.reviewedAt) : 'Not reviewed yet'}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                Reviewer: {readout.reviewedByEmail || 'Not assigned'}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Research Review Workspace</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          Review state, evidence frame, and limitations stay frozen with the selected saved brief.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {editingReadout ? (
                          <>
                            <select
                              value={compareReadoutId}
                              onChange={(event) => setCompareReadoutId(event.target.value)}
                              data-testid="pilot-readout-compare-select"
                              className="rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                            >
                              <option value="">Compare with an earlier brief</option>
                              {compareReadoutCandidates.map((readout) => (
                                <option key={readout.id} value={readout.id}>
                                  {formatTimeValue(readout.generatedAt)} • {readout.reviewState}
                                </option>
                              ))}
                            </select>
                            <select
                              value={editingReadout.reviewState}
                              onChange={(event) =>
                                setEditingReadout((current) => (current ? { ...current, reviewState: event.target.value as PilotResearchReadoutReviewState } : current))
                              }
                              data-testid="pilot-readout-review-state"
                              className="rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                            >
                              {READOUT_REVIEW_STATE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => void saveResearchReadoutReview()}
                              disabled={savingResearchReadoutReview}
                              data-testid="pilot-readout-save-review"
                              className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 transition hover:bg-emerald-400/15 disabled:opacity-60"
                            >
                              {savingResearchReadoutReview ? 'Saving Review...' : 'Save Review'}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {!editingReadout ? (
                      <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-400">
                        Select a saved readout from history or generate a new one.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Generated</div>
                            <div className="mt-2 text-white">{formatTimeValue(editingReadout.generatedAt)}</div>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Reviewed At</div>
                            <div className="mt-2 text-white">{editingReadout.reviewedAt ? formatTimeValue(editingReadout.reviewedAt) : 'Not reviewed yet'}</div>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Reviewer</div>
                            <div className="mt-2 text-white">{editingReadout.reviewedByEmail || 'Not assigned'}</div>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Model</div>
                            <div className="mt-2 text-white">{editingReadout.modelVersion || 'Not recorded'}</div>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Window</div>
                            <div className="mt-2 text-white">
                              {editingReadout.dateWindowStart} to {editingReadout.dateWindowEnd}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Baseline Mode</div>
                            <div className="mt-2 text-white">{editingReadout.baselineMode}</div>
                          </div>
                        </div>

                        {researchReadoutDiff ? (
                          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Compare Readout Diff</div>
                            <div className="mt-2 text-sm text-zinc-400">
                              Comparing the selected readout against {formatTimeValue(compareReadout?.generatedAt)}.
                            </div>
                            <div className="mt-4 space-y-3">
                              <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Metadata Changes</div>
                                {researchReadoutDiff.metadataChanges.length > 0 ? (
                                  <div className="mt-2 space-y-2">
                                    {researchReadoutDiff.metadataChanges.map((change) => (
                                      <div key={change} className="rounded-2xl border border-white/5 bg-[#0b0f17] px-3 py-2 text-sm text-zinc-300">
                                        {change}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-sm text-zinc-500">No metadata differences detected.</div>
                                )}
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Section Changes</div>
                                {researchReadoutDiff.sectionChanges.length > 0 ? (
                                  <div className="mt-2 space-y-2">
                                    {researchReadoutDiff.sectionChanges.map((change) => (
                                      <div key={change} className="rounded-2xl border border-white/5 bg-[#0b0f17] px-3 py-2 text-sm text-zinc-300">
                                        {change}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-sm text-zinc-500">No section-level differences detected.</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Readiness Gates</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {editingReadout.readiness.map((gate) => (
                              <span
                                key={gate.gateKey}
                                className={`rounded-full border px-3 py-1 text-xs ${
                                  gate.status === 'passed'
                                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                                    : gate.status === 'failed'
                                      ? 'border-rose-400/30 bg-rose-400/10 text-rose-100'
                                      : 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                                }`}
                              >
                                {gate.gateKey}: {gate.status}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          {orderedEditingReadoutSections.map((section) => {
                            const sectionPresentation = RESEARCH_SECTION_PRESENTATION[section.sectionKey];
                            const citationHypothesisCodes = Array.from(
                              new Set(
                                section.citations.flatMap((citation) => citation.hypothesisCodes).filter(Boolean)
                              )
                            );
                            const linkedHypothesisCodes =
                              citationHypothesisCodes.length > 0
                                ? citationHypothesisCodes
                                : section.sectionKey === 'hypothesis-mapper'
                                  ? detail.hypotheses.map((hypothesis) => hypothesis.code)
                                  : [];
                            const linkedHypotheses = linkedHypothesisCodes
                              .map((code) => hypothesesByCode.get(code))
                              .filter(Boolean) as PulseCheckPilotHypothesis[];
                            const activeLimitationKeys = Array.from(
                              new Set(section.citations.flatMap((citation) => citation.limitationKeys).filter(Boolean))
                            );

                            return (
                              <div
                                key={section.sectionKey}
                                data-testid={`pilot-readout-section-${section.sectionKey}`}
                                className="rounded-2xl border border-white/5 bg-black/20 p-4"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                                      {sectionPresentation?.eyebrow || 'Research Brief'}
                                    </div>
                                    <h3 className="mt-2 text-base font-semibold text-white">
                                      {sectionPresentation?.title || section.title}
                                    </h3>
                                    <p className="mt-2 text-sm text-zinc-400">
                                      {sectionPresentation?.helper || 'Review this section against the evidence frame before accepting it.'}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full border px-3 py-1 text-xs ${
                                        section.readinessStatus === 'suppressed'
                                          ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                                          : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                                      }`}
                                    >
                                      {formatReadinessStatusLabel(section.readinessStatus)}
                                    </span>
                                    {section.suggestedReviewerResolution ? (
                                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                                        Suggested: {section.suggestedReviewerResolution}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="mt-4 rounded-2xl border border-white/5 bg-[#0b0f17] p-4 text-sm leading-6 text-zinc-200">
                                  {section.summary}
                                </div>

                                {section.sectionKey === 'research-notes' ? (
                                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
                                    Candidate findings only. Keep these in “worth discussing” posture until study-metrics validation, replication, and stronger controls are in place.
                                  </div>
                                ) : null}

                                {linkedHypotheses.length > 0 ? (
                                  <div className="mt-4">
                                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Linked Hypotheses</div>
                                    <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                                      {linkedHypotheses.map((hypothesis) => (
                                        <div
                                          key={`${section.sectionKey}-${hypothesis.id}`}
                                          data-testid={`pilot-readout-hypothesis-${hypothesis.code}`}
                                          className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4"
                                        >
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-cyan-100">
                                              {hypothesis.code}
                                            </span>
                                            <span className={`rounded-full border px-2 py-1 text-[11px] ${hypothesisStatusClassName(hypothesis.status)}`}>
                                              {hypothesisStatusLabel(hypothesis.status)}
                                            </span>
                                            <span className={`rounded-full border px-2 py-1 text-[11px] ${confidenceClassName(hypothesis.confidenceLevel)}`}>
                                              {confidenceLabel(hypothesis.confidenceLevel)}
                                            </span>
                                          </div>
                                          <p className="mt-3 text-sm font-medium text-white">{hypothesis.statement}</p>
                                          <p className="mt-2 text-xs text-zinc-400">
                                            Leading indicator: {hypothesis.leadingIndicator || 'Not recorded'}
                                          </p>
                                          {hypothesis.keyEvidence ? (
                                            <p className="mt-2 text-xs text-zinc-400">Current evidence note: {hypothesis.keyEvidence}</p>
                                          ) : null}
                                          {hypothesis.notes ? (
                                            <p className="mt-2 text-xs text-zinc-500">Research note: {hypothesis.notes}</p>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {section.claims.length > 0 ? (
                                  <div className="mt-4 space-y-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Key Claims</div>
                                    {section.claims.map((claim) => (
                                      <div key={claim.claimKey} className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${claimTypeClassName(claim.claimType)}`}>
                                            {formatClaimTypeLabel(claim.claimType)}
                                          </span>
                                          <span className={`rounded-full border px-2 py-1 text-[11px] ${confidenceClassName(claim.confidenceLevel)}`}>
                                            {confidenceLabel(claim.confidenceLevel)}
                                          </span>
                                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300">
                                            {formatBaselineModeLabel(claim.baselineMode)}
                                          </span>
                                          {claim.caveatFlag ? (
                                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100">
                                              Caveat
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="mt-3 text-sm leading-6 text-zinc-100">{claim.statement}</p>
                                        <p className="mt-2 text-xs text-zinc-500">
                                          Denominator: {claim.denominatorLabel} ({claim.denominatorValue})
                                        </p>
                                        {claim.evidenceSources.length > 0 ? (
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            {claim.evidenceSources.map((source) => (
                                              <span
                                                key={`${claim.claimKey}-${source}`}
                                                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300"
                                              >
                                                {source}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {section.citations.length > 0 || activeLimitationKeys.length > 0 ? (
                                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr),220px]">
                                    <div>
                                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Evidence Trace</div>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {section.citations.map((citation) => (
                                          <span
                                            key={`${section.sectionKey}-${citation.blockKey}`}
                                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
                                          >
                                            {citation.blockLabel}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Active Limitations</div>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {activeLimitationKeys.length > 0 ? (
                                          activeLimitationKeys.map((limitationKey) => (
                                            <span
                                              key={`${section.sectionKey}-${limitationKey}`}
                                              className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-100"
                                            >
                                              {limitationKey}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                                            No active limitation tags
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}

                                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[220px,1fr]">
                                  <label className="space-y-2 text-sm text-zinc-300">
                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Reviewer Resolution</span>
                                    <select
                                      value={section.reviewerResolution || section.suggestedReviewerResolution || ''}
                                      onChange={(event) =>
                                        updateReadoutSection(section.sectionKey, {
                                          reviewerResolution: event.target.value as PilotResearchReadoutSectionResolution,
                                        })
                                      }
                                      data-testid={`pilot-readout-resolution-${section.sectionKey}`}
                                      className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                                    >
                                      <option value="">Select resolution</option>
                                      {READOUT_SECTION_RESOLUTION_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="space-y-2 text-sm text-zinc-300">
                                    <span className="text-xs uppercase tracking-wide text-zinc-500">Reviewer Notes</span>
                                    <textarea
                                      value={section.reviewerNotes || ''}
                                      onChange={(event) =>
                                        updateReadoutSection(section.sectionKey, {
                                          reviewerNotes: event.target.value,
                                        })
                                      }
                                      rows={3}
                                      data-testid={`pilot-readout-notes-${section.sectionKey}`}
                                      className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <h2 className="text-lg font-semibold">How To Use This Brief</h2>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-xs uppercase tracking-wide text-zinc-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Step</th>
                            <th className="px-3 py-2 text-left">What To Read</th>
                            <th className="px-3 py-2 text-left">Why It Matters</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['1', 'Pilot Summary', 'Start with the plain-language read before you dive into claims or candidate findings.'],
                            ['2', 'Hypothesis Mapper', 'Check whether the brief is actually mapping back to the hypotheses you set for the pilot.'],
                            ['3', 'Candidate Publishable Findings', 'Treat these as disciplined leads for discussion, not finished conclusions.'],
                            ['4', 'Limitations and Reviewer Resolution', 'This is what keeps the brief honest and prevents overclaiming.'],
                          ].map((row) => (
                            <tr key={row[0]} className="border-t border-white/5">
                              <td className="px-3 py-3 font-medium text-white">{row[0]}</td>
                              <td className="px-3 py-3 text-zinc-300">{row[1]}</td>
                              <td className="px-3 py-3 text-zinc-300">{row[2]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>

      <style jsx global>{`
        .pilot-detail-theme {
          background: #07090f;
          color: rgba(255, 255, 255, 0.95);
        }

        .pilot-font-display {
          font-family: 'Syne', sans-serif;
        }

        .pilot-font-body {
          font-family: 'DM Sans', sans-serif;
        }

        .pilot-font-mono {
          font-family: 'DM Mono', monospace;
        }

        .pilot-ambient-layer {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        .pilot-ambient-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(120px);
          opacity: 0.9;
          animation: pilotDetailFloat 18s ease-in-out infinite;
        }

        .pilot-ambient-orb-teal {
          top: -18rem;
          right: -12rem;
          height: 56rem;
          width: 56rem;
          background: radial-gradient(circle, rgba(0, 212, 170, 0.11) 0%, rgba(0, 212, 170, 0.02) 46%, transparent 72%);
        }

        .pilot-ambient-orb-blue {
          bottom: -14rem;
          left: -9rem;
          height: 40rem;
          width: 40rem;
          background: radial-gradient(circle, rgba(96, 165, 250, 0.09) 0%, rgba(96, 165, 250, 0.02) 44%, transparent 72%);
          animation-delay: -6s;
        }

        .pilot-ambient-orb-amber {
          top: 36%;
          left: 24%;
          height: 30rem;
          width: 30rem;
          background: radial-gradient(circle, rgba(245, 166, 35, 0.07) 0%, rgba(245, 166, 35, 0.015) 42%, transparent 72%);
          animation-delay: -10s;
        }

        .pilot-logo-dot {
          height: 0.45rem;
          width: 0.45rem;
          border-radius: 9999px;
          background: #00d4aa;
          box-shadow: 0 0 12px rgba(0, 212, 170, 0.55);
          animation: pilotDetailPulse 2.8s ease-in-out infinite;
        }

        .pilot-detail-panel {
          background: rgba(255, 255, 255, 0.032);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 20px 80px rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(22px);
        }

        .pilot-detail-inset {
          background: rgba(255, 255, 255, 0.022);
          border-color: rgba(255, 255, 255, 0.06);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.015);
          backdrop-filter: blur(18px);
        }

        .pilot-detail-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.28)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-position: right 0.9rem center;
          background-repeat: no-repeat;
          padding-right: 2.5rem;
        }

        .pilot-detail-theme [class*='bg-[#11151f]'][class*='border-white/10'] {
          background: rgba(255, 255, 255, 0.032) !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 18px 64px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(20px);
        }

        .pilot-detail-theme [class*='bg-black/20'][class*='border-white/5'] {
          background: rgba(255, 255, 255, 0.02) !important;
          border-color: rgba(255, 255, 255, 0.06) !important;
        }

        .pilot-detail-theme [class*='bg-[#0b0f17]'][class*='border-white/10'] {
          background: rgba(255, 255, 255, 0.028) !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
        }

        .pilot-detail-theme table thead th {
          color: rgba(255, 255, 255, 0.28) !important;
          letter-spacing: 0.12em;
        }

        .pilot-detail-theme table tbody td {
          color: rgba(255, 255, 255, 0.7);
        }

        .pilot-detail-theme table tbody tr:hover td {
          background: rgba(255, 255, 255, 0.016);
        }

        .pilot-detail-theme input,
        .pilot-detail-theme textarea,
        .pilot-detail-theme select {
          font-family: 'DM Sans', sans-serif;
        }

        .pilot-detail-theme code {
          font-family: 'DM Mono', monospace;
          color: rgba(255, 255, 255, 0.8);
        }

        @keyframes pilotDetailPulse {
          0%,
          100% {
            box-shadow: 0 0 12px rgba(0, 212, 170, 0.55);
          }
          50% {
            box-shadow: 0 0 24px rgba(0, 212, 170, 0.9);
          }
        }

        @keyframes pilotDetailFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(0, 18px, 0) scale(1.04);
          }
        }
      `}</style>

        {detail && staffSurveyModalRole ? (
          <StaffPilotSurveyModal
            isOpen={Boolean(staffSurveyModalRole)}
            role={staffSurveyModalRole}
            pilotId={detail.pilot.id}
            pilotName={detail.pilot.name}
            organizationId={detail.organization.id}
            teamId={detail.team.id}
            cohortId={selectedCohort?.id || null}
            onClose={() => setStaffSurveyModalRole(null)}
            onSubmitted={handleStaffSurveySubmitted}
          />
        ) : null}
        {detail ? (
          <PilotInviteQrModal
            invite={qrInvite}
            pilotName={detail.pilot.name}
            teamName={detail.team.displayName}
            organizationName={detail.organization.displayName}
            onClose={() => setQrInvite(null)}
          />
        ) : null}
        {detail && athleteTransferModal ? (
          <PilotAthleteTransferModal
            isOpen={Boolean(athleteTransferModal)}
            athleteName={athleteTransferModal.athlete.displayName}
            athleteEmail={athleteTransferModal.athlete.email}
            currentTeamName={detail.team.displayName}
            currentPilotName={detail.pilot.name}
            teamOptions={transferTeamOptions.map((team) => ({
              id: team.id,
              displayName: team.displayName,
              sportOrProgram: team.sportOrProgram,
              status: team.status,
            }))}
            pilotOptions={transferPilotOptions.map((pilot) => ({
              id: pilot.id,
              teamId: pilot.teamId,
              name: pilot.name,
              studyMode: pilot.studyMode,
              status: pilot.status,
            }))}
            cohortOptions={transferCohortOptions.map((cohort) => ({
              id: cohort.id,
              pilotId: cohort.pilotId,
              name: cohort.name,
              status: cohort.status,
            }))}
            selectedTeamId={athleteTransferModal.selectedTeamId}
            selectedPilotId={athleteTransferModal.selectedPilotId}
            selectedCohortId={athleteTransferModal.selectedCohortId}
            loadingOptions={athleteTransferModal.loading}
            saving={athleteTransferModal.saving}
            error={athleteTransferModal.error}
            onClose={() => {
              if (athleteTransferModal.saving) return;
              setAthleteTransferModal(null);
            }}
            onTeamChange={handleTransferTeamChange}
            onPilotChange={handleTransferPilotChange}
            onCohortChange={handleTransferCohortChange}
            onConfirm={() => void confirmAthleteTransfer()}
          />
        ) : null}
        {communicationPreviewModal ? (
          <PilotAthleteCommunicationModal
            isOpen={Boolean(communicationPreviewModal)}
            athleteName={communicationPreviewModal.athlete.displayName}
            athleteEmail={communicationPreviewModal.athlete.email}
            channel={communicationPreviewModal.channel}
            preview={communicationPreviewModal.preview}
            record={getAthleteCommunicationRecord(communicationPreviewModal.athlete.athleteId, communicationPreviewModal.channel)}
            loadingPreview={communicationPreviewModal.loading}
            sending={communicationPreviewModal.sending}
            error={communicationPreviewModal.error}
            onClose={() => {
              if (communicationPreviewModal.sending) return;
              setCommunicationPreviewModal(null);
            }}
            onSend={() => void confirmCommunicationSend()}
          />
        ) : null}
        {detail ? (
          <StudyMetricsStatusModal
            isOpen={studyMetricsStatusModalOpen}
            pilotName={detail.pilot.name}
            state={metricsRefreshState}
            refreshScope={metricsRefreshScope}
            repairScope={metricsRepairScope}
            onClose={() => setStudyMetricsStatusModalOpen(false)}
            onRefresh={!demoModeEnabled ? () => void triggerOutcomeRecompute() : undefined}
            refreshing={recomputingOutcomeRollups}
          />
        ) : null}
        <AnimatePresence>
          {pageMessage ? (
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="pointer-events-none fixed inset-x-0 bottom-5 z-[120] flex justify-center px-4"
            >
              <div
                className={`pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-2xl border px-4 py-4 shadow-2xl backdrop-blur-md ${
                  pageMessage.type === 'success'
                    ? 'border-emerald-400/25 bg-emerald-500/12 text-emerald-100'
                    : 'border-rose-400/25 bg-rose-500/12 text-rose-100'
                }`}
                role="status"
                aria-live="polite"
              >
                <div className="min-w-0 flex-1 pr-2 text-sm font-medium leading-6">{pageMessage.text}</div>
                <button
                  type="button"
                  onClick={() => setPageMessage(null)}
                  className="rounded-full border border-white/10 bg-black/20 p-1 text-zinc-200 transition hover:bg-black/35 hover:text-white"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckPilotDashboardDetailPage;
