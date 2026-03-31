import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Activity, AlertTriangle, ArrowLeft, Brain, Database, FileText, MonitorPlay, RefreshCcw, ShieldAlert, Users2 } from 'lucide-react';
import AdminRouteGuard from '../../../../../components/auth/AdminRouteGuard';
import NoraMetricHelpButton from '../../../../../components/admin/pilot-dashboard/NoraMetricHelpButton';
import { pulseCheckPilotDashboardService } from '../../../../../api/firebase/pulsecheckPilotDashboard/service';
import type {
  PilotDashboardAthleteDetail,
  PilotDashboardOperationalWatchListRestrictionFlags,
  PilotDashboardOperationalWatchListState,
} from '../../../../../api/firebase/pulsecheckPilotDashboard/types';

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
    case 'manual_hold':
      return 'Manual hold';
    case 'watch_list_hold':
      return 'Watch list hold';
    case 'escalation_hold':
      return 'Legacy escalation hold';
    case 'no_task_rest_day':
      return 'No-task rest day';
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return 'Excluded';
  }
};

type WatchListDraft = {
  reasonCode: string;
  reasonText: string;
  source: 'clinician' | 'staff' | 'system';
  reviewDueAt: string;
  restrictionFlags: PilotDashboardOperationalWatchListRestrictionFlags;
};

const buildWatchListDraft = (state?: PilotDashboardOperationalWatchListState | null): WatchListDraft => ({
  reasonCode: state?.reasonCode || 'clinical_review_pending',
  reasonText: state?.reasonText || '',
  source: state?.source || 'clinician',
  reviewDueAt: state?.reviewDueAt ? toInputDateValue(toDateValue(state.reviewDueAt)) : '',
  restrictionFlags: {
    suppressSurveys: state?.restrictionFlags?.suppressSurveys || false,
    suppressAssignments: state?.restrictionFlags?.suppressAssignments || false,
    suppressNudges: state?.restrictionFlags?.suppressNudges || false,
    excludeFromAdherence: state?.restrictionFlags?.excludeFromAdherence || false,
    manualHold: state?.restrictionFlags?.manualHold || false,
  },
});

const watchListStatusClassName = (state?: PilotDashboardOperationalWatchListState | null) => {
  if (state?.watchListActive) {
    return 'border-rose-400/25 bg-rose-400/10 text-rose-100';
  }
  if (state?.watchListRequested) {
    return 'border-amber-400/25 bg-amber-400/10 text-amber-100';
  }
  return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100';
};

const watchListStatusLabel = (state?: PilotDashboardOperationalWatchListState | null) => {
  if (state?.watchListActive) return 'Active watch list';
  if (state?.watchListRequested) return 'Review queued';
  return 'No active watch list';
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

const escalationRecordTitle = (escalation: PilotDashboardAthleteDetail['escalations'][number]) => {
  if (escalation.supportFlag) return 'Support record';
  if (escalation.coachReviewFlag) return 'Coach review record';
  if (escalation.openCareEscalation) return `Tier ${Math.max(escalation.tier, 2)} care escalation`;
  if (escalation.dispositionLabel === 'Care completed') return 'Care record';
  if (escalation.dispositionLabel === 'Resolved') return 'Resolved record';
  return 'Escalation record';
};

const escalationRecordMeta = (escalation: PilotDashboardAthleteDetail['escalations'][number]) => {
  const parts = [
    escalation.category,
    escalation.status,
    `created ${formatTimestamp(escalation.createdAt)}`,
  ];

  if (escalation.supportFlag || escalation.coachReviewFlag) {
    parts.unshift(`Historical tier ${escalation.tier}`);
  }

  return parts.join(' · ');
};

const escalationWorkflowSummary = (escalation: PilotDashboardAthleteDetail['escalations'][number]) => {
  if (escalation.supportFlag) return 'No care consent required · support-only record';
  if (escalation.coachReviewFlag) return 'No care consent required · coach review';
  if (escalation.openCareEscalation) {
    return `${escalation.consentStatus ? `Consent ${escalation.consentStatus}` : 'No consent state'} · ${escalation.handoffStatus || 'No handoff state'}`;
  }
  return 'No care handoff required';
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
  const [watchListDraft, setWatchListDraft] = useState<WatchListDraft>(buildWatchListDraft(null));
  const [savingWatchListAction, setSavingWatchListAction] = useState<'request' | 'apply' | 'clear' | null>(null);

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

  useEffect(() => {
    setWatchListDraft(buildWatchListDraft(detail?.operationalWatchList || null));
  }, [detail?.operationalWatchList]);

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

  const currentWatchList = detail?.operationalWatchList || null;
  const linkedOpenEscalations = useMemo(() => {
    if (!detail || !currentWatchList?.linkedIncidentIds?.length) return [];
    const linkedIncidentIdSet = new Set(currentWatchList.linkedIncidentIds);
    return detail.escalations.filter((escalation) => linkedIncidentIdSet.has(escalation.id));
  }, [currentWatchList, detail]);
  const reviewDueDate = currentWatchList?.reviewDueAt ? toDateValue(currentWatchList.reviewDueAt) : null;
  const isReviewDueOverdue = Boolean(currentWatchList?.watchListActive && reviewDueDate && reviewDueDate.getTime() < Date.now());

  const submitWatchListAction = async (action: 'request' | 'apply' | 'clear') => {
    if (!detail) return;
    setSavingWatchListAction(action);
    try {
      const reviewDueAt = watchListDraft.reviewDueAt ? new Date(`${watchListDraft.reviewDueAt}T12:00:00`) : null;
      const payload = {
        pilotId: detail.pilot.id,
        pilotEnrollmentId: detail.pilotEnrollment.id,
        athleteId: detail.pilotEnrollment.userId,
        reasonCode: watchListDraft.reasonCode,
        reasonText: watchListDraft.reasonText,
        source: watchListDraft.source,
        reviewDueAt: reviewDueAt ? reviewDueAt.getTime() : null,
        restrictionFlags: watchListDraft.restrictionFlags,
        linkedIncidentIds: detail.escalations.filter((escalation) => escalation.openCareEscalation).map((escalation) => escalation.id),
      };

      if (action === 'request') {
        await pulseCheckPilotDashboardService.requestPilotOperationalWatchList(payload);
      } else if (action === 'apply') {
        await pulseCheckPilotDashboardService.applyPilotOperationalWatchList(payload);
      } else {
        await pulseCheckPilotDashboardService.clearPilotOperationalWatchList(payload);
      }

      setDemoModeEnabled(pulseCheckPilotDashboardService.isDemoModeEnabled());
      await load('refresh');
      setError(null);
    } catch (watchListError: any) {
      setError(watchListError?.message || 'Failed to update operational watch list.');
    } finally {
      setSavingWatchListAction(null);
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
              <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-center gap-3 text-rose-300">
                    <ShieldAlert className="h-5 w-5" />
                    <span className="text-sm font-medium">Operational Watch List</span>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${watchListStatusClassName(currentWatchList)}`}>
                    {watchListStatusLabel(currentWatchList)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-zinc-400">
                  Escalations stay visible as care workflow records. Request queues a review only, apply activates restrictions, and clear removes them.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Current State</div>
                    <div className="mt-3 space-y-2 text-sm text-zinc-300">
                      <div>Base status: <span className="font-medium text-white">{currentWatchList?.status || 'normal'}</span></div>
                      <div>Lifecycle: <span className="font-medium text-white">{currentWatchList?.lifecycleStatus || 'none'}</span></div>
                      <div>Reason code: <span className="font-medium text-white">{currentWatchList?.reasonCode || 'other'}</span></div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Review due:</span>
                        <span className="font-medium text-white">{currentWatchList?.reviewDueAt ? formatShortDate(currentWatchList.reviewDueAt) : 'Not scheduled'}</span>
                        {isReviewDueOverdue ? (
                          <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-100">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                      <div>Linked incidents: <span className="font-medium text-white">{currentWatchList?.linkedIncidentIds?.length || 0}</span></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                      <span className={`rounded-full border px-2 py-1 ${currentWatchList?.restrictionFlags?.suppressSurveys ? 'border-rose-400/25 bg-rose-400/10 text-rose-100' : 'border-white/10 bg-white/5 text-zinc-300'}`}>
                        Surveys {currentWatchList?.restrictionFlags?.suppressSurveys ? 'suppressed' : 'open'}
                      </span>
                      <span className={`rounded-full border px-2 py-1 ${currentWatchList?.restrictionFlags?.suppressAssignments ? 'border-rose-400/25 bg-rose-400/10 text-rose-100' : 'border-white/10 bg-white/5 text-zinc-300'}`}>
                        Assignments {currentWatchList?.restrictionFlags?.suppressAssignments ? 'suppressed' : 'open'}
                      </span>
                      <span className={`rounded-full border px-2 py-1 ${currentWatchList?.restrictionFlags?.suppressNudges ? 'border-rose-400/25 bg-rose-400/10 text-rose-100' : 'border-white/10 bg-white/5 text-zinc-300'}`}>
                        Nudges {currentWatchList?.restrictionFlags?.suppressNudges ? 'suppressed' : 'open'}
                      </span>
                      <span className={`rounded-full border px-2 py-1 ${currentWatchList?.restrictionFlags?.excludeFromAdherence ? 'border-rose-400/25 bg-rose-400/10 text-rose-100' : 'border-white/10 bg-white/5 text-zinc-300'}`}>
                        Adherence {currentWatchList?.restrictionFlags?.excludeFromAdherence ? 'excluded' : 'included'}
                      </span>
                      <span className={`rounded-full border px-2 py-1 ${currentWatchList?.restrictionFlags?.manualHold ? 'border-rose-400/25 bg-rose-400/10 text-rose-100' : 'border-white/10 bg-white/5 text-zinc-300'}`}>
                        Manual hold {currentWatchList?.restrictionFlags?.manualHold ? 'on' : 'off'}
                      </span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Lifecycle audit</div>
                      <div className="mt-3 space-y-3 text-sm text-zinc-300">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Requested</div>
                          <div className="mt-1 font-medium text-white">
                            {currentWatchList?.requestedAt ? formatTimestamp(currentWatchList.requestedAt) : 'Not requested'}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {currentWatchList?.requestedByEmail || currentWatchList?.requestedByUserId || 'No requester recorded'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Applied</div>
                          <div className="mt-1 font-medium text-white">
                            {currentWatchList?.appliedAt ? formatTimestamp(currentWatchList.appliedAt) : 'Not applied'}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {currentWatchList?.appliedByEmail || currentWatchList?.appliedByUserId || 'No applier recorded'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Cleared</div>
                          <div className="mt-1 font-medium text-white">
                            {currentWatchList?.clearedAt ? formatTimestamp(currentWatchList.clearedAt) : 'Not cleared'}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {currentWatchList?.clearedByEmail || currentWatchList?.clearedByUserId || 'No clearer recorded'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Linked incidents</div>
                      <div className="mt-2 text-sm text-zinc-300">
                        {currentWatchList?.linkedIncidentIds?.length
                          ? `${currentWatchList.linkedIncidentIds.length} linked incident${currentWatchList.linkedIncidentIds.length === 1 ? '' : 's'} recorded.`
                          : 'No linked incidents have been recorded yet.'}
                      </div>
                          {linkedOpenEscalations.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                              {linkedOpenEscalations.slice(0, 3).map((escalation) => (
                                <span key={escalation.id} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">
                              {escalationRecordTitle(escalation)}
                                </span>
                              ))}
                          {linkedOpenEscalations.length > 3 ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">
                              +{linkedOpenEscalations.length - 3} more
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Watch-list request / apply draft</div>
                    <div className="mt-2 text-sm text-zinc-400">
                      Request records a review item only. Apply turns the selected restrictions on. Clear removes the active restriction state.
                    </div>
                    <div className="mt-3 space-y-3">
                      <label className="block text-sm text-zinc-300">
                        Reason code
                        <select
                          value={watchListDraft.reasonCode}
                          onChange={(event) => setWatchListDraft((current) => ({ ...current, reasonCode: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                        >
                          <option value="clinical_review_pending">Clinical review pending</option>
                          <option value="manual_safety_hold">Manual safety hold</option>
                          <option value="temporary_restriction">Temporary restriction</option>
                          <option value="care_team_requested_pause">Care team requested pause</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label className="block text-sm text-zinc-300">
                        Source
                        <select
                          value={watchListDraft.source}
                          onChange={(event) =>
                            setWatchListDraft((current) => ({
                              ...current,
                              source: event.target.value as WatchListDraft['source'],
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                        >
                          <option value="clinician">Clinician</option>
                          <option value="staff">Staff</option>
                          <option value="system">System</option>
                        </select>
                      </label>
                      <label className="block text-sm text-zinc-300">
                        Review due date
                        <input
                          type="date"
                          value={watchListDraft.reviewDueAt}
                          onChange={(event) => setWatchListDraft((current) => ({ ...current, reviewDueAt: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                        />
                        <div className="mt-1 text-xs text-zinc-500">Follow-up date only. It does not auto-clear or auto-suppress anything.</div>
                      </label>
                      <label className="block text-sm text-zinc-300">
                        Reason note
                        <textarea
                          value={watchListDraft.reasonText}
                          onChange={(event) => setWatchListDraft((current) => ({ ...current, reasonText: event.target.value }))}
                          rows={4}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
                          placeholder="Optional context for the review and restriction decision."
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ['suppressSurveys', 'Suppress surveys'],
                    ['suppressAssignments', 'Suppress assignments'],
                    ['suppressNudges', 'Suppress nudges'],
                    ['excludeFromAdherence', 'Exclude from adherence'],
                    ['manualHold', 'Manual hold'],
                  ].map(([key, label]) => (
                    <label key={key} className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(watchListDraft.restrictionFlags[key as keyof WatchListDraft['restrictionFlags']])}
                          onChange={(event) =>
                            setWatchListDraft((current) => ({
                              ...current,
                              restrictionFlags: {
                                ...current.restrictionFlags,
                                [key]: event.target.checked,
                              },
                            }))
                          }
                          className="h-4 w-4 rounded border-white/20 bg-[#0b0f17] text-cyan-400"
                        />
                        <span>{label}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void submitWatchListAction('request')}
                    disabled={savingWatchListAction !== null}
                    className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 transition hover:bg-amber-400/15 disabled:opacity-60"
                  >
                    {savingWatchListAction === 'request' ? 'Requesting...' : 'Request review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitWatchListAction('apply')}
                    disabled={savingWatchListAction !== null}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-400/15 disabled:opacity-60"
                  >
                    {savingWatchListAction === 'apply' ? 'Applying...' : 'Apply restrictions'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitWatchListAction('clear')}
                    disabled={savingWatchListAction !== null}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-60"
                  >
                    {savingWatchListAction === 'clear' ? 'Clearing...' : 'Clear restrictions'}
                  </button>
                </div>
              </div>

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
                  <span className="text-sm font-medium">Current Incident Detail</span>
                </div>
                <p className="mt-3 text-sm text-zinc-400">
                  These are the current normalized incident records for this athlete inside the selected pilot outcome frame.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Current Incidents</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{groupedIncidents.length}</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Open Care Incidents</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{groupedIncidents.filter((incident) => incident[0]?.openCareEscalation).length}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {groupedIncidents.length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-400">
                      No current incident records are attached to this athlete in the pilot outcome frame.
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
                                Latest update created {formatTimestamp(lead.createdAt)}
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

                          <div className="mt-4 rounded-2xl border border-white/5 bg-[#0b0f17] p-4">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-white">
                                  <span className="font-medium">{escalationRecordTitle(lead)}</span>
                                  <span className={`rounded-full border px-2 py-1 text-[11px] ${escalationDispositionClassName(lead.dispositionLabel)}`}>
                                    {lead.dispositionLabel}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-zinc-400">
                                  {escalationRecordMeta(lead)}
                                </div>
                              </div>
                              <div className="text-xs text-zinc-400">
                                {escalationWorkflowSummary(lead)}
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Coach Notified</div>
                                <div className="mt-2">{formatTimestamp(lead.coachNotifiedAt)}</div>
                              </div>
                              <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Handoff Initiated</div>
                                <div className="mt-2">{formatTimestamp(lead.handoffInitiatedAt)}</div>
                              </div>
                              <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Clinician Response</div>
                                <div className="mt-2">{formatTimestamp(lead.firstClinicianResponseAt)}</div>
                              </div>
                              <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Resolved</div>
                                <div className="mt-2">{formatTimestamp(lead.resolvedAt || lead.handoffCompletedAt)}</div>
                              </div>
                            </div>
                            {lead.classificationReason || lead.triggerContent ? (
                              <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                                {lead.classificationReason ? (
                                  <div><span className="text-zinc-500">Current classification:</span> {lead.classificationReason}</div>
                                ) : null}
                                {lead.triggerContent ? (
                                  <div className="mt-2"><span className="text-zinc-500">Latest trigger:</span> {lead.triggerContent}</div>
                                ) : null}
                              </div>
                            ) : null}
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
