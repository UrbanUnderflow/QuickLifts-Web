import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { Activity, ArrowRight, Building2, FlaskConical, Layers3, MonitorPlay, RefreshCcw, ShieldAlert, Users2 } from 'lucide-react';
import AdminRouteGuard from '../../../components/auth/AdminRouteGuard';
import { LocalFirebaseModeButton } from '../../../components/admin/pilot-dashboard/LocalFirebaseModeButton';
import NoraMetricHelpButton from '../../../components/admin/pilot-dashboard/NoraMetricHelpButton';
import type { PilotDashboardMetricExplanationKey } from '../../../components/admin/pilot-dashboard/noraMetricCatalog';
import { pulseCheckPilotDashboardService } from '../../../api/firebase/pulsecheckPilotDashboard/service';
import type { PilotDashboardDirectoryEntry } from '../../../api/firebase/pulsecheckPilotDashboard/types';

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatAverage = (value: number) => value.toFixed(1);

const PulseCheckPilotDashboardIndexPage: React.FC = () => {
  const [entries, setEntries] = useState<PilotDashboardDirectoryEntry[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const loadRequestIdRef = useRef(0);

  const load = async (mode: 'initial' | 'refresh' = 'initial') => {
    const requestId = ++loadRequestIdRef.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      setDemoModeEnabled(pulseCheckPilotDashboardService.isDemoModeEnabled());
      const nextEntries = await pulseCheckPilotDashboardService.listActivePilotDirectory();
      if (requestId !== loadRequestIdRef.current) return;
      setEntries(nextEntries);
    } catch (loadError: any) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(loadError?.message || 'Failed to load active pilots.');
    } finally {
      if (requestId !== loadRequestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleDemoMode = () => {
    const nextValue = !pulseCheckPilotDashboardService.isDemoModeEnabled();
    pulseCheckPilotDashboardService.setDemoModeEnabled(nextValue);
    if (nextValue) {
      pulseCheckPilotDashboardService.resetDemoModeData();
    }
    setOrganizationId('');
    setTeamId('');
    void load('refresh');
  };

  const resetDemoModeData = () => {
    pulseCheckPilotDashboardService.resetDemoModeData();
    void load('refresh');
  };

  const organizations = useMemo(
    () =>
      Array.from(new Map(entries.map((entry) => [entry.organization.id, entry.organization])).values()).sort((left, right) =>
        left.displayName.localeCompare(right.displayName)
      ),
    [entries]
  );

  const teams = useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((entry) => !organizationId || entry.organization.id === organizationId)
            .map((entry) => [entry.team.id, entry.team])
        ).values()
      ).sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [entries, organizationId]
  );

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (organizationId && entry.organization.id !== organizationId) return false;
        if (teamId && entry.team.id !== teamId) return false;
        return true;
      }),
    [entries, organizationId, teamId]
  );

  const summary = useMemo(
    () => ({
      activePilots: filteredEntries.length,
      activeAthletes: filteredEntries.reduce((sum, entry) => sum + entry.activeEnrollmentCount, 0),
      unsupportedHypotheses: filteredEntries.reduce((sum, entry) => sum + entry.unsupportedHypothesisCount, 0),
      promisingHypotheses: filteredEntries.reduce((sum, entry) => sum + entry.promisingHypothesisCount, 0),
      highConfidenceHypotheses: filteredEntries.reduce((sum, entry) => sum + entry.highConfidenceHypothesisCount, 0),
      avgEngineCoverageRate:
        filteredEntries.length > 0
          ? filteredEntries.reduce((sum, entry) => sum + entry.engineCoverageRate, 0) / filteredEntries.length
          : 0,
      avgStablePatternRate:
        filteredEntries.length > 0
          ? filteredEntries.reduce((sum, entry) => sum + entry.stablePatternRate, 0) / filteredEntries.length
          : 0,
      avgEvidenceRecordsPerAthlete:
        filteredEntries.length > 0
          ? filteredEntries.reduce((sum, entry) => sum + entry.avgEvidenceRecordsPerActiveAthlete, 0) / filteredEntries.length
          : 0,
      avgProjectionsPerAthlete:
        filteredEntries.length > 0
          ? filteredEntries.reduce((sum, entry) => sum + entry.avgRecommendationProjectionsPerActiveAthlete, 0) /
            filteredEntries.length
          : 0,
    }),
    [filteredEntries]
  );

  const operationalWatchListSummary = useMemo(
    () =>
      filteredEntries.reduce(
        (accumulator, entry) => {
          const watchListSummary = entry.operationalWatchListSummary;
          if (!watchListSummary) return accumulator;
          accumulator.pilotsWithWatchList += watchListSummary.stateCount > 0 ? 1 : 0;
          accumulator.stateCount += watchListSummary.stateCount;
          accumulator.requestedCount += watchListSummary.requestedCount;
          accumulator.activeCount += watchListSummary.activeCount;
          accumulator.suppressSurveysCount += watchListSummary.suppressSurveysCount;
          accumulator.suppressAssignmentsCount += watchListSummary.suppressAssignmentsCount;
          accumulator.suppressNudgesCount += watchListSummary.suppressNudgesCount;
          accumulator.excludeFromAdherenceCount += watchListSummary.excludeFromAdherenceCount;
          accumulator.manualHoldCount += watchListSummary.manualHoldCount;
          return accumulator;
        },
        {
          pilotsWithWatchList: 0,
          stateCount: 0,
          requestedCount: 0,
          activeCount: 0,
          suppressSurveysCount: 0,
          suppressAssignmentsCount: 0,
          suppressNudgesCount: 0,
          excludeFromAdherenceCount: 0,
          manualHoldCount: 0,
        }
      ),
    [filteredEntries]
  );

  const primarySummaryCards: Array<{
    label: string;
    value: string;
    icon: React.ReactNode;
    iconClassName: string;
    metricKey: PilotDashboardMetricExplanationKey;
    testId?: string;
  }> = [
    {
      label: 'Active Pilots',
      value: String(summary.activePilots),
      icon: <FlaskConical className="h-5 w-5" />,
      iconClassName: 'text-cyan-300',
      metricKey: 'active-pilots',
    },
    {
      label: 'Active Pilot Athletes',
      value: String(summary.activeAthletes),
      icon: <Users2 className="h-5 w-5" />,
      iconClassName: 'text-emerald-300',
      metricKey: 'active-pilot-athletes',
    },
    {
      label: 'Unsupported Hypotheses',
      value: String(summary.unsupportedHypotheses),
      icon: <Activity className="h-5 w-5" />,
      iconClassName: 'text-amber-300',
      metricKey: 'unsupported-hypotheses',
    },
    {
      label: 'Coverage',
      value: formatPercent(summary.avgEngineCoverageRate),
      icon: <Layers3 className="h-5 w-5" />,
      iconClassName: 'text-cyan-200',
      metricKey: 'coverage',
    },
    {
      label: 'Stable Rate',
      value: formatPercent(summary.avgStablePatternRate),
      icon: <Users2 className="h-5 w-5" />,
      iconClassName: 'text-emerald-200',
      metricKey: 'stable-rate',
      testId: 'pilot-dashboard-metric-help-stable-rate',
    },
    {
      label: 'Avg Evidence',
      value: formatAverage(summary.avgEvidenceRecordsPerAthlete),
      icon: <Building2 className="h-5 w-5" />,
      iconClassName: 'text-violet-200',
      metricKey: 'avg-evidence',
    },
  ];

  const secondarySummaryCards: Array<{ label: string; value: string; metricKey: PilotDashboardMetricExplanationKey }> = [
    { label: 'Promising Hypotheses', value: String(summary.promisingHypotheses), metricKey: 'promising-hypotheses' },
    { label: 'High Confidence Hypotheses', value: String(summary.highConfidenceHypotheses), metricKey: 'high-confidence-hypotheses' },
    { label: 'Avg Projections / Athlete', value: formatAverage(summary.avgProjectionsPerAthlete), metricKey: 'avg-projections-per-athlete' },
  ];

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Pilot Dashboard</title>
      </Head>
      <div className="min-h-screen bg-[#0b0f17] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">PulseCheck Admin</p>
              <h1 className="text-3xl font-semibold">Active Pilot Dashboard</h1>
              <p className="max-w-3xl text-sm text-zinc-400">
                Pilot-native directory for active PulseCheck pilots. Open a pilot to review pilot-scoped athletes,
                engine health, findings, and manual hypothesis tracking inside the active enrollment boundary.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LocalFirebaseModeButton />
              {demoModeEnabled ? (
                <button
                  onClick={resetDemoModeData}
                  data-testid="pilot-dashboard-demo-reset"
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 transition hover:bg-amber-400/15"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset Demo Data
                </button>
              ) : null}
              <button
                onClick={toggleDemoMode}
                data-testid="pilot-dashboard-demo-toggle"
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
            <div data-testid="pilot-dashboard-demo-banner" className="mt-6 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Demo mode is on. This dashboard is using mock pilots, mock athletes, mock hypotheses, and mock AI research briefs stored locally in your browser so you can demo and QA safely.
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {primarySummaryCards.map((card) => (
              <div key={card.label} className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className={`flex min-w-0 flex-1 items-center gap-3 pr-2 ${card.iconClassName}`}>
                    {card.icon}
                    <span className="text-sm font-medium leading-tight">{card.label}</span>
                  </div>
                  <NoraMetricHelpButton metricKey={card.metricKey} className="shrink-0" testId={card.testId} />
                </div>
                <div className="mt-3 text-3xl font-semibold">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            {secondarySummaryCards.map((card) => (
              <div key={card.label} className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2 text-xs uppercase tracking-[0.18em] leading-tight text-zinc-500">{card.label}</div>
                  <NoraMetricHelpButton metricKey={card.metricKey} className="shrink-0" />
                </div>
                <div className="mt-3 text-3xl font-semibold">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-[#11151f] p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-center gap-3 text-rose-300">
                <ShieldAlert className="h-5 w-5" />
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Operational Watch List</div>
                  <div className="text-lg font-semibold text-white">Directory-level restriction summary</div>
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">
                Escalations remain separate from operational restriction state. Requests are review-only until applied.
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pilots with watch list</div>
                <div className="mt-2 text-3xl font-semibold text-white">{operationalWatchListSummary.pilotsWithWatchList}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Active states</div>
                <div className="mt-2 text-3xl font-semibold text-white">{operationalWatchListSummary.activeCount}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Review queued states</div>
                <div className="mt-2 text-3xl font-semibold text-white">{operationalWatchListSummary.requestedCount}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Survey suppressions</div>
                <div className="mt-2 text-3xl font-semibold text-white">{operationalWatchListSummary.suppressSurveysCount}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Assignment suppressions</div>
                <div className="mt-2 text-3xl font-semibold text-white">{operationalWatchListSummary.suppressAssignmentsCount}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Nudge suppressions</div>
                <div className="mt-2 text-3xl font-semibold text-white">{operationalWatchListSummary.suppressNudgesCount}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Adherence exclusions</div>
                <div className="mt-2 text-3xl font-semibold text-white">{operationalWatchListSummary.excludeFromAdherenceCount}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Manual holds</div>
                <div className="mt-2 text-3xl font-semibold text-white">{operationalWatchListSummary.manualHoldCount}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 rounded-3xl border border-white/10 bg-[#11151f] p-4 md:grid-cols-2">
            <select
              value={organizationId}
              onChange={(event) => {
                setOrganizationId(event.target.value);
                setTeamId('');
              }}
              className="rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
            >
              <option value="">All organizations</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.displayName}
                </option>
              ))}
            </select>
            <select
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#0b0f17] px-4 py-3 text-sm text-white"
            >
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.displayName}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-8 text-sm text-zinc-400">
              Loading active pilots...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-sm text-rose-200">{error}</div>
          ) : filteredEntries.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-[#11151f] p-8 text-sm text-zinc-400">
              No active pilots match the current filters.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.pilot.id}
                  className="group rounded-3xl border border-white/10 bg-[#11151f] p-5 transition hover:border-cyan-400/40 hover:bg-[#141b28]"
                >
                  {(() => {
                    const primaryPilotMetrics: Array<{ label: string; value: string; metricKey: PilotDashboardMetricExplanationKey }> = [
                      { label: 'Active Athletes', value: String(entry.activeEnrollmentCount), metricKey: 'active-pilot-athletes' },
                      { label: 'Cohorts', value: String(entry.activeCohortCount || entry.cohorts.length), metricKey: 'active-cohorts' },
                      { label: 'Hypotheses', value: String(entry.hypothesisCount), metricKey: 'hypotheses' },
                      { label: 'Not Supported', value: String(entry.unsupportedHypothesisCount), metricKey: 'not-supported' },
                    ];
                    const secondaryPilotMetrics: Array<{ label: string; value: string; metricKey: PilotDashboardMetricExplanationKey }> = [
                      { label: 'Coverage', value: formatPercent(entry.engineCoverageRate), metricKey: 'coverage' },
                      { label: 'Stable Rate', value: formatPercent(entry.stablePatternRate), metricKey: 'stable-rate' },
                      { label: 'Avg Evidence', value: formatAverage(entry.avgEvidenceRecordsPerActiveAthlete), metricKey: 'avg-evidence' },
                      { label: 'Avg Projections', value: formatAverage(entry.avgRecommendationProjectionsPerActiveAthlete), metricKey: 'avg-projections-per-athlete' },
                    ];

                    return (
                      <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{entry.organization.displayName}</p>
                      <a
                        href={`/admin/pulsecheckPilotDashboard/${encodeURIComponent(entry.pilot.id)}`}
                        className="mt-2 inline-block text-left text-xl font-semibold text-white transition hover:text-cyan-200"
                      >
                        {entry.pilot.name}
                      </a>
                      <p className="mt-1 text-sm text-zinc-400">{entry.team.displayName}</p>
                    </div>
                    <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-wide text-cyan-200">
                      {entry.pilot.studyMode}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-zinc-300">
                    {primaryPilotMetrics.map((metric) => (
                      <div key={metric.label} className="rounded-2xl border border-white/5 bg-black/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 pr-2 text-xs uppercase tracking-wide text-zinc-500">{metric.label}</div>
                          <NoraMetricHelpButton metricKey={metric.metricKey} className="shrink-0" />
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">{metric.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-zinc-300">
                    {secondaryPilotMetrics.map((metric) => (
                      <div key={metric.label} className="rounded-2xl border border-white/5 bg-black/20 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 pr-2 text-xs uppercase tracking-wide text-zinc-500">{metric.label}</div>
                          <NoraMetricHelpButton metricKey={metric.metricKey} className="shrink-0" />
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">{metric.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
                    <div className="inline-flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Pilot-native dashboard
                    </div>
                    <a
                      href={`/admin/pulsecheckPilotDashboard/${encodeURIComponent(entry.pilot.id)}`}
                      className="inline-flex items-center gap-2 text-cyan-200 transition group-hover:translate-x-1 hover:text-cyan-100"
                    >
                      Open pilot
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckPilotDashboardIndexPage;
