import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Activity, AlertTriangle, ArrowLeft, Brain, Database, FileText, MonitorPlay, RefreshCcw, ShieldAlert, Users2 } from 'lucide-react';
import AdminRouteGuard from '../../../../../components/auth/AdminRouteGuard';
import NoraMetricHelpButton from '../../../../../components/admin/pilot-dashboard/NoraMetricHelpButton';
import { pulseCheckPilotDashboardService } from '../../../../../api/firebase/pulsecheckPilotDashboard/service';
import type { PilotDashboardAthleteDetail } from '../../../../../api/firebase/pulsecheckPilotDashboard/types';

const coerceTimestampMs = (value: any) => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  return 0;
};

const formatTimestamp = (value: any) => {
  if (!value) return 'Not recorded';
  if (typeof value === 'number') return new Date(coerceTimestampMs(value)).toLocaleString();
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  return 'Not recorded';
};

const formatShortDate = (value: any) => {
  if (!value) return 'Not recorded';
  if (typeof value === 'number') return new Date(coerceTimestampMs(value)).toLocaleDateString();
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleDateString();
  return 'Not recorded';
};

const formatDateKey = (dateKey: string) => {
  if (!dateKey) return 'Unknown day';
  const value = new Date(`${dateKey}T12:00:00Z`);
  return Number.isNaN(value.getTime()) ? dateKey : value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatExclusionReason = (value?: string | null) => {
  switch (value) {
    case 'not_enrolled_yet':
      return 'Not enrolled yet';
    case 'manual_pause':
      return 'Manual pause';
    case 'paused':
      return 'Enrollment paused';
    case 'escalation_hold':
      return 'Escalation hold';
    case 'no_task_rest_day':
      return 'No-task rest day';
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return 'Excluded';
  }
};

const escalationDispositionClassName = (label: string) => {
  switch (label) {
    case 'Care completed':
    case 'Resolved':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100';
    case 'Declined care':
      return 'border-amber-400/25 bg-amber-400/10 text-amber-100';
    case 'Open care':
    case 'In care':
    case 'Consent pending':
      return 'border-rose-400/25 bg-rose-400/10 text-rose-100';
    case 'Coach review':
      return 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100';
    case 'Support flag':
      return 'border-violet-400/25 bg-violet-400/10 text-violet-100';
    default:
      return 'border-white/10 bg-white/5 text-zinc-300';
  }
};

const PulseCheckPilotDashboardAthletePage: React.FC = () => {
  const router = useRouter();
  const pilotId = typeof router.query.pilotId === 'string' ? router.query.pilotId : '';
  const athleteId = typeof router.query.athleteId === 'string' ? router.query.athleteId : '';
  const [detail, setDetail] = useState<PilotDashboardAthleteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);

  const load = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!pilotId || !athleteId) return;
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
      const nextDetail = await pulseCheckPilotDashboardService.getPilotAthleteDetail(pilotId, athleteId);
      setDetail(nextDetail);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load pilot athlete detail.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [pilotId, athleteId]);

  const groupedIncidents = useMemo(() => {
    if (!detail) return [];
    const groups = detail.escalations.reduce<Record<string, PilotDashboardAthleteDetail['escalations']>>((accumulator, escalation) => {
      const key = escalation.groupedIncidentKey || escalation.id;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(escalation);
      return accumulator;
    }, {});

    return Object.values(groups).sort(
      (left, right) => coerceTimestampMs(right[0]?.createdAt) - coerceTimestampMs(left[0]?.createdAt)
    );
  }, [detail]);

  const escalationComparison = useMemo(() => {
    const legacyRecordCount = detail?.escalations.length || 0;
    const normalizedIncidentCount = groupedIncidents.length;
    const recordsCollapsedByGrouping = Math.max(0, legacyRecordCount - normalizedIncidentCount);
    return {
      legacyRecordCount,
      normalizedIncidentCount,
      recordsCollapsedByGrouping,
    };
  }, [detail, groupedIncidents]);

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

  return (
    <AdminRouteGuard>
      <Head>
        <title>{detail ? `${detail.displayName} | Pilot Athlete` : 'Pilot Athlete'}</title>
      </Head>
      <div className="min-h-screen bg-[#0b0f17] text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Link
                href={pilotId ? `/admin/pulsecheckPilotDashboard/${encodeURIComponent(pilotId)}` : '/admin/pulsecheckPilotDashboard'}
                className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to pilot
              </Link>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  {detail ? `${detail.organization.displayName} / ${detail.team.displayName} / ${detail.pilot.name}` : 'PulseCheck Admin'}
                </p>
                <h1 className="mt-2 text-3xl font-semibold">{detail?.displayName || 'Pilot athlete'}</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Athlete drill-down inside one pilot. This page should only describe the athlete as a member of the selected pilot.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void toggleDemoMode()}
                data-testid="pilot-dashboard-athlete-demo-toggle"
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
            <div data-testid="pilot-dashboard-athlete-demo-banner" className="mt-6 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Demo mode is on. This athlete drill-down is showing mock pilot enrollment, evidence, and snapshot history for walkthrough and QA use only.
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-8 text-sm text-zinc-400">Loading athlete detail...</div>
          ) : error ? (
            <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-sm text-rose-200">{error}</div>
          ) : !detail ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-8 text-sm text-zinc-400">
              This athlete does not have an active enrollment in the selected pilot.
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <NoraMetricHelpButton metricKey="cohort" className="absolute right-4 top-4" />
                  <div className="flex items-center gap-3 text-cyan-300">
                    <Users2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Cohort</span>
                  </div>
                  <div className="mt-3 text-lg font-semibold">{detail.cohort?.name || 'No cohort'}</div>
                </div>
                <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <NoraMetricHelpButton metricKey="evidence-records" className="absolute right-4 top-4" />
                  <div className="flex items-center gap-3 text-emerald-300">
                    <Database className="h-5 w-5" />
                    <span className="text-sm font-medium">Evidence Records</span>
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{detail.engineSummary.evidenceRecordCount}</div>
                </div>
                <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <NoraMetricHelpButton metricKey="stable-patterns" className="absolute right-4 top-4" />
                  <div className="flex items-center gap-3 text-amber-300">
                    <Brain className="h-5 w-5" />
                    <span className="text-sm font-medium">Stable Patterns</span>
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{detail.engineSummary.stablePatternCount}</div>
                </div>
                <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <NoraMetricHelpButton metricKey="profile-snapshots" className="absolute right-4 top-4" />
                  <div className="flex items-center gap-3 text-violet-300">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm font-medium">Profile Snapshots</span>
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{detail.profileSnapshotCount}</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <NoraMetricHelpButton metricKey="pilot-enrollment" className="absolute right-4 top-4" />
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pilot Enrollment</div>
                  <div className="mt-3 space-y-3 text-sm text-zinc-300">
                    <div>Email: {detail.email || 'No email on team membership'}</div>
                    <div>Enrollment status: {detail.pilotEnrollment.status}</div>
                    <div>Study mode: {detail.pilotEnrollment.studyMode}</div>
                    <div>Enrollment mode: {detail.pilotEnrollment.enrollmentMode}</div>
                    <div>Product consent: {detail.pilotEnrollment.productConsentAccepted ? 'Accepted' : 'Pending'}</div>
                  </div>
                </div>
                <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <NoraMetricHelpButton metricKey="engine-summary" className="absolute right-4 top-4" />
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Engine Summary</div>
                  <div className="mt-3 space-y-3 text-sm text-zinc-300">
                    <div>Engine record: {detail.engineSummary.hasEngineRecord ? 'Present' : 'Missing'}</div>
                    <div>Pattern models: {detail.engineSummary.patternModelCount}</div>
                    <div>High-confidence patterns: {detail.engineSummary.highConfidencePatternCount}</div>
                    <div>Degraded patterns: {detail.engineSummary.degradedPatternCount}</div>
                    <div>Recommendation projections: {detail.engineSummary.recommendationProjectionCount}</div>
                    <div>Last engine refresh: {formatTimestamp(detail.engineSummary.lastEngineRefreshAt)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Expected Days</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{detail.adherenceSummary.expectedAthleteDays}</div>
                  <div className="mt-2 text-sm text-zinc-400">Pilot days counted in the governed adherence denominator.</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Green Days</div>
                  <div className="mt-3 text-3xl font-semibold text-emerald-200">{detail.adherenceSummary.adheredDays}</div>
                  <div className="mt-2 text-sm text-zinc-400">{detail.adherenceSummary.adherenceRate.toFixed(1)}% full-day adherence.</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Check-In Days</div>
                  <div className="mt-3 text-3xl font-semibold text-cyan-100">{detail.adherenceSummary.completedCheckInDays}</div>
                  <div className="mt-2 text-sm text-zinc-400">{detail.adherenceSummary.dailyCheckInRate.toFixed(1)}% of expected days.</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Assignment Days</div>
                  <div className="mt-3 text-3xl font-semibold text-amber-100">{detail.adherenceSummary.completedAssignmentDays}</div>
                  <div className="mt-2 text-sm text-zinc-400">{detail.adherenceSummary.assignmentCompletionRate.toFixed(1)}% of expected days.</div>
                </div>
              </div>

              <div className="relative mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-5">
                <NoraMetricHelpButton metricKey="milestone-context" className="absolute right-4 top-4" />
                <div className="flex items-center gap-3 text-cyan-300">
                  <Activity className="h-5 w-5" />
                  <span className="text-sm font-medium">Milestone Context</span>
                </div>
                <div className="mt-4 text-sm text-zinc-300">
                  Latest assessment context flag: <span className="font-medium text-white">{detail.latestAssessmentContextFlagStatus}</span>
                </div>
                <div className="mt-2 text-sm text-zinc-400">Latest captured at: {formatTimestamp(detail.latestAssessmentCapturedAt)}</div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-5">
                <div className="flex items-center gap-3 text-emerald-300">
                  <Activity className="h-5 w-5" />
                  <span className="text-sm font-medium">Pilot Day Trace</span>
                </div>
                <p className="mt-3 text-sm text-zinc-400">
                  Each row shows whether that pilot day counted in the denominator, and whether the athlete completed both the check-in and the assigned action.
                </p>
                <div className="mt-4 space-y-3">
                  {detail.adherenceDays.length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-400">
                      No pilot-day adherence trace has been recorded for this athlete yet.
                    </div>
                  ) : (
                    detail.adherenceDays.map((day) => {
                      const statusClasses =
                        day.status === 'green'
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : day.status === 'red'
                            ? 'border-rose-500/30 bg-rose-500/10'
                            : 'border-amber-400/20 bg-amber-400/10';
                      return (
                        <div key={day.dateKey} className={`rounded-2xl border p-4 ${statusClasses}`}>
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="text-sm font-medium text-white">{formatDateKey(day.dateKey)}</div>
                              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-400">
                                {day.status === 'green' ? 'Green day' : day.status === 'red' ? 'Red day' : formatExclusionReason(day.exclusionReason)}
                              </div>
                            </div>
                            <div className="text-xs text-zinc-300">
                              {day.expected ? 'Counted in denominator' : 'Excluded from denominator'} · {day.timezone}
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Check-In</div>
                              <div className="mt-2 text-sm font-medium text-white">{day.checkInCompleted ? 'Completed' : 'Missing'}</div>
                              <div className="mt-1 text-xs text-zinc-400">
                                {day.checkInCompleted ? `${day.checkInCount} recorded · ${formatTimestamp(day.checkInRecordedAt)}` : 'No pilot check-in recorded'}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Assignment</div>
                              <div className="mt-2 text-sm font-medium text-white">{day.assignmentCompleted ? 'Completed' : 'Missing'}</div>
                              <div className="mt-1 text-xs text-zinc-400">
                                {day.assignmentActionType || day.assignmentStatus
                                  ? `${day.assignmentActionType || 'assignment'} · ${day.assignmentStatus || 'status unknown'}`
                                  : 'No assignment metadata recorded'}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Completion Time</div>
                              <div className="mt-2 text-sm font-medium text-white">{formatTimestamp(day.assignmentCompletedAt)}</div>
                              <div className="mt-1 text-xs text-zinc-400">{day.assignmentId ? `Assignment ${day.assignmentId}` : 'No assignment id recorded'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Why This Day Counted</div>
                              <div className="mt-2 text-sm font-medium text-white">{day.expected ? 'Expected day' : formatExclusionReason(day.exclusionReason)}</div>
                              <div className="mt-1 text-xs text-zinc-400">
                                {day.expected ? 'Both check-in and assignment completion are needed for green.' : 'Excluded days do not hurt adherence.'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-5">
                <div className="flex items-center gap-3 text-rose-300">
                  <ShieldAlert className="h-5 w-5" />
                  <span className="text-sm font-medium">Escalation Detail</span>
                </div>
                <p className="mt-3 text-sm text-zinc-400">
                  These are the pilot-scoped escalation records currently tied to this athlete inside the selected pilot outcome frame.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Legacy Raw Records</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{escalationComparison.legacyRecordCount}</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Normalized Incidents</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{escalationComparison.normalizedIncidentCount}</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Records Collapsed</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{escalationComparison.recordsCollapsedByGrouping}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-zinc-500">
                  This uses the same grouped-incident normalization shown in the pilot dashboard rollout review.
                </div>
                <div className="mt-4 space-y-3">
                  {groupedIncidents.length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-400">
                      No escalations are currently linked to this athlete in the pilot outcome frame.
                    </div>
                  ) : (
                    groupedIncidents.map((incident) => {
                      const lead = incident[0];
                      return (
                        <div key={lead.groupedIncidentKey} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 text-white">
                                <AlertTriangle className="h-4 w-4 text-rose-300" />
                                <span className="font-medium">{lead.groupedIncidentLabel}</span>
                                <span className={`rounded-full border px-2 py-1 text-[11px] ${escalationDispositionClassName(lead.groupedIncidentDispositionLabel)}`}>
                                  {lead.groupedIncidentDispositionLabel}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-zinc-400">
                                {lead.groupedIncidentRecordCount} record{lead.groupedIncidentRecordCount === 1 ? '' : 's'} · latest created {formatTimestamp(lead.createdAt)}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px]">
                              {lead.coachReviewFlag ? (
                                <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 text-cyan-100">Coach review</span>
                              ) : null}
                              {lead.supportFlag ? (
                                <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-1 text-violet-100">Support flag</span>
                              ) : null}
                              {lead.openCareEscalation ? (
                                <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-rose-100">Open care</span>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            {incident.map((escalation) => (
                              <div key={escalation.id} className="rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2 text-white">
                                      <span className="font-medium">Tier {escalation.tier} escalation</span>
                                      <span className={`rounded-full border px-2 py-1 text-[11px] ${escalationDispositionClassName(escalation.dispositionLabel)}`}>
                                        {escalation.dispositionLabel}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-xs text-zinc-400">
                                      {escalation.category} · {escalation.status} · created {formatTimestamp(escalation.createdAt)}
                                    </div>
                                  </div>
                                  <div className="text-xs text-zinc-400">
                                    {escalation.consentStatus ? `Consent ${escalation.consentStatus}` : 'No consent state'} · {escalation.handoffStatus || 'No handoff state'}
                                  </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Coach Notified</div>
                                    <div className="mt-2">{formatTimestamp(escalation.coachNotifiedAt)}</div>
                                  </div>
                                  <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Handoff Initiated</div>
                                    <div className="mt-2">{formatTimestamp(escalation.handoffInitiatedAt)}</div>
                                  </div>
                                  <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Clinician Response</div>
                                    <div className="mt-2">{formatTimestamp(escalation.firstClinicianResponseAt)}</div>
                                  </div>
                                  <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Resolved</div>
                                    <div className="mt-2">{formatTimestamp(escalation.resolvedAt || escalation.handoffCompletedAt)}</div>
                                  </div>
                                </div>
                                {escalation.classificationReason || escalation.triggerContent ? (
                                  <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                    {escalation.classificationReason ? (
                                      <div><span className="text-zinc-500">Classification:</span> {escalation.classificationReason}</div>
                                    ) : null}
                                    {escalation.triggerContent ? (
                                      <div className="mt-2"><span className="text-zinc-500">Trigger:</span> {escalation.triggerContent}</div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <NoraMetricHelpButton metricKey="recent-evidence" className="absolute right-4 top-4" />
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Recent Evidence</div>
                  <div className="mt-4 space-y-3">
                    {detail.recentEvidence.length === 0 ? (
                      <div className="text-sm text-zinc-400">No pilot evidence records found for this athlete.</div>
                    ) : (
                      detail.recentEvidence.map((evidence) => (
                        <div key={`${evidence.evidenceId}-${evidence.athleteLocalDate}`} className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                          <div className="font-medium text-white">{evidence.coreMetricName || evidence.evidenceId}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {evidence.sourceFamily} / {evidence.freshness} / {evidence.dataConfidence}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">{evidence.alignmentType} on {formatShortDate(evidence.sessionTimestamp)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <NoraMetricHelpButton metricKey="recent-patterns" className="absolute right-4 top-4" />
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Recent Patterns</div>
                  <div className="mt-4 space-y-3">
                    {detail.recentPatterns.length === 0 ? (
                      <div className="text-sm text-zinc-400">No active pattern models found for this athlete.</div>
                    ) : (
                      detail.recentPatterns.map((pattern) => (
                        <div key={pattern.patternKey} className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                          <div className="font-medium text-white">{pattern.patternFamily}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {pattern.confidenceTier} / {pattern.recommendationEligibility} / {pattern.freshnessTier}
                          </div>
                          <div className="mt-2 text-xs text-zinc-400">{pattern.athleteSummary}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="relative rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <NoraMetricHelpButton metricKey="recent-projections" className="absolute right-4 top-4" />
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Recent Projections</div>
                  <div className="mt-4 space-y-3">
                    {detail.recentProjections.length === 0 ? (
                      <div className="text-sm text-zinc-400">No recommendation projections found for this athlete.</div>
                    ) : (
                      detail.recentProjections.map((projection) => (
                        <div key={projection.projectionKey} className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                          <div className="font-medium text-white">{projection.summaryTitle}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {projection.consumer} / {projection.confidenceTier} / {projection.warningLevel}
                          </div>
                          <div className="mt-2 text-xs text-zinc-400">{projection.sourceSummary}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="relative mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-5">
                <NoraMetricHelpButton metricKey="snapshot-history" className="absolute right-4 top-4" />
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Snapshot History</div>
                <div className="mt-4 space-y-3">
                  {detail.snapshotHistory.length === 0 ? (
                    <div className="text-sm text-zinc-400">No pilot-linked profile snapshots found yet.</div>
                  ) : (
                    detail.snapshotHistory.map((snapshot) => (
                      <div key={`${snapshot.snapshotKey}-${snapshot.milestoneType}`} className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                        <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="font-medium text-white">{snapshot.milestoneType}</div>
                            <div className="text-xs text-zinc-500">{formatTimestamp(snapshot.capturedAt)}</div>
                          </div>
                          <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">{snapshot.assessmentContextStatus}</div>
                        </div>
                        <div className="mt-2 text-xs text-zinc-400">{snapshot.currentEmphasis || 'No emphasis captured.'}</div>
                        <div className="mt-1 text-xs text-zinc-500">{snapshot.nextMilestone || 'No next milestone captured.'}</div>
                        <div className="mt-1 text-xs text-zinc-500">{snapshot.trendSummary || ''}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckPilotDashboardAthletePage;
