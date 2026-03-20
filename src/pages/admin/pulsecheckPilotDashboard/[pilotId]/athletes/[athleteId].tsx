import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Activity, ArrowLeft, Brain, Database, FileText, RefreshCcw, Users2 } from 'lucide-react';
import AdminRouteGuard from '../../../../../components/auth/AdminRouteGuard';
import { pulseCheckPilotDashboardService } from '../../../../../api/firebase/pulsecheckPilotDashboard/service';
import type { PilotDashboardAthleteDetail } from '../../../../../api/firebase/pulsecheckPilotDashboard/types';

const formatTimestamp = (value: any) => {
  if (!value) return 'Not recorded';
  if (typeof value === 'number') return new Date(value).toLocaleString();
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString();
  return 'Not recorded';
};

const formatShortDate = (value: any) => {
  if (!value) return 'Not recorded';
  if (typeof value === 'number') return new Date(value).toLocaleDateString();
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleDateString();
  return 'Not recorded';
};

const PulseCheckPilotDashboardAthletePage: React.FC = () => {
  const router = useRouter();
  const pilotId = typeof router.query.pilotId === 'string' ? router.query.pilotId : '';
  const athleteId = typeof router.query.athleteId === 'string' ? router.query.athleteId : '';
  const [detail, setDetail] = useState<PilotDashboardAthleteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!pilotId || !athleteId) return;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
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
            <button
              onClick={() => void load('refresh')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

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
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <div className="flex items-center gap-3 text-cyan-300">
                    <Users2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Cohort</span>
                  </div>
                  <div className="mt-3 text-lg font-semibold">{detail.cohort?.name || 'No cohort'}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <div className="flex items-center gap-3 text-emerald-300">
                    <Database className="h-5 w-5" />
                    <span className="text-sm font-medium">Evidence Records</span>
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{detail.engineSummary.evidenceRecordCount}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <div className="flex items-center gap-3 text-amber-300">
                    <Brain className="h-5 w-5" />
                    <span className="text-sm font-medium">Stable Patterns</span>
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{detail.engineSummary.stablePatternCount}</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <div className="flex items-center gap-3 text-violet-300">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm font-medium">Profile Snapshots</span>
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{detail.profileSnapshotCount}</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pilot Enrollment</div>
                  <div className="mt-3 space-y-3 text-sm text-zinc-300">
                    <div>Email: {detail.email || 'No email on team membership'}</div>
                    <div>Enrollment status: {detail.pilotEnrollment.status}</div>
                    <div>Study mode: {detail.pilotEnrollment.studyMode}</div>
                    <div>Enrollment mode: {detail.pilotEnrollment.enrollmentMode}</div>
                    <div>Product consent: {detail.pilotEnrollment.productConsentAccepted ? 'Accepted' : 'Pending'}</div>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
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

              <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-5">
                <div className="flex items-center gap-3 text-cyan-300">
                  <Activity className="h-5 w-5" />
                  <span className="text-sm font-medium">Milestone Context</span>
                </div>
                <div className="mt-4 text-sm text-zinc-300">
                  Latest assessment context flag: <span className="font-medium text-white">{detail.latestAssessmentContextFlagStatus}</span>
                </div>
                <div className="mt-2 text-sm text-zinc-400">Latest captured at: {formatTimestamp(detail.latestAssessmentCapturedAt)}</div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
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

                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
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

                <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
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

              <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-5">
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
