import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
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
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users2,
} from 'lucide-react';
import AdminRouteGuard from '../../../components/auth/AdminRouteGuard';
import NoraMetricHelpButton from '../../../components/admin/pilot-dashboard/NoraMetricHelpButton';
import type { PilotDashboardMetricExplanationKey } from '../../../components/admin/pilot-dashboard/noraMetricCatalog';
import { pulseCheckPilotDashboardService } from '../../../api/firebase/pulsecheckPilotDashboard/service';
import { pulseCheckProvisioningService } from '../../../api/firebase/pulsecheckProvisioning/service';
import type { PulseCheckInviteLink } from '../../../api/firebase/pulsecheckProvisioning/types';
import type { PulseCheckRequiredConsentDocument } from '../../../api/firebase/pulsecheckProvisioning/types';
import { analyzePulseCheckInviteOneLink, isPulseCheckInviteOneLink } from '../../../utils/pulsecheckInviteLinks';
import { useUser } from '../../../hooks/useUser';
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
  { id: 'overview', label: 'Pilot Overview' },
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

const PulseCheckPilotDashboardDetailPage: React.FC = () => {
  const currentUser = useUser();
  const router = useRouter();
  const pilotId = typeof router.query.pilotId === 'string' ? router.query.pilotId : '';
  const [detail, setDetail] = useState<PilotDashboardDetail | null>(null);
  const [inviteLinks, setInviteLinks] = useState<PulseCheckInviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [cohortFilter, setCohortFilter] = useState('');
  const [editingHypotheses, setEditingHypotheses] = useState<Record<string, PulseCheckPilotHypothesis>>({});
  const [inviteConfigDraft, setInviteConfigDraft] = useState<PulseCheckPilotInviteConfig | null>(null);
  const [requiredConsentDrafts, setRequiredConsentDrafts] = useState<PulseCheckRequiredConsentDocument[]>([]);
  const [savingHypothesisId, setSavingHypothesisId] = useState<string | null>(null);
  const [generatingHypothesisAssist, setGeneratingHypothesisAssist] = useState(false);
  const [creatingSuggestedHypothesisKey, setCreatingSuggestedHypothesisKey] = useState<string | null>(null);
  const [savingInviteConfig, setSavingInviteConfig] = useState(false);
  const [savingRequiredConsents, setSavingRequiredConsents] = useState(false);
  const [savingInviteDefaultScope, setSavingInviteDefaultScope] = useState<'team' | 'organization' | null>(null);
  const [resettingInviteConfig, setResettingInviteConfig] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [unenrollingAthleteId, setUnenrollingAthleteId] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
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
  const copyFeedbackTimeoutRef = useRef<number | null>(null);

  const load = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!pilotId) return;
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
      setDetail(nextDetail);
      if (nextDetail?.team.id) {
        const nextInviteLinks = pulseCheckPilotDashboardService.isDemoModeEnabled()
          ? pulseCheckPilotDashboardService.listDemoInviteLinks()
          : await pulseCheckProvisioningService.listTeamInviteLinks(nextDetail.team.id);
        setInviteLinks(nextInviteLinks);
      } else {
        setInviteLinks([]);
      }
      setCohortFilter((current) => {
        if (!current) return '';
        return nextDetail?.cohorts.some((cohort) => cohort.id === current) ? current : '';
      });
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
      setError(loadError?.message || 'Failed to load pilot dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [pilotId]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

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

  const activeCohorts = useMemo(
    () => (detail?.cohorts || []).filter((cohort) => cohort.status === 'active'),
    [detail]
  );

  const availableCohorts = activeCohorts.length > 0 ? activeCohorts : detail?.cohorts || [];

  const selectedCohort = useMemo(
    () => availableCohorts.find((cohort) => cohort.id === cohortFilter) || null,
    [availableCohorts, cohortFilter]
  );

  useEffect(() => {
    setHypothesisAssistSuggestions([]);
    setHypothesisAssistMeta(null);
  }, [pilotId, cohortFilter]);

  const visibleAthletes = useMemo(() => {
    if (!detail) return [];
    if (!cohortFilter) return detail.athletes;
    return detail.athletes.filter((athlete) => athlete.pilotEnrollment.cohortId === cohortFilter);
  }, [detail, cohortFilter]);

  const visibleMetrics = useMemo(() => {
    const activeCohortCount = activeCohorts.length > 0 ? activeCohorts.length : detail?.cohorts.length || 0;
    return {
      activeAthleteCount: visibleAthletes.length,
      cohortCount: cohortFilter ? (selectedCohort ? 1 : 0) : activeCohortCount,
      athletesWithEngineRecord: visibleAthletes.filter((athlete) => athlete.engineSummary.hasEngineRecord).length,
      athletesWithStablePatterns: visibleAthletes.filter((athlete) => athlete.engineSummary.stablePatternCount > 0).length,
      totalEvidenceRecords: visibleAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.evidenceRecordCount, 0),
      totalPatternModels: visibleAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.patternModelCount, 0),
      totalRecommendationProjections: visibleAthletes.reduce(
        (sum, athlete) => sum + athlete.engineSummary.recommendationProjectionCount,
        0
      ),
    };
  }, [activeCohorts.length, cohortFilter, detail?.cohorts.length, selectedCohort, visibleAthletes]);

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

  const scopedActiveInvites = useMemo(() => {
    if (!detail) return [] as PulseCheckInviteLink[];
    return inviteLinks.filter((invite) => {
      if (invite.status !== 'active') return false;
      if (invite.inviteType !== 'team-access') return false;
      if (invite.teamMembershipRole !== 'athlete') return false;
      if ((invite.pilotId || '') !== detail.pilot.id) return false;
      if (selectedCohort) {
        return (invite.cohortId || '') === selectedCohort.id;
      }
      return !(invite.cohortId || '');
    });
  }, [detail, inviteLinks, selectedCohort]);

  const scopedInvite = scopedActiveInvites?.[0] || null;
  const scopedInviteDiagnostic = useMemo(
    () => analyzePulseCheckInviteOneLink(scopedInvite?.activationUrl || ''),
    [scopedInvite?.activationUrl]
  );

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
    setError(null);
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
      setError(saveError?.message || 'Failed to save hypothesis.');
    } finally {
      setSavingHypothesisId(null);
    }
  };

  const seedDefaults = async () => {
    if (!pilotId) return;
    setSeedingDefaults(true);
    setError(null);
    try {
      await pulseCheckPilotDashboardService.seedDefaultHypotheses(pilotId);
      await load('refresh');
      setActiveTab('hypotheses');
    } catch (seedError: any) {
      setError(seedError?.message || 'Failed to seed default hypotheses.');
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

  const copyInviteLink = async (inviteId: string, activationUrl: string, successText: string) => {
    try {
      await navigator.clipboard.writeText(activationUrl);
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

  const handleCreatePilotInviteLink = async () => {
    if (!detail) return;
    setCreatingInvite(true);
    setPageMessage(null);
    try {
      if (demoModeEnabled) {
        const createdInvite = pulseCheckPilotDashboardService.createDemoInviteLink({
            pilotId: detail.pilot.id,
            pilotName: detail.pilot.name,
            cohortId: selectedCohort?.id || '',
            cohortName: selectedCohort?.name || '',
            createdByUserId: currentUser?.id || '',
            createdByEmail: currentUser?.email || '',
          });
        setInviteLinks(pulseCheckPilotDashboardService.listDemoInviteLinks());
        if (createdInvite?.activationUrl) {
          await navigator.clipboard.writeText(createdInvite.activationUrl);
        }
        setPageMessage({
          type: 'success',
          text: selectedCohort
            ? `Pilot share link for ${selectedCohort.name} was created and copied.`
            : 'Pilot athlete share link was created and copied.',
        });
        return;
      }

      const inviteId = await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: detail.organization.id,
        teamId: detail.team.id,
        teamMembershipRole: 'athlete',
        revokeExistingMatchingLinks: false,
        pilotId: detail.pilot.id,
        pilotName: detail.pilot.name,
        cohortId: selectedCohort?.id || '',
        cohortName: selectedCohort?.name || '',
        createdByUserId: currentUser?.id || '',
        createdByEmail: currentUser?.email || '',
      });

      const refreshedInviteLinks = await pulseCheckProvisioningService.listTeamInviteLinks(detail.team.id);
      setInviteLinks(refreshedInviteLinks);
      const createdInvite = refreshedInviteLinks.find((invite) => invite.id === inviteId);
      if (createdInvite?.activationUrl) {
        await navigator.clipboard.writeText(createdInvite.activationUrl);
      }

      setPageMessage({
        type: 'success',
        text: selectedCohort
          ? `Pilot share link for ${selectedCohort.name} was created and copied.`
          : 'Pilot athlete share link was created and copied.',
      });
    } catch (inviteError) {
      console.error('[PulseCheckPilotDashboard] Failed to create pilot invite link:', inviteError);
      setPageMessage({ type: 'error', text: 'Failed to create pilot athlete invite link.' });
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokePilotInviteLink = async (invite: PulseCheckInviteLink) => {
    const confirmed = window.confirm('Deactivate this invite link? Anyone who has not redeemed it will no longer be able to use it.');
    if (!confirmed) return;

    setRevokingInviteId(invite.id);
    setPageMessage(null);
    try {
      if (demoModeEnabled) {
        pulseCheckPilotDashboardService.revokeDemoInviteLink(invite.id);
        setInviteLinks(pulseCheckPilotDashboardService.listDemoInviteLinks());
      } else {
        await pulseCheckProvisioningService.revokeInviteLink(invite.id);
        const refreshedInviteLinks = await pulseCheckProvisioningService.listTeamInviteLinks(detail?.team.id || '');
        setInviteLinks(refreshedInviteLinks);
      }

      setPageMessage({
        type: 'success',
        text: 'Pilot invite link deactivated.',
      });
    } catch (revokeError) {
      console.error('[PulseCheckPilotDashboard] Failed to deactivate pilot invite link:', revokeError);
      setPageMessage({ type: 'error', text: 'Failed to deactivate pilot invite link.' });
    } finally {
      setRevokingInviteId(null);
    }
  };

  const handleUnenrollAthlete = async (athlete: PilotDashboardDetail['athletes'][number]) => {
    if (!detail) return;

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
        id: `consent-${current.length + 1}`,
        title: '',
        body: '',
        version: 'v1',
      },
    ]);
  };

  const removeRequiredConsentDraft = (index: number) => {
    setRequiredConsentDrafts((current) => current.filter((_, consentIndex) => consentIndex !== index));
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
        text: normalized.length === 0 ? 'Required agreements cleared for this pilot.' : 'Required agreements saved for this pilot.',
      });
    } catch (saveError) {
      console.error('[PulseCheckPilotDashboard] Failed to save required consents:', saveError);
      setPageMessage({ type: 'error', text: 'Failed to save required agreements.' });
    } finally {
      setSavingRequiredConsents(false);
    }
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

  return (
    <AdminRouteGuard>
      <Head>
        <title>{detail ? `${detail.pilot.name} | Pilot Dashboard` : 'Pilot Dashboard'}</title>
      </Head>
      <div className="min-h-screen bg-[#0b0f17] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Link href="/admin/pulsecheckPilotDashboard" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Back to active pilots
              </Link>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  {detail ? `${detail.organization.displayName} / ${detail.team.displayName}` : 'PulseCheck Admin'}
                </p>
                <h1 className="mt-2 text-3xl font-semibold">{detail?.pilot.name || 'Pilot dashboard'}</h1>
                <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                  Active-pilot monitoring surface rooted in PilotEnrollment. Athletes outside this pilot do not belong in these metrics or drill-downs.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {demoModeEnabled ? (
                <button
                  onClick={() => void resetDemoModeData()}
                  data-testid="pilot-dashboard-detail-demo-reset"
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 transition hover:bg-amber-400/15"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset Demo Data
                </button>
              ) : null}
              <button
                onClick={() => void toggleDemoMode()}
                data-testid="pilot-dashboard-detail-demo-toggle"
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition ${
                  demoModeEnabled
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15'
                    : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15'
                }`}
              >
                <MonitorPlay className="h-4 w-4" />
                {demoModeEnabled ? 'Exit Demo Mode' : 'Switch To Demo Mode'}
              </button>
              <button
                onClick={() => void load('refresh')}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
              >
                <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {demoModeEnabled ? (
            <div data-testid="pilot-dashboard-detail-demo-banner" className="mt-6 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Demo mode is on. This pilot dashboard is using safe local mock data, mock athlete enrollments, and mock AI research briefs so you can demo and QA without touching live pilot records.
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-8 text-sm text-zinc-400">Loading pilot dashboard...</div>
          ) : error ? (
            <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-sm text-rose-200">{error}</div>
          ) : !detail ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-8 text-sm text-zinc-400">Pilot not found.</div>
          ) : (
            <>
              {pageMessage ? (
                <div
                  className={`mt-6 rounded-3xl border p-4 text-sm ${
                    pageMessage.type === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {pageMessage.text}
                </div>
              ) : null}

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                {overviewCards.map((card) => (
                  <div key={card.label} className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <NoraMetricHelpButton metricKey={card.metricKey} className="absolute right-4 top-4" />
                    <div className="flex items-center gap-3 text-cyan-300">
                      {card.icon}
                      <span className="text-sm font-medium">{card.label}</span>
                    </div>
                    <div className="mt-3 text-3xl font-semibold">{card.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`pilot-dashboard-tab-${tab.id}`}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      activeTab === tab.id ? 'bg-cyan-400 text-black' : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 rounded-3xl border border-white/10 bg-[#11151f] p-4 lg:grid-cols-[minmax(0,280px),1fr]">
                <label className="space-y-2 text-sm text-zinc-300">
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Cohort Filter</span>
                  <select
                    value={cohortFilter}
                    onChange={(event) => setCohortFilter(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                  >
                    <option value="">All pilot cohorts</option>
                    {availableCohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                  Denominator lock: all KPI cards and tables on this page are scoped to active `PilotEnrollment` records in this pilot
                  {selectedCohort ? ` and the ${selectedCohort.name} cohort filter.` : '.'} Athletes outside this pilot are excluded.
                </div>
              </div>

              {activeTab === 'overview' ? (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5" data-testid="pilot-readout-workspace">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pilot Objective</div>
                      <div className="mt-3 text-sm text-zinc-300">{detail.pilot.objective || 'No pilot objective recorded yet.'}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Study Mode</div>
                      <div className="mt-3 text-sm text-zinc-300">{detail.pilot.studyMode}</div>
                      <div className="mt-4 text-xs uppercase tracking-[0.18em] text-zinc-500">Checkpoint Cadence</div>
                      <div className="mt-2 text-sm text-zinc-300">{detail.pilot.checkpointCadence || 'Not set'}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">V1 Lock</div>
                      <div className="mt-3 text-sm text-zinc-300">
                        Overview, engine health, athlete drill-down, and manual hypothesis tracking are in scope here. Adoption automation and review queue stay deferred to V2.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Pilot Athlete Invite</h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          Generate the PulseCheck athlete share link used in provisioning, but scoped directly to this pilot
                          {selectedCohort ? ` and ${selectedCohort.name}.` : '.'}
                        </p>
                        <p className="mt-3 text-sm text-zinc-300">
                          Existing Pulse athletes should sign in and get attached to the pilot without replaying onboarding. New athletes should create an account and follow the mobile setup walkthrough.
                        </p>
                        <p className="mt-2 text-xs text-zinc-500">
                          This link is intended to be the preview-ready PulseCheck share link. Once your PulseCheck OneLink template is configured in AppsFlyer, it should open PulseCheck directly instead of Fit With Pulse.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void handleCreatePilotInviteLink()}
                          disabled={creatingInvite}
                          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Clipboard className="h-4 w-4" />
                          {creatingInvite ? 'Generating Link...' : scopedInvite ? 'Generate New Link' : 'Create Invite Link'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Invite Scope</div>
                      <div className="mt-2">
                        {selectedCohort
                          ? `Athletes joining through this link will enter ${detail.pilot.name} and land directly in ${selectedCohort.name}.`
                          : `Athletes joining through this link will enter ${detail.pilot.name}. Apply a cohort filter first if you want a cohort-specific invite.`}
                      </div>
                      <div className="mt-3 text-xs text-zinc-500">
                        {scopedActiveInvites.length > 0
                          ? `${scopedActiveInvites.length} active invite link${scopedActiveInvites.length === 1 ? '' : 's'} currently available for this scope.`
                          : 'No active invite links exist for this scope yet.'}
                      </div>
                    </div>

                    {scopedInvite ? (
                      <div
                        data-testid="pilot-invite-diagnostics"
                        className={`mt-4 rounded-2xl border p-4 ${
                          scopedInviteDiagnostic.status === 'valid'
                            ? 'border-emerald-400/20 bg-emerald-400/10'
                            : 'border-amber-400/20 bg-amber-400/10'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Invite Diagnostics</span>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] ${
                              scopedInviteDiagnostic.status === 'valid'
                                ? 'border border-emerald-400/25 bg-emerald-400/15 text-emerald-100'
                                : 'border border-amber-400/25 bg-amber-400/15 text-amber-100'
                            }`}
                          >
                            {scopedInviteDiagnostic.status === 'valid' ? 'Locally valid' : 'Needs attention'}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-zinc-200">{scopedInviteDiagnostic.summary}</p>
                        <div className="mt-3 text-xs text-zinc-400">
                          Fallback redirect:{' '}
                          <span className="text-zinc-200">{scopedInviteDiagnostic.fallbackUrl || 'Missing'}</span>
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                          {scopedInviteDiagnostic.details.map((detailLine) => (
                            <li key={detailLine} className="flex gap-2">
                              <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
                              <span>{detailLine}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {scopedActiveInvites.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {scopedActiveInvites.map((invite, index) => (
                          <div key={invite.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                                    {index === 0 ? 'Latest link' : `Link ${scopedActiveInvites.length - index}`}
                                  </span>
                                  <span className={`rounded-full px-3 py-1 text-[11px] ${
                                    isPulseCheckInviteOneLink(invite.activationUrl)
                                      ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                                      : 'border border-amber-400/20 bg-amber-400/10 text-amber-100'
                                  }`}>
                                    {isPulseCheckInviteOneLink(invite.activationUrl) ? 'PulseCheck share link' : 'Fallback web link'}
                                  </span>
                                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                    Created {formatTimeValue(invite.createdAt)}
                                  </span>
                                </div>
                                <div className="mt-3 break-all text-xs text-cyan-100">{invite.activationUrl}</div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  data-testid={`pilot-invite-copy-${invite.id}`}
                                  onClick={() => void copyInviteLink(invite.id, invite.activationUrl, 'Pilot athlete share link copied to clipboard.')}
                                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition-all duration-200 ${
                                    copiedInviteId === invite.id
                                      ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.08)]'
                                      : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                                  }`}
                                >
                                  {copiedInviteId === invite.id ? <CheckCircle2 className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                                  {copiedInviteId === invite.id ? 'Copied to Clipboard' : 'Copy Share Link'}
                                </button>
                                <a
                                  href={invite.activationUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Open
                                </a>
                                <button
                                  onClick={() => void handleRevokePilotInviteLink(invite)}
                                  disabled={revokingInviteId === invite.id}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {revokingInviteId === invite.id ? 'Deactivating...' : 'Deactivate'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
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
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Required Agreements</div>
                            <div className="mt-2 max-w-2xl text-sm text-zinc-400">
                              Attach the exact agreements this pilot requires before an athlete can use the app. The native app will keep reopening this gate on launch and resume until every required agreement here is accepted.
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={addRequiredConsentDraft}
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                            >
                              Add Agreement
                            </button>
                            <button
                              onClick={() => void saveRequiredConsents()}
                              disabled={savingRequiredConsents}
                              className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 transition hover:bg-emerald-400/15 disabled:opacity-60"
                            >
                              {savingRequiredConsents ? 'Saving...' : 'Save Agreements'}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-4">
                          {requiredConsentDrafts.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-zinc-500">
                              No pilot-specific agreements are attached yet.
                            </div>
                          ) : null}

                          {requiredConsentDrafts.map((consent, index) => (
                            <div key={`${consent.id}-${index}`} className="rounded-2xl border border-white/10 bg-[#11151f] p-4">
                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.4fr_auto]">
                                <label className="space-y-2 text-sm text-zinc-300">
                                  <span className="text-xs uppercase tracking-wide text-zinc-500">Agreement Title</span>
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
                                <span className="text-xs uppercase tracking-wide text-zinc-500">Agreement Body</span>
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
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Active Athletes</th>
                            <th className="px-3 py-2 text-left">Engine Coverage</th>
                            <th className="px-3 py-2 text-left">Stable Patterns</th>
                            <th className="px-3 py-2 text-left">Projections</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleCohortSummaries.length === 0 ? (
                            <tr className="border-t border-white/5">
                              <td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-500">
                                No cohort rollups match the current filter.
                              </td>
                            </tr>
                          ) : (
                            visibleCohortSummaries.map((summary) => (
                              <tr key={summary.cohortId} className="border-t border-white/5">
                                <td className="px-3 py-3 font-medium text-white">{summary.cohortName}</td>
                                <td className="px-3 py-3 text-zinc-300">{summary.cohortStatus}</td>
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
                          Only athletes with active PilotEnrollment in this pilot appear here{selectedCohort ? `, filtered to ${selectedCohort.name}.` : '.'}
                        </p>
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
                            <th className="px-3 py-2 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleAthletes.length === 0 ? (
                            <tr className="border-t border-white/5">
                              <td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-500">
                                No active pilot athletes match the current cohort filter.
                              </td>
                            </tr>
                          ) : (
                            visibleAthletes.map((athlete) => (
                              <tr key={athlete.athleteId} className="border-t border-white/5">
                                <td className="px-3 py-3">
                                  <div className="font-medium text-white">{athlete.displayName}</div>
                                  <div className="text-xs text-zinc-500">{athlete.email || athlete.athleteId}</div>
                                </td>
                                <td className="px-3 py-3 text-zinc-300">{athlete.cohort?.name || 'No cohort'}</td>
                                <td className="px-3 py-3 text-zinc-300">{athlete.engineSummary.evidenceRecordCount}</td>
                                <td className="px-3 py-3 text-zinc-300">{athlete.engineSummary.patternModelCount}</td>
                                <td className="px-3 py-3 text-zinc-300">{athlete.engineSummary.recommendationProjectionCount}</td>
                                <td className="px-3 py-3">
                                  <div className="flex flex-col items-start gap-2">
                                    <Link
                                      href={`/admin/pulsecheckPilotDashboard/${encodeURIComponent(detail.pilot.id)}/athletes/${encodeURIComponent(
                                        athlete.athleteId
                                      )}`}
                                      className="text-cyan-200 hover:text-cyan-100"
                                    >
                                      Open athlete
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => void handleUnenrollAthlete(athlete)}
                                      disabled={unenrollingAthleteId === athlete.athleteId}
                                      className="text-rose-200 transition hover:text-rose-100 disabled:cursor-not-allowed disabled:text-zinc-500"
                                    >
                                      {unenrollingAthleteId === athlete.athleteId ? 'Unenrolling...' : 'Unenroll from pilot'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'engine-health' ? (
                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="athletes-with-engine-record" className="absolute right-4 top-4" />
                      <div className="flex items-center gap-3 text-emerald-300">
                        <Database className="h-5 w-5" />
                        <span className="text-sm font-medium">Athletes With Engine Record</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.athletesWithEngineRecord}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="evidence-records" className="absolute right-4 top-4" />
                      <div className="flex items-center gap-3 text-cyan-300">
                        <Activity className="h-5 w-5" />
                        <span className="text-sm font-medium">Evidence Records</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.totalEvidenceRecords}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="pattern-models" className="absolute right-4 top-4" />
                      <div className="flex items-center gap-3 text-amber-300">
                        <Brain className="h-5 w-5" />
                        <span className="text-sm font-medium">Pattern Models</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.totalPatternModels}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="engine-coverage" className="absolute right-4 top-4" />
                      <div className="flex items-center gap-3 text-violet-300">
                        <Users2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Engine Coverage</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{formatPercent(visibleCoverage.engineCoverageRate)}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="avg-evidence-per-athlete" className="absolute right-4 top-4" />
                      <div className="flex items-center gap-3 text-cyan-300">
                        <FlaskConical className="h-5 w-5" />
                        <span className="text-sm font-medium">Avg Evidence / Athlete</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{formatAverage(visibleCoverage.avgEvidenceRecordsPerActiveAthlete)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="pattern-density" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pattern Density</div>
                      <div className="mt-3 text-sm text-zinc-300">
                        Average pattern models per active pilot athlete: <span className="font-medium text-white">{formatAverage(visibleCoverage.avgPatternModelsPerActiveAthlete)}</span>
                      </div>
                      <div className="mt-2 text-sm text-zinc-300">
                        Average recommendation projections per active pilot athlete: <span className="font-medium text-white">{formatAverage(visibleCoverage.avgRecommendationProjectionsPerActiveAthlete)}</span>
                      </div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="pilot-health-read" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pilot Health Read</div>
                      <div className="mt-3 text-sm text-zinc-300">
                        Stable pattern rate currently sits at <span className="font-medium text-white">{formatPercent(visibleCoverage.stablePatternRate)}</span>. This remains a trustworthy V1 signal because it is derived from persisted pattern-model confidence tiers inside the active pilot population.
                      </div>
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
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">V2 Deferred</div>
                      <div className="mt-3 text-sm text-zinc-300">
                        Outcome validation, adoption metrics, automated review queue, and automated hypothesis support remain explicitly deferred until those event contracts and joins are implemented.
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="not-enough-data" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Not Enough Data</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.notEnoughDataCount}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="promising" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Promising</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.promisingCount}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="mixed" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Mixed</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.mixedCount}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="not-supported" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Not Supported</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.notSupportedCount}</div>
                    </div>
                    <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <NoraMetricHelpButton metricKey="high-confidence" className="absolute right-4 top-4" />
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">High Confidence</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.highConfidenceCount}</div>
                    </div>
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
                                    Candidate findings only. Keep these in “worth discussing” posture until outcome validation, replication, and stronger controls are in place.
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
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckPilotDashboardDetailPage;
