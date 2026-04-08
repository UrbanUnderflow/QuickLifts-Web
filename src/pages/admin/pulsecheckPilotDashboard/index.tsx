import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Activity,
  ArrowRight,
  Building2,
  Filter,
  FlaskConical,
  Layers3,
  MonitorPlay,
  RefreshCcw,
  ShieldAlert,
  Users2,
  type LucideIcon,
} from 'lucide-react';
import AdminRouteGuard from '../../../components/auth/AdminRouteGuard';
import { LocalFirebaseModeButton } from '../../../components/admin/pilot-dashboard/LocalFirebaseModeButton';
import NoraMetricHelpButton from '../../../components/admin/pilot-dashboard/NoraMetricHelpButton';
import type { PilotDashboardMetricExplanationKey } from '../../../components/admin/pilot-dashboard/noraMetricCatalog';
import { pulseCheckPilotDashboardService } from '../../../api/firebase/pulsecheckPilotDashboard/service';
import type { PilotDashboardDirectoryEntry } from '../../../api/firebase/pulsecheckPilotDashboard/types';

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatAverage = (value: number) => value.toFixed(1);
const getPilotCountLabel = (count: number) => `${count} pilot${count === 1 ? '' : 's'}`;

type StudyModeValue = PilotDashboardDirectoryEntry['pilot']['studyMode'];
type MetricTone = 'teal' | 'emerald' | 'amber' | 'blue' | 'violet';

const studyModeOptions: Array<{ value: '' | StudyModeValue; label: string }> = [
  { value: '', label: 'All study modes' },
  { value: 'research', label: 'Research' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'operational', label: 'Operational' },
];

const getStudyModeMeta = (studyMode: StudyModeValue) => {
  switch (studyMode) {
    case 'research':
      return {
        label: 'Research',
        badgeClassName: 'border-violet-400/25 bg-violet-400/10 text-violet-200',
        dotClassName: 'bg-violet-300',
        legendCountClassName: 'text-violet-200',
      };
    case 'pilot':
      return {
        label: 'Pilot',
        badgeClassName: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
        dotClassName: 'bg-emerald-300',
        legendCountClassName: 'text-emerald-200',
      };
    case 'operational':
      return {
        label: 'Operational',
        badgeClassName: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
        dotClassName: 'bg-sky-300',
        legendCountClassName: 'text-sky-200',
      };
    default:
      return {
        label: studyMode,
        badgeClassName: 'border-white/15 bg-white/10 text-white/80',
        dotClassName: 'bg-white/60',
        legendCountClassName: 'text-white/80',
      };
  }
};

const getMetricValueClassName = (value: number, tone: MetricTone) => {
  if (value <= 0) {
    return 'text-white/30';
  }

  switch (tone) {
    case 'emerald':
      return 'text-emerald-200';
    case 'amber':
      return 'text-amber-200';
    case 'blue':
      return 'text-sky-200';
    case 'violet':
      return 'text-violet-200';
    case 'teal':
    default:
      return 'text-[#7cefd6]';
  }
};

