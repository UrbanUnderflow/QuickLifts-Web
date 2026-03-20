import React, { useEffect, useMemo, useState } from 'react';
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
  FlaskConical,
  RefreshCcw,
  Save,
  Users2,
} from 'lucide-react';
import AdminRouteGuard from '../../../components/auth/AdminRouteGuard';
import { pulseCheckPilotDashboardService } from '../../../api/firebase/pulsecheckPilotDashboard/service';
import { pulseCheckProvisioningService } from '../../../api/firebase/pulsecheckProvisioning/service';
import type { PulseCheckInviteLink } from '../../../api/firebase/pulsecheckProvisioning/types';
import { useUser } from '../../../hooks/useUser';
import type {
  PilotDashboardDetail,
  PilotHypothesisConfidenceLevel,
  PilotHypothesisStatus,
  PulseCheckPilotInviteConfig,
  PulseCheckPilotHypothesis,
} from '../../../api/firebase/pulsecheckPilotDashboard/types';

type DetailTab = 'overview' | 'engine-health' | 'findings' | 'hypotheses';

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
  const [savingHypothesisId, setSavingHypothesisId] = useState<string | null>(null);
  const [savingInviteConfig, setSavingInviteConfig] = useState(false);
  const [savingInviteDefaultScope, setSavingInviteDefaultScope] = useState<'team' | 'organization' | null>(null);
  const [resettingInviteConfig, setResettingInviteConfig] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const load = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!pilotId) return;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const nextDetail = await pulseCheckPilotDashboardService.getPilotDashboardDetail(pilotId);
      setDetail(nextDetail);
      if (nextDetail?.team.id) {
        const nextInviteLinks = await pulseCheckProvisioningService.listTeamInviteLinks(nextDetail.team.id);
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

  const activeCohorts = useMemo(
    () => (detail?.cohorts || []).filter((cohort) => cohort.status === 'active'),
    [detail]
  );

  const availableCohorts = activeCohorts.length > 0 ? activeCohorts : detail?.cohorts || [];

  const selectedCohort = useMemo(
    () => availableCohorts.find((cohort) => cohort.id === cohortFilter) || null,
    [availableCohorts, cohortFilter]
  );

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

  const scopedInvite = useMemo(() => {
    if (!detail) return null;
    return inviteLinks.find((invite) => {
      if (invite.status !== 'active') return false;
      if (invite.inviteType !== 'team-access') return false;
      if (invite.teamMembershipRole !== 'athlete') return false;
      if ((invite.pilotId || '') !== detail.pilot.id) return false;
      if (selectedCohort) {
        return (invite.cohortId || '') === selectedCohort.id;
      }
      return !(invite.cohortId || '');
    }) || null;
  }, [detail, inviteLinks, selectedCohort]);

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
      { label: 'Active Pilot Athletes', value: String(visibleMetrics.activeAthleteCount), icon: <Users2 className="h-5 w-5" /> },
      { label: cohortFilter ? 'Selected Cohort' : 'Active Cohorts', value: String(visibleMetrics.cohortCount), icon: <FlaskConical className="h-5 w-5" /> },
      { label: 'Athletes With Stable Patterns', value: String(visibleMetrics.athletesWithStablePatterns), icon: <Brain className="h-5 w-5" /> },
      { label: 'Hypotheses', value: String(detail.metrics.hypothesisCount), icon: <CheckCircle2 className="h-5 w-5" /> },
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

  const copyInviteLink = async (activationUrl: string, successText: string) => {
    try {
      await navigator.clipboard.writeText(activationUrl);
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
      const inviteId = await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: detail.organization.id,
        teamId: detail.team.id,
        teamMembershipRole: 'athlete',
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
          ? `Pilot invite for ${selectedCohort.name} was created and copied.`
          : 'Pilot athlete invite was created and copied.',
      });
    } catch (inviteError) {
      console.error('[PulseCheckPilotDashboard] Failed to create pilot invite link:', inviteError);
      setPageMessage({ type: 'error', text: 'Failed to create pilot athlete invite link.' });
    } finally {
      setCreatingInvite(false);
    }
  };

  const updateInviteConfigField = (field: keyof PulseCheckPilotInviteConfig, value: string) => {
    setInviteConfigDraft((current) => (current ? { ...current, [field]: value } : current));
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
            <button
              onClick={() => void load('refresh')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

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
                  <div key={card.label} className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
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
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
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
                          Generate the same athlete invite link used in provisioning, but scoped directly to this pilot
                          {selectedCohort ? ` and ${selectedCohort.name}.` : '.'}
                        </p>
                        <p className="mt-3 text-sm text-zinc-300">
                          Existing Pulse athletes should sign in and get attached to the pilot without replaying onboarding. New athletes should create an account and follow the mobile setup walkthrough.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {scopedInvite ? (
                          <>
                            <button
                              onClick={() => void copyInviteLink(scopedInvite.activationUrl, 'Pilot athlete invite copied to clipboard.')}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                            >
                              <Clipboard className="h-4 w-4" />
                              Copy Invite
                            </button>
                            <a
                              href={scopedInvite.activationUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Open Invite
                            </a>
                          </>
                        ) : (
                          <button
                            onClick={() => void handleCreatePilotInviteLink()}
                            disabled={creatingInvite}
                            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Clipboard className="h-4 w-4" />
                            {creatingInvite ? 'Creating Invite...' : 'Create Invite Link'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Invite Scope</div>
                      <div className="mt-2">
                        {selectedCohort
                          ? `Athletes joining through this link will enter ${detail.pilot.name} and land directly in ${selectedCohort.name}.`
                          : `Athletes joining through this link will enter ${detail.pilot.name}. Apply a cohort filter first if you want a cohort-specific invite.`}
                      </div>
                      {scopedInvite ? (
                        <div className="mt-3 break-all text-xs text-cyan-100">{scopedInvite.activationUrl}</div>
                      ) : null}
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
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Enrollment Boundary</div>
                      <div className="mt-3 text-2xl font-semibold text-white">
                        {visibleMetrics.activeAthleteCount} / {detail.metrics.totalEnrollmentCount}
                      </div>
                      <div className="mt-2 text-sm text-zinc-400">
                        Active pilot athletes in view versus total enrollments recorded for this pilot.
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Engine Coverage</div>
                      <div className="mt-3 text-2xl font-semibold text-white">{formatPercent(visibleCoverage.engineCoverageRate)}</div>
                      <div className="mt-2 text-sm text-zinc-400">
                        Active pilot athletes with a correlation-engine record.
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
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
                                  <Link
                                    href={`/admin/pulsecheckPilotDashboard/${encodeURIComponent(detail.pilot.id)}/athletes/${encodeURIComponent(
                                      athlete.athleteId
                                    )}`}
                                    className="text-cyan-200 hover:text-cyan-100"
                                  >
                                    Open athlete
                                  </Link>
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
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex items-center gap-3 text-emerald-300">
                        <Database className="h-5 w-5" />
                        <span className="text-sm font-medium">Athletes With Engine Record</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.athletesWithEngineRecord}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex items-center gap-3 text-cyan-300">
                        <Activity className="h-5 w-5" />
                        <span className="text-sm font-medium">Evidence Records</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.totalEvidenceRecords}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex items-center gap-3 text-amber-300">
                        <Brain className="h-5 w-5" />
                        <span className="text-sm font-medium">Pattern Models</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{visibleMetrics.totalPatternModels}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex items-center gap-3 text-violet-300">
                        <Users2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Engine Coverage</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{formatPercent(visibleCoverage.engineCoverageRate)}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="flex items-center gap-3 text-cyan-300">
                        <FlaskConical className="h-5 w-5" />
                        <span className="text-sm font-medium">Avg Evidence / Athlete</span>
                      </div>
                      <div className="mt-3 text-3xl font-semibold">{formatAverage(visibleCoverage.avgEvidenceRecordsPerActiveAthlete)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pattern Density</div>
                      <div className="mt-3 text-sm text-zinc-300">
                        Average pattern models per active pilot athlete: <span className="font-medium text-white">{formatAverage(visibleCoverage.avgPatternModelsPerActiveAthlete)}</span>
                      </div>
                      <div className="mt-2 text-sm text-zinc-300">
                        Average recommendation projections per active pilot athlete: <span className="font-medium text-white">{formatAverage(visibleCoverage.avgRecommendationProjectionsPerActiveAthlete)}</span>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
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
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Not Enough Data</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.notEnoughDataCount}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Promising</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.promisingCount}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Mixed</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.mixedCount}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Not Supported</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.notSupportedCount}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">High Confidence</div>
                      <div className="mt-3 text-3xl font-semibold">{detail.hypothesisSummary.highConfidenceCount}</div>
                    </div>
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
            </>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckPilotDashboardDetailPage;
