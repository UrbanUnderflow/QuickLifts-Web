import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { collection, doc, getDocs, limit, query, updateDoc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileBarChart2, Filter, RefreshCcw, ShieldAlert } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { auth, db } from '../../api/firebase/config';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckOrganization,
  PulseCheckPilot,
  PulseCheckPilotCohort,
  PulseCheckTeam,
} from '../../api/firebase/pulsecheckProvisioning/types';
import type { VisionProTrialSession } from '../../api/firebase/mentaltraining/visionProTrialService';

const downloadCsv = (rows: VisionProTrialSession[]) => {
  const headers = [
    'sessionId',
    'athleteDisplayName',
    'athleteEmail',
    'organizationId',
    'teamId',
    'pilotId',
    'cohortId',
    'simName',
    'status',
    'sessionOutcome',
    'transferReadiness',
    'immersiveBaselineMode',
    'completedAt',
    'coachHeadline',
    'coachBody',
    'operatorReconciliationStatus',
    'operatorReviewedAt',
    'operatorReviewedByName',
    'operatorNote',
  ];

  const csvRows = rows.map((row) => [
    row.id,
    row.athleteDisplayName || '',
    row.athleteEmail || '',
    row.organizationId || '',
    row.teamId || '',
    row.pilotId || '',
    row.cohortId || '',
    row.simName || '',
    row.status || '',
    row.sessionOutcome || '',
    row.reportSummary?.transferReadiness || '',
    row.reportSummary?.immersiveBaselineMode || '',
    row.completedAt || row.createdAt || '',
    row.reportSummary?.coachHeadline || '',
    row.reportSummary?.coachBody || '',
    row.operatorReconciliation?.status || '',
    row.operatorReconciliation?.reviewedAt || '',
    row.operatorReconciliation?.reviewedByName || '',
    row.operatorReconciliation?.note || '',
  ]);

  const content = [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `pulsecheck-vision-pro-reporting-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const formatDateTime = (value?: number | null) => {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString();
};

const buildReconciliationChecklist = (session: VisionProTrialSession) => {
  const versionTrailVerified = Boolean(
    session.versionMetadata?.environmentVersion &&
    session.versionMetadata?.trialPackageVersion &&
    session.versionMetadata?.resetTrialVersion &&
    session.versionMetadata?.signalWindowTrialVersion &&
    session.versionMetadata?.eventScriptVersion &&
    session.versionMetadata?.metricMappingVersion
  );
  const calibrationVerified = Boolean(
    session.calibrationSummary?.status &&
    session.calibrationSummary?.checkedAt &&
    typeof session.calibrationSummary?.comfortCleared === 'boolean'
  );
  const requiredFamilies = session.protocolContext?.requiredFamilies?.length
    ? session.protocolContext.requiredFamilies
    : session.simId === 'vision_pro_football_package'
      ? ['reset', 'signal-window']
      : [session.simId];
  const baselineLinkageVerified = requiredFamilies.every((family) =>
    (session.baselineReferences || []).some((reference) =>
      reference.family === family && Boolean(reference.referenceId || reference.simSessionId || reference.assignmentId)
    )
  );
  const validityVerified = Boolean(
    session.sessionOutcome &&
    session.validitySummary?.status &&
    (session.validitySummary?.eventLogComplete === true || session.eventLog?.eventCount)
  );
  const eventLogVerified = Boolean(
    session.eventLog?.rawEventLogUri &&
    session.eventLog?.schemaVersion &&
    (session.eventLog?.eventCount || 0) > 0
  );
  const incidentDispositionVerified = session.sessionOutcome === 'aborted' || session.status === 'abandoned'
    ? Boolean(session.validitySummary?.abortClassification || session.abandonReason)
    : true;

  return {
    versionTrailVerified,
    calibrationVerified,
    baselineLinkageVerified,
    validityVerified,
    eventLogVerified,
    incidentDispositionVerified,
  };
};

const getChecklistIssues = (session: VisionProTrialSession) => {
  const checklist = buildReconciliationChecklist(session);
  const issues: string[] = [];
  if (!checklist.versionTrailVerified) issues.push('Version trail is incomplete.');
  if (!checklist.calibrationVerified) issues.push('Calibration record is incomplete.');
  if (!checklist.baselineLinkageVerified) issues.push('Baseline linkage is incomplete for one or more required families.');
  if (!checklist.validityVerified) issues.push('Validity state or completion evidence is incomplete.');
  if (!checklist.eventLogVerified) issues.push('Event log reference is missing or empty.');
  if (!checklist.incidentDispositionVerified) issues.push('Abort or incident disposition still needs a reason code.');
  return issues;
};

const getReconciliationStatus = (session: VisionProTrialSession) => {
  if (session.operatorReconciliation?.status) {
    return session.operatorReconciliation.status;
  }
  return getChecklistIssues(session).length ? 'pending' : 'reviewed';
};

const RECONCILIATION_STATUS_STYLES: Record<string, string> = {
  reviewed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  needs_follow_up: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
};

const PulseCheckVisionProReportingPage: React.FC = () => {
  const [sessions, setSessions] = useState<VisionProTrialSession[]>([]);
  const [organizations, setOrganizations] = useState<PulseCheckOrganization[]>([]);
  const [teams, setTeams] = useState<PulseCheckTeam[]>([]);
  const [pilots, setPilots] = useState<PulseCheckPilot[]>([]);
  const [cohorts, setCohorts] = useState<PulseCheckPilotCohort[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [pilotId, setPilotId] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const load = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      const [sessionSnap, nextOrganizations, nextTeams, nextPilots, nextCohorts] = await Promise.all([
        getDocs(query(collection(db, 'vision-pro-trial-sessions'), limit(250))),
        pulseCheckProvisioningService.listOrganizations(),
        pulseCheckProvisioningService.listTeams(),
        pulseCheckProvisioningService.listPilots(),
        pulseCheckProvisioningService.listPilotCohorts(),
      ]);

      setSessions(
        sessionSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as VisionProTrialSession))
          .sort((left, right) => (right.completedAt || right.createdAt || 0) - (left.completedAt || left.createdAt || 0))
      );
      setOrganizations(nextOrganizations);
      setTeams(nextTeams);
      setPilots(nextPilots);
      setCohorts(nextCohorts);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load Vision Pro reporting.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredSessions = useMemo(() => (
    sessions.filter((session) => {
      if (organizationId && session.organizationId !== organizationId) return false;
      if (teamId && session.teamId !== teamId) return false;
      if (pilotId && session.pilotId !== pilotId) return false;
      if (cohortId && session.cohortId !== cohortId) return false;
      return true;
    })
  ), [sessions, organizationId, teamId, pilotId, cohortId]);

  const summary = useMemo(() => {
    const completed = filteredSessions.filter((session) => session.status === 'completed');
    const valid = completed.filter((session) => session.sessionOutcome === 'valid').length;
    const strongTransfer = completed.filter((session) => session.reportSummary?.transferReadiness === 'strong_transfer').length;
    const needsTransferWork = completed.filter((session) => session.reportSummary?.transferReadiness === 'needs_transfer_work').length;
    const reviewed = filteredSessions.filter((session) => getReconciliationStatus(session) === 'reviewed').length;
    const needsReview = filteredSessions.filter((session) => getReconciliationStatus(session) === 'pending').length;
    const needsFollowUp = filteredSessions.filter((session) => getReconciliationStatus(session) === 'needs_follow_up').length;
    return {
      total: filteredSessions.length,
      completed: completed.length,
      valid,
      strongTransfer,
      needsTransferWork,
      reviewed,
      needsReview,
      needsFollowUp,
    };
  }, [filteredSessions]);

  const reconciliationQueue = useMemo(() => (
    filteredSessions
      .map((session) => ({ session, issues: getChecklistIssues(session) }))
      .filter(({ session, issues }) => getReconciliationStatus(session) !== 'reviewed' || issues.length)
      .slice(0, 8)
  ), [filteredSessions]);

  const handleSaveReconciliation = async (
    session: VisionProTrialSession,
    status: 'reviewed' | 'needs_follow_up' | 'pending'
  ) => {
    setSavingSessionId(session.id);
    try {
      const user = auth.currentUser;
      const note = (draftNotes[session.id] ?? session.operatorReconciliation?.note ?? '').trim();
      const checklist = buildReconciliationChecklist(session);
      const payload = {
        operatorReconciliation: {
          status,
          reviewedAt: Date.now(),
          reviewedByUserId: user?.uid || null,
          reviewedByName: user?.displayName || user?.email || 'PulseCheck Admin',
          note: note || null,
          checklist,
        },
        updatedAt: Date.now(),
      };

      await updateDoc(doc(db, 'vision-pro-trial-sessions', session.id), payload);
      setSessions((current) => current.map((entry) => (
        entry.id === session.id
          ? {
              ...entry,
              ...payload,
            }
          : entry
      )));
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to save operator reconciliation.');
    } finally {
      setSavingSessionId(null);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Vision Pro Reporting</title>
      </Head>

      <div className="min-h-screen bg-[#09090b] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/30">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">PulseCheck Vision Pro</p>
                <h1 className="mt-3 text-3xl font-semibold">Coach and research reporting</h1>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  This surface turns the new Vision Pro session summary contract into something operators can actually use:
                  recent session review for coaches, and filtered export for pilot and research workflows.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void load('refresh')}
                  disabled={refreshing || loading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => downloadCsv(filteredSessions)}
                  disabled={filteredSessions.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="rounded-2xl border border-white/10 bg-[#11151f] px-4 py-3 text-sm text-white">
              <option value="">All organizations</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.displayName}</option>
              ))}
            </select>
            <select value={teamId} onChange={(event) => setTeamId(event.target.value)} className="rounded-2xl border border-white/10 bg-[#11151f] px-4 py-3 text-sm text-white">
              <option value="">All teams</option>
              {teams.filter((team) => !organizationId || team.organizationId === organizationId).map((team) => (
                <option key={team.id} value={team.id}>{team.displayName}</option>
              ))}
            </select>
            <select value={pilotId} onChange={(event) => setPilotId(event.target.value)} className="rounded-2xl border border-white/10 bg-[#11151f] px-4 py-3 text-sm text-white">
              <option value="">All pilots</option>
              {pilots.filter((pilot) => !teamId || pilot.teamId === teamId).map((pilot) => (
                <option key={pilot.id} value={pilot.id}>{pilot.name}</option>
              ))}
            </select>
            <select value={cohortId} onChange={(event) => setCohortId(event.target.value)} className="rounded-2xl border border-white/10 bg-[#11151f] px-4 py-3 text-sm text-white">
              <option value="">All cohorts</option>
              {cohorts.filter((cohort) => !pilotId || cohort.pilotId === pilotId).map((cohort) => (
                <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
              ))}
            </select>
            <div className="rounded-2xl border border-white/10 bg-[#11151f] px-4 py-3 text-sm text-zinc-300 flex items-center gap-2">
              <Filter className="h-4 w-4 text-cyan-300" />
              {filteredSessions.length} visible sessions
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/8 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-200">Sessions</div>
              <div className="mt-3 text-4xl font-semibold">{summary.total}</div>
            </div>
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/8 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-emerald-200">Completed</div>
              <div className="mt-3 text-4xl font-semibold">{summary.completed}</div>
            </div>
            <div className="rounded-3xl border border-green-500/20 bg-green-500/8 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-green-200">Valid</div>
              <div className="mt-3 text-4xl font-semibold">{summary.valid}</div>
            </div>
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/8 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-amber-200">Strong Transfer</div>
              <div className="mt-3 text-4xl font-semibold">{summary.strongTransfer}</div>
            </div>
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/8 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-rose-200">Needs Transfer Work</div>
              <div className="mt-3 text-4xl font-semibold">{summary.needsTransferWork}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/8 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-amber-200">Needs Reconciliation</div>
              <div className="mt-3 text-4xl font-semibold">{summary.needsReview}</div>
            </div>
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/8 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-emerald-200">Reviewed</div>
              <div className="mt-3 text-4xl font-semibold">{summary.reviewed}</div>
            </div>
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/8 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-rose-200">Needs Follow-Up</div>
              <div className="mt-3 text-4xl font-semibold">{summary.needsFollowUp}</div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-5 py-4 text-sm text-rose-100">{error}</div>
          ) : null}

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-cyan-300" />
              <div>
                <h2 className="text-xl font-semibold">Operator reconciliation queue</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Use this queue to confirm version trail, calibration, baseline linkage, event logging, and any abort or incident disposition before a session is treated as operationally clean.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-zinc-400">Loading reconciliation queue…</div>
            ) : reconciliationQueue.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-5 py-4 text-sm text-emerald-100">
                Every visible session is already reconciled or has a complete metadata trail.
              </div>
            ) : (
              <div className="space-y-3">
                {reconciliationQueue.map(({ session, issues }) => (
                  <div key={`queue-${session.id}`} className="rounded-2xl border border-white/10 bg-[#0b1020] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-base font-semibold text-white">{session.athleteDisplayName || session.athleteUserId}</div>
                        <div className="mt-1 text-sm text-zinc-400">{session.simName} • {session.id}</div>
                      </div>
                      <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${RECONCILIATION_STATUS_STYLES[getReconciliationStatus(session)] || RECONCILIATION_STATUS_STYLES.pending}`}>
                        {getReconciliationStatus(session).replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {issues.map((issue) => (
                        <div key={`${session.id}-${issue}`} className="flex items-start gap-2 text-sm text-amber-100">
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 flex items-center gap-3">
              <FileBarChart2 className="h-5 w-5 text-cyan-300" />
              <h2 className="text-xl font-semibold">Session table</h2>
            </div>

            {loading ? (
              <div className="py-12 text-center text-zinc-400">Loading Vision Pro reporting…</div>
            ) : filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-zinc-400">No Vision Pro sessions match these filters yet.</div>
            ) : (
              <div className="space-y-4">
                {filteredSessions.map((session) => {
                  const teamName = teams.find((team) => team.id === session.teamId)?.displayName || session.teamName || 'No team linked';
                  const pilotName = pilots.find((pilot) => pilot.id === session.pilotId)?.name || session.pilotName || 'No pilot linked';
                  const cohortName = cohorts.find((cohort) => cohort.id === session.cohortId)?.name || session.cohortName || 'No cohort linked';
                  const checklist = buildReconciliationChecklist(session);
                  const issues = getChecklistIssues(session);
                  const reconciliationStatus = getReconciliationStatus(session);
                  const reviewNote = draftNotes[session.id] ?? session.operatorReconciliation?.note ?? '';
                  const checklistRows = [
                    ['Version trail', checklist.versionTrailVerified],
                    ['Calibration record', checklist.calibrationVerified],
                    ['Baseline linkage', checklist.baselineLinkageVerified],
                    ['Validity state', checklist.validityVerified],
                    ['Event log reference', checklist.eventLogVerified],
                    ['Incident disposition', checklist.incidentDispositionVerified],
                  ] as const;
                  return (
                    <div key={session.id} className="rounded-2xl border border-white/10 bg-[#0b1020] p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-lg font-semibold text-white">{session.athleteDisplayName || session.athleteUserId}</div>
                          <div className="text-sm text-zinc-400">{session.simName}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm text-zinc-300">
                            {session.reportSummary?.coachHeadline || 'Awaiting scored summary'}
                          </div>
                          <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${RECONCILIATION_STATUS_STYLES[reconciliationStatus] || RECONCILIATION_STATUS_STYLES.pending}`}>
                            {reconciliationStatus.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-5 text-sm">
                        <div><div className="text-zinc-500 uppercase tracking-[0.2em] text-[11px]">Team</div><div className="mt-1 text-white">{teamName}</div></div>
                        <div><div className="text-zinc-500 uppercase tracking-[0.2em] text-[11px]">Pilot</div><div className="mt-1 text-white">{pilotName}</div></div>
                        <div><div className="text-zinc-500 uppercase tracking-[0.2em] text-[11px]">Cohort</div><div className="mt-1 text-white">{cohortName}</div></div>
                        <div><div className="text-zinc-500 uppercase tracking-[0.2em] text-[11px]">Transfer</div><div className="mt-1 text-white">{session.reportSummary?.transferReadiness || 'n/a'}</div></div>
                        <div><div className="text-zinc-500 uppercase tracking-[0.2em] text-[11px]">Outcome</div><div className="mt-1 text-white">{session.sessionOutcome || session.status}</div></div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
                        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-cyan-300" />
                            <div className="text-sm font-semibold text-white">Operator closeout checklist</div>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {checklistRows.map(([label, passed]) => (
                              <div key={`${session.id}-${label}`} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-sm">
                                {passed ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                ) : (
                                  <ShieldAlert className="h-4 w-4 text-amber-300" />
                                )}
                                <span className={passed ? 'text-zinc-100' : 'text-amber-100'}>{label}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2 text-xs text-zinc-400">
                            <div>Calibration checked: <span className="text-zinc-200">{formatDateTime(session.calibrationSummary?.checkedAt)}</span></div>
                            <div>Event log captured: <span className="text-zinc-200">{formatDateTime(session.eventLog?.capturedAt)}</span></div>
                            <div>Completed at: <span className="text-zinc-200">{formatDateTime(session.completedAt)}</span></div>
                            <div>Reviewed at: <span className="text-zinc-200">{formatDateTime(session.operatorReconciliation?.reviewedAt)}</span></div>
                          </div>
                          {issues.length ? (
                            <div className="mt-4 space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4">
                              {issues.map((issue) => (
                                <div key={`${session.id}-issue-${issue}`} className="flex items-start gap-2 text-sm text-amber-100">
                                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                                  <span>{issue}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                          <div className="text-sm font-semibold text-white">Operator review</div>
                          <div className="mt-2 text-xs text-zinc-400">
                            Use this to confirm the session record is clean after the athlete leaves the headset and the room team has verified any aborts, pauses, or operator notes.
                          </div>
                          <textarea
                            value={reviewNote}
                            onChange={(event) => setDraftNotes((current) => ({ ...current, [session.id]: event.target.value }))}
                            placeholder="Add a closeout note, incident summary, or follow-up instruction."
                            className="mt-4 min-h-[116px] w-full rounded-2xl border border-white/10 bg-[#11151f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50"
                          />
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={savingSessionId === session.id}
                              onClick={() => void handleSaveReconciliation(session, 'reviewed')}
                              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Mark Reviewed
                            </button>
                            <button
                              type="button"
                              disabled={savingSessionId === session.id}
                              onClick={() => void handleSaveReconciliation(session, 'needs_follow_up')}
                              className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Flag Follow-Up
                            </button>
                            <button
                              type="button"
                              disabled={savingSessionId === session.id}
                              onClick={() => void handleSaveReconciliation(session, 'pending')}
                              className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Keep Pending
                            </button>
                          </div>
                          {session.operatorReconciliation?.reviewedByName ? (
                            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-zinc-400">
                              Last action by <span className="text-zinc-100">{session.operatorReconciliation.reviewedByName}</span> on <span className="text-zinc-100">{formatDateTime(session.operatorReconciliation.reviewedAt)}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {session.reportSummary?.familyCards?.length ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {session.reportSummary.familyCards.map((card, index) => (
                            <div key={`${session.id}-${card.family || index}`} className="rounded-xl border border-white/8 bg-black/20 p-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{card.label || card.family || 'Family'}</div>
                              <div className="mt-2 text-sm font-semibold text-white">{card.trialName || 'Trial'}</div>
                              <div className="mt-1 text-xs text-zinc-400">{card.metricName || 'Core metric'}</div>
                              <div className="mt-3 text-xs text-zinc-400">
                                Baseline {typeof card.baselineValue === 'number' ? card.baselineValue.toFixed(2) : 'n/a'} • Current {typeof card.currentValue === 'number' ? card.currentValue.toFixed(2) : 'n/a'} • Gap {typeof card.transferGap === 'number' ? card.transferGap.toFixed(2) : 'n/a'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckVisionProReportingPage;