const PulseCheckPilotDashboardIndexPage: React.FC = () => {
  const router = useRouter();
  const [entries, setEntries] = useState<PilotDashboardDirectoryEntry[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [studyMode, setStudyMode] = useState<'' | StudyModeValue>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState('Active Pilots');
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
    setStudyMode('');
    void load('refresh');
  };

  const resetDemoModeData = () => {
    pulseCheckPilotDashboardService.resetDemoModeData();
    void load('refresh');
  };

  const organizations = useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((entry) => !studyMode || entry.pilot.studyMode === studyMode)
            .map((entry) => [entry.organization.id, entry.organization])
        ).values()
      ).sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [entries, studyMode]
  );

  const teams = useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((entry) => !studyMode || entry.pilot.studyMode === studyMode)
            .filter((entry) => !organizationId || entry.organization.id === organizationId)
            .map((entry) => [entry.team.id, entry.team])
        ).values()
      ).sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [entries, organizationId, studyMode]
  );

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (organizationId && entry.organization.id !== organizationId) return false;
        if (teamId && entry.team.id !== teamId) return false;
        if (studyMode && entry.pilot.studyMode !== studyMode) return false;
        return true;
      }),
    [entries, organizationId, studyMode, teamId]
  );

  const summary = useMemo(
    () => ({
      activePilots: filteredEntries.length,
      activeAthletes: filteredEntries.reduce((sum, entry) => sum + entry.activeEnrollmentCount, 0),
      hypothesisCount: filteredEntries.reduce((sum, entry) => sum + entry.hypothesisCount, 0),
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
          ? filteredEntries.reduce((sum, entry) => sum + entry.avgEvidenceRecordsPerActiveAthlete, 0) /
            filteredEntries.length
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

  const visibleOrganizationCount = useMemo(
    () => new Set(filteredEntries.map((entry) => entry.organization.id)).size,
    [filteredEntries]
  );

  const visibleTeamCount = useMemo(() => new Set(filteredEntries.map((entry) => entry.team.id)).size, [filteredEntries]);

  const studyModeCounts = useMemo(
    () =>
      filteredEntries.reduce(
        (accumulator, entry) => {
          accumulator[entry.pilot.studyMode] += 1;
          return accumulator;
        },
        { research: 0, pilot: 0, operational: 0 }
      ),
    [filteredEntries]
  );

  const primarySummaryCards: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
    iconClassName: string;
    shellClassName: string;
    metricKey: PilotDashboardMetricExplanationKey;
    tone: MetricTone;
    numericValue: number;
    testId?: string;
  }> = [
    {
      label: 'Active Pilots',
      value: String(summary.activePilots),
      icon: FlaskConical,
      iconClassName: 'text-[#00d4aa]',
      shellClassName: 'border-[#00d4aa]/20 bg-[#00d4aa]/10',
      metricKey: 'active-pilots',
      tone: 'teal',
      numericValue: summary.activePilots,
    },
    {
      label: 'Active Athletes',
      value: String(summary.activeAthletes),
      icon: Users2,
      iconClassName: 'text-emerald-200',
      shellClassName: 'border-emerald-400/20 bg-emerald-400/10',
      metricKey: 'active-pilot-athletes',
      tone: 'emerald',
      numericValue: summary.activeAthletes,
    },
    {
      label: 'Unsupported Hyp.',
      value: String(summary.unsupportedHypotheses),
      icon: Activity,
      iconClassName: 'text-amber-200',
      shellClassName: 'border-amber-400/20 bg-amber-400/10',
      metricKey: 'unsupported-hypotheses',
      tone: 'amber',
      numericValue: summary.unsupportedHypotheses,
    },
    {
      label: 'Coverage',
      value: formatPercent(summary.avgEngineCoverageRate),
      icon: Layers3,
      iconClassName: 'text-sky-200',
      shellClassName: 'border-sky-400/20 bg-sky-400/10',
      metricKey: 'coverage',
      tone: 'blue',
      numericValue: summary.avgEngineCoverageRate,
    },
    {
      label: 'Stable Rate',
      value: formatPercent(summary.avgStablePatternRate),
      icon: Users2,
      iconClassName: 'text-violet-200',
      shellClassName: 'border-violet-400/20 bg-violet-400/10',
      metricKey: 'stable-rate',
      tone: 'violet',
      numericValue: summary.avgStablePatternRate,
      testId: 'pilot-dashboard-metric-help-stable-rate',
    },
  ];

  const secondarySummaryCards: Array<{
    label: string;
    value: string;
    metricKey: PilotDashboardMetricExplanationKey;
    tone: MetricTone;
    numericValue: number;
  }> = [
    {
      label: 'Avg Evidence',
      value: formatAverage(summary.avgEvidenceRecordsPerAthlete),
      metricKey: 'avg-evidence',
      tone: 'violet',
      numericValue: summary.avgEvidenceRecordsPerAthlete,
    },
    {
      label: 'Promising Hypotheses',
      value: String(summary.promisingHypotheses),
      metricKey: 'promising-hypotheses',
      tone: 'teal',
      numericValue: summary.promisingHypotheses,
    },
    {
      label: 'High Confidence Hypotheses',
      value: String(summary.highConfidenceHypotheses),
      metricKey: 'high-confidence-hypotheses',
      tone: 'emerald',
      numericValue: summary.highConfidenceHypotheses,
    },
    {
      label: 'Avg Projections / Athlete',
      value: formatAverage(summary.avgProjectionsPerAthlete),
      metricKey: 'avg-projections-per-athlete',
      tone: 'blue',
      numericValue: summary.avgProjectionsPerAthlete,
    },
  ];

  const watchListCards = [
    { label: 'Pilots with watch list', value: operationalWatchListSummary.pilotsWithWatchList, flagged: false },
    { label: 'Active states', value: operationalWatchListSummary.activeCount, flagged: operationalWatchListSummary.activeCount > 0 },
    {
      label: 'Review queued states',
      value: operationalWatchListSummary.requestedCount,
      flagged: operationalWatchListSummary.requestedCount > 0,
    },
    {
      label: 'Survey suppressions',
      value: operationalWatchListSummary.suppressSurveysCount,
      flagged: operationalWatchListSummary.suppressSurveysCount > 0,
    },
    {
      label: 'Assignment suppressions',
      value: operationalWatchListSummary.suppressAssignmentsCount,
      flagged: operationalWatchListSummary.suppressAssignmentsCount > 0,
    },
    {
      label: 'Nudge suppressions',
      value: operationalWatchListSummary.suppressNudgesCount,
      flagged: operationalWatchListSummary.suppressNudgesCount > 0,
    },
    {
      label: 'Adherence exclusions',
      value: operationalWatchListSummary.excludeFromAdherenceCount,
      flagged: operationalWatchListSummary.excludeFromAdherenceCount > 0,
    },
    {
      label: 'Manual holds',
      value: operationalWatchListSummary.manualHoldCount,
      flagged: operationalWatchListSummary.manualHoldCount > 0,
    },
  ];

  const handleSidebarNavigation = (item: {
    label: string;
    destination: { type: 'section'; id: string } | { type: 'route'; href: string };
  }) => {
    setActiveSidebarItem(item.label);

    if (item.destination.type === 'route') {
      void router.push(item.destination.href);
      return;
    }

    if (typeof document === 'undefined') return;
    const nextSection = document.getElementById(item.destination.id);
    if (!nextSection) return;

    nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${item.destination.id}`);
    }
  };

  const sidebarSections: Array<{
    label: string;
    items: Array<{
      label: string;
      value: number;
      icon: LucideIcon;
      destination: { type: 'section'; id: string } | { type: 'route'; href: string };
    }>;
  }> = [
    {
      label: 'Monitoring',
      items: [
        { label: 'Active Pilots', value: summary.activePilots, icon: Activity, destination: { type: 'section', id: 'pilot-directory' } },
        { label: 'Athletes', value: summary.activeAthletes, icon: Users2, destination: { type: 'section', id: 'aggregate-summary' } },
        { label: 'Hypotheses', value: summary.hypothesisCount, icon: Layers3, destination: { type: 'section', id: 'aggregate-summary' } },
        { label: 'Watch List', value: operationalWatchListSummary.stateCount, icon: ShieldAlert, destination: { type: 'section', id: 'watch-list-summary' } },
      ],
    },
    {
      label: 'Provisioning',
      items: [
        {
          label: 'Organizations',
          value: visibleOrganizationCount,
          icon: Building2,
          destination: { type: 'route', href: '/admin/pulsecheckProvisioning#organizations-directory' },
        },
        {
          label: 'Teams',
          value: visibleTeamCount,
          icon: FlaskConical,
          destination: { type: 'route', href: '/admin/pulsecheckProvisioning#organization-hierarchy' },
        },
      ],
    },
  ];

  const areFiltersActive = Boolean(organizationId || teamId || studyMode);
  const pilotCountText = loading ? 'Loading pilots...' : error ? 'Directory unavailable' : getPilotCountLabel(filteredEntries.length);

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Pilot Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="pilot-dashboard-theme pilot-font-body min-h-screen text-white">
        <div className="pilot-ambient-layer" aria-hidden="true">
          <div className="pilot-ambient-orb pilot-ambient-orb-teal" />
          <div className="pilot-ambient-orb pilot-ambient-orb-blue" />
          <div className="pilot-ambient-orb pilot-ambient-orb-amber" />
        </div>

        <div className="relative z-10">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(7,9,15,0.82)] backdrop-blur-2xl">
            <div className="flex h-14 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-4">
                <a href="/admin" className="pilot-font-display flex items-center gap-2 text-sm font-bold tracking-[-0.03em] text-white">
                  <span className="pilot-logo-dot" />
                  PulseCheck
                </a>
                <div className="hidden h-5 w-px bg-white/10 sm:block" />
                <span className="pilot-font-display hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35 sm:block">
                  Admin
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/60 sm:inline-flex">
                  <span className={`h-2 w-2 rounded-full ${demoModeEnabled ? 'bg-amber-300' : 'bg-[#00d4aa]'}`} />
                  {demoModeEnabled ? 'Demo dataset' : 'Live dataset'}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/70">
                  <span className="pilot-font-mono">{pilotCountText}</span>
                </div>
              </div>
            </div>
          </header>

          <div className="grid min-h-[calc(100vh-56px)] lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="hidden border-r border-white/10 lg:flex lg:flex-col">
              <div className="sticky top-14 flex h-[calc(100vh-56px)] flex-col px-0 py-6">
                {sidebarSections.map((section) => (
                  <div key={section.label} className="mb-6">
                    <div className="px-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25">
                      {section.label}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleSidebarNavigation(item)}
                            aria-current={activeSidebarItem === item.label ? 'page' : undefined}
                            className={`relative flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition ${
                              activeSidebarItem === item.label
                                ? 'bg-white/[0.04] text-white'
                                : 'text-white/55 hover:bg-white/[0.03] hover:text-white/80'
                            }`}
                          >
                            {activeSidebarItem === item.label ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[#00d4aa]" /> : null}
                            <Icon className={`h-4 w-4 shrink-0 ${activeSidebarItem === item.label ? 'text-[#00d4aa]' : 'text-white/35'}`} />
                            <span>{item.label}</span>
                            <span className="pilot-font-mono ml-auto rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/70">
                              {item.value}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="mt-auto border-t border-white/10 px-5 pt-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25">Pilot Status</div>
                  <div className="mt-3 space-y-2.5">
                    {(['research', 'pilot', 'operational'] as StudyModeValue[]).map((mode) => {
                      const meta = getStudyModeMeta(mode);
                      return (
                        <div key={mode} className="flex items-center gap-3 text-sm">
                          <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClassName}`} />
                          <span className="text-white/50">{meta.label}</span>
                          <span className={`pilot-font-mono ml-auto text-[11px] ${meta.legendCountClassName}`}>
                            {studyModeCounts[mode]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>

            <main className="min-w-0">
              <section className="pilot-slide-up border-b border-white/10 px-4 py-8 sm:px-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#00d4aa]">
                      PulseCheck Admin
                    </div>
                    <h1 className="pilot-font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-[2.2rem]">
                      Active Pilot Dashboard
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55 sm:text-[15px]">
                      Pilot-native directory for active PulseCheck pilots. Review pilot-scoped athletes, engine health,
                      findings, and manual hypothesis tracking inside the active enrollment boundary.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 xl:justify-end">
                    <LocalFirebaseModeButton />

                    {demoModeEnabled ? (
                      <button
                        type="button"
                        onClick={resetDemoModeData}
                        data-testid="pilot-dashboard-demo-reset"
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-400/15"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Reset Demo Data
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={toggleDemoMode}
                      data-testid="pilot-dashboard-demo-toggle"
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                        demoModeEnabled
                          ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15'
                          : 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15'
                      }`}
                    >
                      <MonitorPlay className="h-4 w-4" />
                      {demoModeEnabled ? 'Exit Demo Mode' : 'Switch To Demo Mode'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void load('refresh')}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                      {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                </div>

                {demoModeEnabled ? (
                  <div
                    data-testid="pilot-dashboard-demo-banner"
                    className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
                  >
                    Demo mode is on. This dashboard is using mock pilots, mock athletes, mock hypotheses, and mock AI
                    research briefs stored locally in your browser so you can demo and QA safely.
                  </div>
                ) : null}
              </section>

              <section id="aggregate-summary" className="pilot-slide-up scroll-mt-24 border-b border-white/10 px-4 py-6 sm:px-8" style={{ animationDelay: '60ms' }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                  Aggregate - all active pilots
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-5">
                  {primarySummaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.label} className="pilot-glass-card rounded-[22px] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">{card.label}</div>
                            <div className={`pilot-font-mono mt-4 text-[2rem] leading-none ${getMetricValueClassName(card.numericValue, card.tone)}`}>
                              {card.value}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            <NoraMetricHelpButton
                              metricKey={card.metricKey}
                              className="border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#7cefd6] hover:bg-white/[0.08]"
                              testId={card.testId}
                            />
                            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${card.shellClassName}`}>
                              <Icon className={`h-4 w-4 ${card.iconClassName}`} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                  {secondarySummaryCards.map((card) => (
                    <div key={card.label} className="pilot-glass-card rounded-[20px] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pr-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                          {card.label}
                        </div>
                        <NoraMetricHelpButton
                          metricKey={card.metricKey}
                          className="border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#7cefd6] hover:bg-white/[0.08]"
                        />
                      </div>
                      <div className={`pilot-font-mono mt-4 text-[2rem] leading-none ${getMetricValueClassName(card.numericValue, card.tone)}`}>
                        {card.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="watch-list-summary" className="pilot-slide-up scroll-mt-24 border-b border-white/10 px-4 py-5 sm:px-8" style={{ animationDelay: '100ms' }}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10">
                      <ShieldAlert className="h-5 w-5 text-rose-200" />
                    </div>
                    <div>
                      <div className="pilot-font-display text-base font-semibold text-white">Operational Watch List</div>
                      <div className="mt-1 text-sm text-white/40">Directory-level restriction summary</div>
                    </div>
                  </div>

                  <div className="max-w-xl rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/45">
                    Escalations remain separate from operational restriction state. Requests are review-only until applied.
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                  {watchListCards.map((card) => (
                    <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{card.label}</div>
                      <div className={`pilot-font-mono mt-3 text-2xl leading-none ${card.flagged ? 'text-rose-200' : 'text-white'}`}>
                        {card.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section
                className="pilot-slide-up sticky top-14 z-30 border-b border-white/10 bg-[rgba(7,9,15,0.88)] px-4 py-3 backdrop-blur-2xl sm:px-8"
                style={{ animationDelay: '140ms' }}
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                  <div className="flex items-center gap-2 text-white/35">
                    <Filter className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Filters</span>
                  </div>

                  <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <select
                      value={organizationId}
                      onChange={(event) => {
                        setOrganizationId(event.target.value);
                        setTeamId('');
                      }}
                      className="pilot-select rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 outline-none transition hover:border-white/15 hover:text-white focus:border-[#00d4aa]/35"
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
                      className="pilot-select rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 outline-none transition hover:border-white/15 hover:text-white focus:border-[#00d4aa]/35"
                    >
                      <option value="">All teams</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.displayName}
                        </option>
                      ))}
                    </select>

                    <select
                      value={studyMode}
                      onChange={(event) => setStudyMode(event.target.value as '' | StudyModeValue)}
                      className="pilot-select rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 outline-none transition hover:border-white/15 hover:text-white focus:border-[#00d4aa]/35"
                    >
                      {studyModeOptions.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 xl:ml-auto xl:justify-end">
                    {areFiltersActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOrganizationId('');
                          setTeamId('');
                          setStudyMode('');
                        }}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        Clear filters
                      </button>
                    ) : null}
                    <span className="pilot-font-mono text-xs text-white/45">{pilotCountText}</span>
                  </div>
                </div>
              </section>

              <section id="pilot-directory" className="scroll-mt-24 px-4 py-6 sm:px-8 sm:py-8">
                {loading ? (
                  <div className="pilot-fade-in rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-sm text-white/50">
                    Loading active pilots...
                  </div>
                ) : error ? (
                  <div className="pilot-fade-in rounded-[28px] border border-rose-400/25 bg-rose-400/10 p-8">
                    <div className="text-sm text-rose-100">{error}</div>
                    <button
                      type="button"
                      onClick={() => void load('refresh')}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300/20 bg-black/20 px-4 py-2 text-sm text-rose-100 transition hover:bg-black/30"
                    >
                      <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                      Try again
                    </button>
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="pilot-fade-in rounded-[28px] border border-white/10 bg-white/[0.03] p-8">
                    <div className="pilot-font-display text-xl font-semibold text-white">No active pilots match the current filters</div>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">
                      Adjust the organization, team, or study mode filters to bring pilots back into scope.
                    </p>
                    {areFiltersActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOrganizationId('');
                          setTeamId('');
                          setStudyMode('');
                        }}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {filteredEntries.map((entry, index) => {
                      const studyModeMeta = getStudyModeMeta(entry.pilot.studyMode);
                      const pilotMetrics: Array<{
                        label: string;
                        value: string;
                        metricKey: PilotDashboardMetricExplanationKey;
                        tone: MetricTone;
                        numericValue: number;
                      }> = [
                        {
                          label: 'Active Athletes',
                          value: String(entry.activeEnrollmentCount),
                          metricKey: 'active-pilot-athletes',
                          tone: 'teal',
                          numericValue: entry.activeEnrollmentCount,
                        },
                        {
                          label: 'Cohorts',
                          value: String(entry.activeCohortCount || entry.cohorts.length),
                          metricKey: 'active-cohorts',
                          tone: 'blue',
                          numericValue: entry.activeCohortCount || entry.cohorts.length,
                        },
                        {
                          label: 'Hypotheses',
                          value: String(entry.hypothesisCount),
                          metricKey: 'hypotheses',
                          tone: 'violet',
                          numericValue: entry.hypothesisCount,
                        },
                        {
                          label: 'Not Supported',
                          value: String(entry.unsupportedHypothesisCount),
                          metricKey: 'not-supported',
                          tone: 'amber',
                          numericValue: entry.unsupportedHypothesisCount,
                        },
                        {
                          label: 'Coverage',
                          value: formatPercent(entry.engineCoverageRate),
                          metricKey: 'coverage',
                          tone: 'teal',
                          numericValue: entry.engineCoverageRate,
                        },
                        {
                          label: 'Stable Rate',
                          value: formatPercent(entry.stablePatternRate),
                          metricKey: 'stable-rate',
                          tone: 'emerald',
                          numericValue: entry.stablePatternRate,
                        },
                        {
                          label: 'Avg Evidence',
                          value: formatAverage(entry.avgEvidenceRecordsPerActiveAthlete),
                          metricKey: 'avg-evidence',
                          tone: 'blue',
                          numericValue: entry.avgEvidenceRecordsPerActiveAthlete,
                        },
                        {
                          label: 'Avg Projections',
                          value: formatAverage(entry.avgRecommendationProjectionsPerActiveAthlete),
                          metricKey: 'avg-projections-per-athlete',
                          tone: 'violet',
                          numericValue: entry.avgRecommendationProjectionsPerActiveAthlete,
                        },
                      ];

                      return (
                        <div
                          key={entry.pilot.id}
                          className="pilot-fade-in group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-200 hover:border-white/20 hover:bg-white/[0.05]"
                          style={{ animationDelay: `${160 + index * 60}ms` }}
                        >
                          <div className="border-b border-white/10 px-5 py-5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
                              {entry.organization.displayName}
                            </div>
                            <div className="mt-2 flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <a
                                  href={`/admin/pulsecheckPilotDashboard/${encodeURIComponent(entry.pilot.id)}`}
                                  className="pilot-font-display block text-xl font-bold tracking-[-0.03em] text-white transition hover:text-[#9cf4e2]"
                                >
                                  {entry.pilot.name}
                                </a>
                                <div className="mt-1 text-sm text-white/40">{entry.team.displayName}</div>
                              </div>

                              <span
                                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${studyModeMeta.badgeClassName}`}
                              >
                                {studyModeMeta.label}
                              </span>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-none">
                            <div className="grid grid-cols-2 gap-px bg-white/10">
                              {pilotMetrics.map((metric) => (
                                <div key={metric.label} className="bg-[rgba(9,12,19,0.92)] px-4 py-3.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 pr-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">
                                      {metric.label}
                                    </div>
                                    <NoraMetricHelpButton
                                      metricKey={metric.metricKey}
                                      className="border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#7cefd6] hover:bg-white/[0.08]"
                                    />
                                  </div>
                                  <div className={`pilot-font-mono mt-3 text-[1.45rem] leading-none ${getMetricValueClassName(metric.numericValue, metric.tone)}`}>
                                    {metric.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-white/[0.02] px-5 py-3.5 text-sm">
                            <div className="flex items-center gap-2 text-white/40">
                              <Building2 className="h-4 w-4" />
                              <span>
                                {entry.operationalWatchListSummary?.stateCount
                                  ? `${entry.operationalWatchListSummary.stateCount} watch-list state${
                                      entry.operationalWatchListSummary.stateCount === 1 ? '' : 's'
                                    }`
                                  : 'Pilot-native dashboard'}
                              </span>
                            </div>

                            <a
                              href={`/admin/pulsecheckPilotDashboard/${encodeURIComponent(entry.pilot.id)}`}
                              className="inline-flex items-center gap-2 font-medium text-[#7cefd6] transition group-hover:gap-3 hover:text-white"
                            >
                              Open pilot
                              <ArrowRight className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </main>
          </div>
        </div>

        <style jsx global>{`
          .pilot-dashboard-theme {
            background: #07090f;
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
            animation: pilotFloat 18s ease-in-out infinite;
          }

          .pilot-ambient-orb-teal {
            top: -16rem;
            right: -10rem;
            height: 50rem;
            width: 50rem;
            background: radial-gradient(circle, rgba(0, 212, 170, 0.12) 0%, rgba(0, 212, 170, 0.02) 45%, transparent 72%);
          }

          .pilot-ambient-orb-blue {
            bottom: -12rem;
            left: -8rem;
            height: 38rem;
            width: 38rem;
            background: radial-gradient(circle, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.02) 45%, transparent 72%);
            animation-delay: -6s;
          }

          .pilot-ambient-orb-amber {
            top: 36%;
            left: 28%;
            height: 28rem;
            width: 28rem;
            background: radial-gradient(circle, rgba(245, 166, 35, 0.08) 0%, rgba(245, 166, 35, 0.015) 45%, transparent 72%);
            animation-delay: -10s;
          }

          .pilot-logo-dot {
            height: 0.5rem;
            width: 0.5rem;
            border-radius: 9999px;
            background: #00d4aa;
            box-shadow: 0 0 12px rgba(0, 212, 170, 0.55);
            animation: pilotPulse 2.8s ease-in-out infinite;
          }

          .pilot-glass-card {
            background: rgba(255, 255, 255, 0.032);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(20px);
          }

          .pilot-select {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.28)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
            background-position: right 0.9rem center;
            background-repeat: no-repeat;
            padding-right: 2.5rem;
          }

          .pilot-slide-up {
            opacity: 0;
            animation: pilotSlideUp 0.45s ease forwards;
          }

          .pilot-fade-in {
            opacity: 0;
            animation: pilotFadeIn 0.45s ease forwards;
          }

          @keyframes pilotPulse {
            0%,
            100% {
              box-shadow: 0 0 12px rgba(0, 212, 170, 0.55);
            }
            50% {
              box-shadow: 0 0 24px rgba(0, 212, 170, 0.9);
            }
          }

          @keyframes pilotFloat {
            0%,
            100% {
              transform: translate3d(0, 0, 0) scale(1);
            }
            50% {
              transform: translate3d(0, 18px, 0) scale(1.04);
            }
          }

          @keyframes pilotSlideUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes pilotFadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckPilotDashboardIndexPage;
