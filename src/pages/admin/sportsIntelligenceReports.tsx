import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import CoachReportView from '../../components/coach-reports/CoachReportView';
import {
  CoachReportAdherenceBlock,
  CoachReportCoachAction,
  CoachReportCoachSurface,
  CoachReportGameDayLookFor,
  CoachReportReviewerOnly,
  CoachReportWatchlistEntry,
  StoredCoachReport,
  enforceLanguagePosture,
  pulsecheckCoachReportService,
} from '../../api/firebase/pulsecheckCoachReportService';
import {
  CoachActionCandidate,
  GameDayLookFor,
  NamedAthleteWatchEntry,
  PulseCheckSportConfigurationEntry,
  enforceCoachActionSpecificity,
  enforceNamedAthleteWatchlist,
  getDefaultPulseCheckSports,
} from '../../api/firebase/pulsecheckSportConfig';
import {
  COACH_REPORT_DEMO_EXAMPLES,
  CoachReportDemoExample,
  getSportColor,
} from '../../api/firebase/pulsecheckSportReportDemos';
import { orchestrateGeneratedReportDraft } from '../../api/firebase/sportsIntelligenceDraftOrchestrator';
import {
  SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS,
  SportsIntelligenceFixtureScenario,
  SportsIntelligenceFixtureSportId,
  getSportsIntelligenceFixture,
  getSportsIntelligenceFixtureScenarioLabel,
} from '../../api/firebase/pulsecheckSportTestFixtures';

const INITIAL_REVIEWER_ONLY: CoachReportReviewerOnly = {
  evidence: {
    athleteEvidenceRefs: [],
    sourceProvenance: [],
    confidenceTier: 'stable',
    missingInputs: [],
    thresholdTrace: [],
    unsuppressedSignals: [],
  },
  auditTrace: {
    localizationAuditResult: { passed: true, violations: [] },
    suppressedWatchlistEntries: [],
    suppressedCoachActions: [],
    suppressionReasons: [],
  },
};

const confidenceOptions = ['Strong read', 'Usable read', 'Thin read', 'Insufficient'];

const toPercent = (value: number | undefined) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(Math.max(0, Math.min(100, numeric <= 1 ? numeric * 100 : numeric)));
};
const fromPercent = (value: string) => Math.max(0, Math.min(1, (Number(value) || 0) / 100));

const todayWeekLabel = () => {
  const now = new Date();
  return `Week of ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

const currentWeekStartKey = () => {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
};

const formatTimestamp = (value: any) => {
  if (!value) return 'Not set';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return 'Stored';
};

const reportTitle = (report: StoredCoachReport) =>
  `${report.coachSurface?.meta?.teamName || report.teamId} / ${report.coachSurface?.meta?.weekLabel || report.weekStart || 'Draft'}`;

const runLocalizationAudit = (surface: CoachReportCoachSurface, sport: PulseCheckSportConfigurationEntry) => {
  return enforceLanguagePosture(surface, sport);
};

const buildReviewerOnlyFromSurface = (
  surface: CoachReportCoachSurface,
  sport: PulseCheckSportConfigurationEntry,
  existing?: CoachReportReviewerOnly
): CoachReportReviewerOnly => {
  const watchlistGate = enforceNamedAthleteWatchlist(surface.watchlist || []);
  const actionGate = enforceCoachActionSpecificity(surface.coachActions || []);
  const auditResult = runLocalizationAudit(surface, sport);
  const evidenceRefs = (surface.watchlist || []).flatMap((entry) => {
    const evidenceEntry = entry as CoachReportWatchlistEntry & { evidenceRefs?: string[] };
    return evidenceEntry.evidenceRefs || evidenceEntry.supportingContext || [];
  });

  return {
    evidence: {
      athleteEvidenceRefs: existing?.evidence?.athleteEvidenceRefs?.length
        ? existing.evidence.athleteEvidenceRefs
        : Array.from(new Set(evidenceRefs)),
      sourceProvenance: existing?.evidence?.sourceProvenance || ['Manual reviewer entry', 'Sport report fixture'],
      confidenceTier: existing?.evidence?.confidenceTier || 'stable',
      missingInputs: existing?.evidence?.missingInputs || [],
      thresholdTrace: existing?.evidence?.thresholdTrace || ['Manual review gate: no automated thresholds delivered to coach.'],
      unsuppressedSignals: existing?.evidence?.unsuppressedSignals || [],
    },
    auditTrace: {
      localizationAuditResult: auditResult,
      suppressedWatchlistEntries: [],
      suppressedCoachActions: actionGate.suppressed.map((action) => action.action),
      suppressionReasons: [
        watchlistGate.suppressionReason,
        actionGate.suppressionReason,
      ].filter(Boolean) as string[],
    },
  };
};

const buildFixtureReport = (
  sport: PulseCheckSportConfigurationEntry,
  demo: CoachReportDemoExample,
  teamId: string
): Omit<StoredCoachReport, 'id' | 'createdAt' | 'updatedAt'> => {
  const colors = getSportColor(sport.id);
  const weekStart = currentWeekStartKey();
  const adherence: CoachReportAdherenceBlock = {
    wearRate7d: 0.84,
    noraCheckinCompletion7d: 0.76,
    protocolOrSimCompletion7d: 0.68,
    trainingOrNutritionCoverage7d: 0.91,
    deviceCoveragePct: 84,
    noraCompletionPct: 76,
    protocolSimulationCompletionPct: 68,
    trainingNutritionCoveragePct: 91,
    confidenceLabel: 'Usable read',
    summary: 'Usable read. We held back anything thin.',
  };
  const coachSurface: CoachReportCoachSurface = {
    meta: {
      teamId,
      teamName: demo.meta.teamName || `Demo ${sport.name}`,
      sportId: sport.id,
      sportName: sport.name,
      reportType: 'weekly',
      weekStart,
      weekLabel: demo.meta.weekLabel || todayWeekLabel(),
      generatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      reviewStatus: 'draft',
      source: 'fixture',
    },
    topLine: demo.topLine,
    dimensionState: demo.dimensionState || {},
    watchlist: demo.watchlist,
    coachActions: demo.coachActions,
    gameDayLookFors: demo.gameDayLookFors || [],
    noteOpener: demo.noteOpener,
    teamSynthesis: demo.teamSynthesis,
    closer: demo.closer,
    adherence,
  };
  coachSurface.meta = {
    ...coachSurface.meta,
    ...(demo.meta.primarySportColor ? { primarySportColor: demo.meta.primarySportColor } : { primarySportColor: colors.primary }),
    ...(demo.meta.primarySportColorSoft ? { primarySportColorSoft: demo.meta.primarySportColorSoft } : { primarySportColorSoft: colors.soft }),
  } as CoachReportCoachSurface['meta'];

  return {
    teamId,
    sportId: sport.id,
    reportType: 'weekly',
    source: 'fixture',
    weekStart,
    reviewStatus: 'draft',
    deliveryStatus: 'not_sent',
    coachSurface,
    reviewerOnly: buildReviewerOnlyFromSurface(coachSurface, sport),
  };
};

const buildGoldenFixtureReport = (
  sport: PulseCheckSportConfigurationEntry,
  teamId: string,
  scenario: SportsIntelligenceFixtureScenario
): Omit<StoredCoachReport, 'id' | 'createdAt' | 'updatedAt'> | null => {
  const fixture = getSportsIntelligenceFixture(sport.id as SportsIntelligenceFixtureSportId, scenario);
  if (!fixture) return null;
  const colors = getSportColor(sport.id);
  const coachSurface: CoachReportCoachSurface = {
    meta: {
      reportId: fixture.id,
      teamId,
      teamName: fixture.coachSurface.meta.teamName,
      sportId: sport.id,
      sportName: sport.name,
      reportType: 'weekly',
      weekStart: fixture.weekStart,
      weekLabel: fixture.coachSurface.meta.weekLabel,
      generatedAt: fixture.coachSurface.meta.generatedAt,
      reviewStatus: 'draft',
      source: 'fixture',
      primarySportColor: colors.primary,
      primarySportColorSoft: colors.soft,
    },
    topLine: fixture.coachSurface.topLine,
    dimensionState: fixture.coachSurface.dimensionState,
    watchlist: fixture.coachSurface.watchlist as CoachReportWatchlistEntry[],
    coachActions: fixture.coachSurface.coachActions as CoachReportCoachAction[],
    gameDayLookFors: fixture.coachSurface.gameDayLookFors as CoachReportGameDayLookFor[],
    noteOpener: fixture.coachSurface.noteOpener,
    teamSynthesis: fixture.coachSurface.teamSynthesis,
    closer: fixture.coachSurface.closer,
    adherence: {
      wearRate7d: fixture.coachSurface.adherence.deviceCoveragePct / 100,
      noraCheckinCompletion7d: fixture.coachSurface.adherence.noraCompletionPct / 100,
      protocolOrSimCompletion7d: fixture.coachSurface.adherence.protocolSimCompletionPct / 100,
      trainingOrNutritionCoverage7d: fixture.coachSurface.adherence.trainingPlanCoveragePct / 100,
      deviceCoveragePct: fixture.coachSurface.adherence.deviceCoveragePct,
      noraCompletionPct: fixture.coachSurface.adherence.noraCompletionPct,
      protocolSimulationCompletionPct: fixture.coachSurface.adherence.protocolSimCompletionPct,
      trainingNutritionCoveragePct: fixture.coachSurface.adherence.trainingPlanCoveragePct,
      confidenceLabel: fixture.coachSurface.adherence.confidenceLabel,
      summary: fixture.coachSurface.adherence.coachSummary,
    },
  };

  return {
    teamId,
    sportId: sport.id,
    reportType: 'weekly',
    source: 'fixture',
    weekStart: fixture.weekStart,
    reviewStatus: 'draft',
    deliveryStatus: 'not_sent',
    coachSurface,
    reviewerOnly: {
      evidence: fixture.reviewerOnly.evidence,
      auditTrace: {
        localizationAuditResult: fixture.reviewerOnly.auditTrace.localizationAuditResult,
        suppressedWatchlistEntries: fixture.reviewerOnly.auditTrace.suppressedWatchlistEntries.map((entry) => entry.athleteName),
        suppressedCoachActions: fixture.reviewerOnly.auditTrace.suppressedCoachActions.map((action) => action.action),
        suppressionReasons: fixture.reviewerOnly.auditTrace.suppressionReasons,
      },
    },
  };
};

const Chip: React.FC<{ children: React.ReactNode; tone?: 'zinc' | 'green' | 'amber' | 'red' | 'purple' }> = ({ children, tone = 'zinc' }) => {
  const classes = {
    zinc: 'border-zinc-700 bg-zinc-900 text-zinc-300',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    red: 'border-red-500/30 bg-red-500/10 text-red-200',
    purple: 'border-purple-500/30 bg-purple-500/10 text-purple-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${classes[tone]}`}>
      {children}
    </span>
  );
};

const TextareaField: React.FC<{
  label: string;
  value?: string;
  rows?: number;
  onChange: (value: string) => void;
}> = ({ label, value, rows = 3, onChange }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</span>
    <textarea
      value={value || ''}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/15"
    />
  </label>
);

const ArrayTextarea: React.FC<{
  title: string;
  values: string[];
  onChange: (values: string[]) => void;
}> = ({ title, values, onChange }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{title}</span>
    <textarea
      value={(values || []).join('\n')}
      rows={4}
      onChange={(event) => onChange(event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none transition focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/15"
    />
  </label>
);

const TechnicalList: React.FC<{ title: string; items?: string[] }> = ({ title, items }) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{title}</p>
    {items && items.length > 0 ? (
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    ) : (
      <p className="mt-3 text-sm text-zinc-600">No entries.</p>
    )}
  </div>
);

const SportsIntelligenceReportsAdminPage: React.FC = () => {
  const sports = useMemo(() => getDefaultPulseCheckSports(), []);
  const sportById = useMemo(() => new Map(sports.map((sport) => [sport.id, sport])), [sports]);
  const fixtureSports = useMemo(
    () => (['basketball', 'golf', 'bowling', 'track-field'] as SportsIntelligenceFixtureSportId[])
      .map((sportId) => sportById.get(sportId))
      .filter(Boolean) as PulseCheckSportConfigurationEntry[],
    [sportById]
  );

  const [teamFilter, setTeamFilter] = useState('');
  const [fixtureScenario, setFixtureScenario] = useState<SportsIntelligenceFixtureScenario>('good-data');
  const [reports, setReports] = useState<StoredCoachReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StoredCoachReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSport = draft ? sportById.get(draft.sportId) : undefined;
  const groupedReports = useMemo(() => {
    const groups = new Map<string, StoredCoachReport[]>();
    for (const report of reports) {
      const key = report.teamId || 'Unknown team';
      groups.set(key, [...(groups.get(key) || []), report]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [reports]);

  const selectReport = (report: StoredCoachReport) => {
    setSelectedId(report.id);
    setDraft(JSON.parse(JSON.stringify(report)));
    setError(null);
    setNotice(null);
  };

  const loadReports = async () => {
    const scopedTeamId = teamFilter.trim();
    if (!scopedTeamId) {
      setReports([]);
      setDraft(null);
      setSelectedId(null);
      setNotice('Enter a teamId to load drafts. The service intentionally requires a team scope for reader queries.');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const rows = await pulsecheckCoachReportService.listDrafts({
        teamId: scopedTeamId,
        limit: 75,
      });
      setReports(rows);
      if (rows.length > 0) {
        selectReport(rows[0]);
      } else {
        setDraft(null);
        setSelectedId(null);
      }
    } catch (err: any) {
      setReports([]);
      setDraft(null);
      setSelectedId(null);
      setError(err?.message || 'Could not load Sports Intelligence drafts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const updateCoachSurface = (updater: (surface: CoachReportCoachSurface) => CoachReportCoachSurface) => {
    setDraft((current) => {
      if (!current) return current;
      const coachSurface = updater(current.coachSurface);
      const sport = sportById.get(current.sportId);
      return {
        ...current,
        coachSurface,
        reviewerOnly: sport ? buildReviewerOnlyFromSurface(coachSurface, sport, current.reviewerOnly) : current.reviewerOnly,
      };
    });
  };

  const updateReviewerOnly = (updater: (reviewerOnly: CoachReportReviewerOnly) => CoachReportReviewerOnly) => {
    setDraft((current) => current ? { ...current, reviewerOnly: updater(current.reviewerOnly || INITIAL_REVIEWER_ONLY) } : current);
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await pulsecheckCoachReportService.updateDraft(draft.teamId, draft.id, {
        sportId: draft.sportId,
        weekStart: draft.weekStart,
        reportType: draft.reportType,
        source: draft.source,
        reviewStatus: draft.reviewStatus,
        deliveryStatus: draft.deliveryStatus,
        coachSurface: draft.coachSurface,
        reviewerOnly: draft.reviewerOnly,
      });
      setNotice('Draft saved.');
      await loadReports();
    } catch (err: any) {
      setError(err?.message || 'Could not save draft.');
    } finally {
      setSaving(false);
    }
  };

  const seedFromFixture = async (sportId: string) => {
    const sport = sportById.get(sportId);
    const demo = COACH_REPORT_DEMO_EXAMPLES[sportId];
    if (!sport) return;
    const teamId = teamFilter.trim() || `demo-team-${sportId}`;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const fixture = buildGoldenFixtureReport(sport, teamId, fixtureScenario)
        || (demo ? buildFixtureReport(sport, demo, teamId) : null);
      if (!fixture) {
        throw new Error(`No fixture or demo report is available for ${sport.name}.`);
      }
      const reportId = await pulsecheckCoachReportService.createDraft(teamId, sport.id, fixture.weekStart || todayWeekLabel(), 'fixture', {
        reportType: fixture.reportType,
        teamName: fixture.coachSurface.meta.teamName,
        sportName: fixture.coachSurface.meta.sportName,
      });
      await pulsecheckCoachReportService.updateDraft(teamId, reportId, {
        sportId: fixture.sportId,
        weekStart: fixture.weekStart,
        reportType: fixture.reportType,
        source: fixture.source,
        reviewStatus: fixture.reviewStatus,
        deliveryStatus: fixture.deliveryStatus,
        coachSurface: {
          ...fixture.coachSurface,
          meta: {
            ...fixture.coachSurface.meta,
            reportId,
          },
        },
        reviewerOnly: fixture.reviewerOnly,
      });
      setTeamFilter(teamId);
      setNotice(`${sport.name} ${getSportsIntelligenceFixtureScenarioLabel(fixtureScenario)} fixture seeded.`);
      const stored = await pulsecheckCoachReportService.getReport(teamId, reportId);
      if (stored) {
        setReports((current) => [stored, ...current.filter((report) => report.id !== reportId)]);
        selectReport(stored);
      } else {
        await loadReports();
      }
    } catch (err: any) {
      setError(err?.message || `Could not seed ${sport.name} fixture.`);
    } finally {
      setSaving(false);
    }
  };

  const seedFromGenerated = async (sportId: string) => {
    const sport = sportById.get(sportId);
    if (!sport) return;
    const teamId = teamFilter.trim();
    if (!teamId) {
      setError('Add a teamId above before seeding from real data.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const weekStart = todayWeekLabel();
      const result = await orchestrateGeneratedReportDraft({
        teamId,
        sportId,
        weekStart,
        sport,
      });
      if (!result.reportId || !result.stored) {
        throw new Error('Generator returned no report id; nothing to load.');
      }
      const summary =
        `${sport.name} draft generated from ${result.athleteTrace.filter((entry) => entry.snapshotLoaded).length} athlete snapshot(s).`
        + (result.generatorNotes.length > 0 ? ` Note: ${result.generatorNotes[0]}` : '');
      setNotice(summary);
      setReports((current) => [result.stored as StoredCoachReport, ...current.filter((report) => report.id !== result.reportId)]);
      selectReport(result.stored as StoredCoachReport);
    } catch (err: any) {
      setError(err?.message || `Could not generate ${sport.name} draft from real data.`);
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    if (!draft || !selectedSport) return;
    const refreshedReviewerOnly = buildReviewerOnlyFromSurface(draft.coachSurface, selectedSport, draft.reviewerOnly);
    const watchlistGate = enforceNamedAthleteWatchlist(draft.coachSurface.watchlist || []);
    const actionGate = enforceCoachActionSpecificity(draft.coachSurface.coachActions || []);
    const audit = refreshedReviewerOnly.auditTrace.localizationAuditResult;
    const failures: string[] = [];
    if (!audit?.passed) failures.push('Language posture audit has violations.');
    if (watchlistGate.suppressed) failures.push(watchlistGate.suppressionReason || 'Watchlist gate failed.');
    if (actionGate.rendered.length === 0) failures.push('No coach action is specific enough to publish.');

    const reportToSave = { ...draft, reviewerOnly: refreshedReviewerOnly };
    setDraft(reportToSave);

    if (failures.length > 0) {
      setError(failures.join(' '));
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await pulsecheckCoachReportService.updateDraft(draft.teamId, draft.id, {
        sportId: draft.sportId,
        weekStart: draft.weekStart,
        reportType: draft.reportType,
        source: draft.source,
        reviewStatus: draft.reviewStatus,
        deliveryStatus: draft.deliveryStatus,
        coachSurface: draft.coachSurface,
        reviewerOnly: refreshedReviewerOnly,
      });
      await pulsecheckCoachReportService.publish(draft.teamId, draft.id);
      setNotice('Published. Email delivery was triggered through the report service.');
      await loadReports();
    } catch (err: any) {
      setError(err?.message || 'Could not publish draft.');
    } finally {
      setSaving(false);
    }
  };

  const replaceWatchlistEntry = (index: number, patch: Partial<NamedAthleteWatchEntry>) => {
    updateCoachSurface((surface) => {
      const watchlist = [...(surface.watchlist || [])] as Array<CoachReportWatchlistEntry & NamedAthleteWatchEntry>;
      watchlist[index] = { ...watchlist[index], ...patch };
      return { ...surface, watchlist };
    });
  };

  const replaceCoachAction = (index: number, patch: Partial<CoachActionCandidate>) => {
    updateCoachSurface((surface) => {
      const coachActions = [...(surface.coachActions || [])] as CoachReportCoachAction[];
      coachActions[index] = { ...coachActions[index], ...patch };
      return { ...surface, coachActions };
    });
  };

  const replaceLookFor = (index: number, patch: Partial<GameDayLookFor>) => {
    updateCoachSurface((surface) => {
      const gameDayLookFors = [...(surface.gameDayLookFors || [])] as CoachReportGameDayLookFor[];
      gameDayLookFors[index] = { ...gameDayLookFors[index], ...patch };
      return { ...surface, gameDayLookFors };
    });
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Sports Intelligence Reports | Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-[#07080c] text-white">
        <div className="mx-auto max-w-[1800px] px-5 py-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm text-purple-200">
                <ClipboardCheck className="h-4 w-4" />
                <span className="uppercase tracking-[0.2em]">Sports Intelligence</span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">Report Reviewer</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                Manual reviewer lane for Slice 1. The left pane is exactly the coach surface. The right pane is reviewer-only evidence, provenance, and audit trace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/pulsecheckSportConfiguration"
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Sport configuration
              </Link>
              <Link
                href="/coach-report-demo"
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Demo directory
              </Link>
            </div>
          </div>

          {(error || notice) && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-100' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'}`}>
              {error || notice}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Pending drafts</h2>
                    <p className="mt-1 text-xs text-zinc-500">Grouped by team ID.</p>
                  </div>
                  <button
                    type="button"
                    onClick={loadReports}
                    disabled={loading}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                    title="Refresh drafts"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-4 flex gap-2">
                  <input
                    value={teamFilter}
                    onChange={(event) => setTeamFilter(event.target.value)}
                    placeholder="Optional teamId filter"
                    className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400/60"
                  />
                  <button
                    type="button"
                    onClick={loadReports}
                    className="rounded-xl bg-purple-500 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-400"
                  >
                    Load
                  </button>
                </div>
                <div className="mt-5 max-h-[520px] space-y-4 overflow-y-auto pr-1">
                  {loading && <p className="text-sm text-zinc-500">Loading drafts...</p>}
                  {!loading && groupedReports.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                      No pending drafts found. Seed a fixture below to start review.
                    </div>
                  )}
                  {groupedReports.map(([teamId, teamReports]) => (
                    <div key={teamId}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">{teamId}</p>
                      <div className="space-y-2">
                        {teamReports.map((report) => (
                          <button
                            key={`${report.teamId}-${report.id}`}
                            type="button"
                            onClick={() => selectReport(report)}
                            className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === report.id ? 'border-purple-400/60 bg-purple-500/10' : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">{report.coachSurface?.meta?.sportName || report.sportId}</p>
                                <p className="mt-1 text-xs text-zinc-500">{report.coachSurface?.meta?.weekLabel || report.weekStart}</p>
                              </div>
                              <Chip tone={report.reviewStatus === 'published' ? 'green' : 'purple'}>{report.reviewStatus}</Chip>
                            </div>
                            <p className="mt-3 text-xs text-zinc-500">{formatTimestamp(report.updatedAt)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-900/40 bg-emerald-950/15 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-300" />
                  <h2 className="font-semibold">Seed from real data</h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Runs the inference engine on the team's actual HCSR snapshots and produces a coach-surface draft. Requires a real teamId above. The draft will be thin if athletes don't yet have daily snapshots — fill in the watchlist by hand from the reviewer pane.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {fixtureSports.map((sport) => (
                    <button
                      key={`generated-${sport.id}`}
                      type="button"
                      disabled={saving || !teamFilter.trim()}
                      onClick={() => seedFromGenerated(sport.id)}
                      className="rounded-xl border border-emerald-800/50 bg-emerald-900/20 px-3 py-2 text-left text-sm text-emerald-100 hover:border-emerald-400/60 hover:bg-emerald-500/10 disabled:opacity-50"
                      title={teamFilter.trim() ? '' : 'Add a teamId above to seed from real data'}
                    >
                      <span className="mr-1">{sport.emoji}</span>
                      {sport.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-300" />
                  <h2 className="font-semibold">Seed from fixture</h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Uses the current coach mock reports as golden starter drafts. Add a teamId above first if you want the draft under a real team.
                </p>
                <label className="mt-4 block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Scenario</span>
                  <select
                    value={fixtureScenario}
                    onChange={(event) => setFixtureScenario(event.target.value as SportsIntelligenceFixtureScenario)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400/60"
                  >
                    {SPORTS_INTELLIGENCE_FIXTURE_SCENARIOS.map((scenario) => (
                      <option key={scenario} value={scenario}>
                        {getSportsIntelligenceFixtureScenarioLabel(scenario)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {fixtureSports.map((sport) => (
                    <button
                      key={sport.id}
                      type="button"
                      disabled={saving}
                      onClick={() => seedFromFixture(sport.id)}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-200 hover:border-purple-400/50 hover:bg-purple-500/10 disabled:opacity-50"
                    >
                      <span className="mr-1">{sport.emoji}</span>
                      {sport.name}
                    </button>
                  ))}
                </div>
              </section>
            </aside>

            <main className="space-y-6">
              {!draft || !selectedSport ? (
                <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-500">
                  Select or seed a report draft.
                </div>
              ) : (
                <>
                  <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{reportTitle(draft)}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Chip tone="purple">{draft.reviewStatus}</Chip>
                          <Chip>{selectedSport.name}</Chip>
                          <Chip>{draft.coachSurface.adherence.confidenceLabel}</Chip>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveDraft}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                          Save draft
                        </button>
                        <button
                          type="button"
                          onClick={publishDraft}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-2 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                          Publish
                        </button>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.08fr)_520px]">
                    <section className="min-w-0">
                      <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        Coach surface preview
                      </div>
                      <CoachReportView report={draft.coachSurface} sport={selectedSport} />
                    </section>

                    <aside className="space-y-5">
                      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
                        <div className="mb-5 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">Coach copy editor</p>
                            <p className="mt-1 text-xs text-zinc-500">Edits update the left preview live.</p>
                          </div>
                          <ShieldCheck className="h-5 w-5 text-purple-300" />
                        </div>
                        <div className="space-y-4">
                          <TextareaField
                            label="Note opener"
                            value={draft.coachSurface.noteOpener}
                            rows={2}
                            onChange={(value) => updateCoachSurface((surface) => ({ ...surface, noteOpener: value }))}
                          />
                          <TextareaField
                            label="What changed"
                            value={draft.coachSurface.topLine.whatChanged}
                            onChange={(value) => updateCoachSurface((surface) => ({ ...surface, topLine: { ...surface.topLine, whatChanged: value } }))}
                          />
                          <TextareaField
                            label="Who"
                            value={draft.coachSurface.topLine.who}
                            rows={2}
                            onChange={(value) => updateCoachSurface((surface) => ({ ...surface, topLine: { ...surface.topLine, who: value } }))}
                          />
                          <TextareaField
                            label="First action"
                            value={draft.coachSurface.topLine.firstAction}
                            onChange={(value) => updateCoachSurface((surface) => ({ ...surface, topLine: { ...surface.topLine, firstAction: value } }))}
                          />
                          <TextareaField
                            label="Secondary thread"
                            value={draft.coachSurface.topLine.secondaryThread}
                            onChange={(value) => updateCoachSurface((surface) => ({ ...surface, topLine: { ...surface.topLine, secondaryThread: value } }))}
                          />
                          <TextareaField
                            label="Team synthesis"
                            value={draft.coachSurface.teamSynthesis}
                            onChange={(value) => updateCoachSurface((surface) => ({ ...surface, teamSynthesis: value }))}
                          />
                          <TextareaField
                            label="Closer"
                            value={draft.coachSurface.closer}
                            rows={2}
                            onChange={(value) => updateCoachSurface((surface) => ({ ...surface, closer: value }))}
                          />
                        </div>
                      </section>

                      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
                        <h3 className="font-semibold text-white">Manual adherence</h3>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {([
                            ['wearRate7d', 'deviceCoveragePct', 'Wear'],
                            ['noraCheckinCompletion7d', 'noraCompletionPct', 'Nora'],
                            ['protocolOrSimCompletion7d', 'protocolSimulationCompletionPct', 'Protocols/sims'],
                            ['trainingOrNutritionCoverage7d', 'trainingNutritionCoveragePct', 'Training/nutrition'],
                          ] as const).map(([key, pctKey, label]) => (
                            <label key={key} className="block">
                              <span className="mb-1 block text-xs text-zinc-500">{label}</span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={toPercent(draft.coachSurface.adherence[key])}
                                onChange={(event) => updateCoachSurface((surface) => ({
                                  ...surface,
                                  adherence: {
                                    ...surface.adherence,
                                    [key]: fromPercent(event.target.value),
                                    [pctKey]: Number(event.target.value) || 0,
                                  },
                                }))}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400/60"
                              />
                            </label>
                          ))}
                          <label className="col-span-2 block">
                            <span className="mb-1 block text-xs text-zinc-500">Coach-facing confidence label</span>
                            <select
                              value={draft.coachSurface.adherence.confidenceLabel}
                              onChange={(event) => updateCoachSurface((surface) => ({
                                ...surface,
                                adherence: {
                                  ...surface.adherence,
                                  confidenceLabel: event.target.value,
                                },
                              }))}
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400/60"
                            >
                              {confidenceOptions.map((option) => <option key={option}>{option}</option>)}
                            </select>
                          </label>
                        </div>
                      </section>

                      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
                        <h3 className="font-semibold text-white">Watchlist editor</h3>
                        <div className="mt-4 space-y-4">
                          {(draft.coachSurface.watchlist || []).map((entry, index) => (
                            <div key={`${entry.athleteName}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                              <div className="grid grid-cols-2 gap-3">
                                <input
                                  value={entry.athleteName}
                                  onChange={(event) => replaceWatchlistEntry(index, { athleteName: event.target.value })}
                                  placeholder="Athlete"
                                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
                                />
                                <input
                                  value={entry.role || ''}
                                  onChange={(event) => replaceWatchlistEntry(index, { role: event.target.value })}
                                  placeholder="Role"
                                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
                                />
                              </div>
                              <TextareaField label="Why this matters" value={entry.whyMatters} onChange={(value) => replaceWatchlistEntry(index, { whyMatters: value })} />
                              <TextareaField label="Coach move" value={entry.coachMove} onChange={(value) => replaceWatchlistEntry(index, { coachMove: value })} />
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
                        <h3 className="font-semibold text-white">Coach actions + game-day</h3>
                        <div className="mt-4 space-y-4">
                          {(draft.coachSurface.coachActions || []).map((action, index) => (
                            <div key={`${action.action}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                              <TextareaField label="Action" value={action.action} rows={2} onChange={(value) => replaceCoachAction(index, { action: value })} />
                              <div className="mt-3 grid grid-cols-2 gap-3">
                                <input
                                  value={action.appliesTo || ''}
                                  onChange={(event) => replaceCoachAction(index, { appliesTo: event.target.value })}
                                  placeholder="Applies to"
                                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
                                />
                                <input
                                  value={action.session || ''}
                                  onChange={(event) => replaceCoachAction(index, { session: event.target.value })}
                                  placeholder="Session"
                                  className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
                                />
                              </div>
                            </div>
                          ))}

                          {(draft.coachSurface.gameDayLookFors || []).map((item, index) => (
                            <div key={`${item.athleteOrUnit}-${index}`} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                              <input
                                value={item.athleteOrUnit}
                                onChange={(event) => replaceLookFor(index, { athleteOrUnit: event.target.value })}
                                placeholder="Athlete or unit"
                                className="mb-3 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
                              />
                              <TextareaField label="If you see" value={item.lookFor} rows={2} onChange={(value) => replaceLookFor(index, { lookFor: value })} />
                              <TextareaField label="Then" value={item.ifThen} rows={2} onChange={(value) => replaceLookFor(index, { ifThen: value })} />
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
                        <div className="mb-5 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-300" />
                          <h3 className="font-semibold text-white">Reviewer-only technical block</h3>
                        </div>
                        <div className="space-y-4">
                          <TechnicalList title="Athlete evidence refs" items={draft.reviewerOnly?.evidence?.athleteEvidenceRefs} />
                          <TechnicalList title="Source provenance" items={draft.reviewerOnly?.evidence?.sourceProvenance} />
                          <TechnicalList title="Missing inputs" items={draft.reviewerOnly?.evidence?.missingInputs} />
                          <TechnicalList title="Threshold trace" items={draft.reviewerOnly?.evidence?.thresholdTrace} />
                          <TechnicalList title="Unsuppressed signals" items={draft.reviewerOnly?.evidence?.unsuppressedSignals} />
                          <TechnicalList title="Suppression reasons" items={draft.reviewerOnly?.auditTrace?.suppressionReasons} />
                          <TechnicalList
                            title="Suppressed coach actions"
                            items={draft.reviewerOnly?.auditTrace?.suppressedCoachActions || []}
                          />
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Confidence tier</p>
                            <input
                              value={draft.reviewerOnly?.evidence?.confidenceTier || ''}
                              onChange={(event) => updateReviewerOnly((reviewerOnly) => ({
                                ...reviewerOnly,
                                evidence: {
                                  ...reviewerOnly.evidence,
                                  confidenceTier: event.target.value as CoachReportReviewerOnly['evidence']['confidenceTier'],
                                },
                              }))}
                              className="mt-3 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-200"
                            />
                          </div>
                          <ArrayTextarea
                            title="Manual missing inputs"
                            values={draft.reviewerOnly?.evidence?.missingInputs || []}
                            onChange={(values) => updateReviewerOnly((reviewerOnly) => ({
                              ...reviewerOnly,
                              evidence: { ...reviewerOnly.evidence, missingInputs: values },
                            }))}
                          />
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Localization audit</p>
                            <div className="mt-3">
                              {draft.reviewerOnly?.auditTrace?.localizationAuditResult?.passed ? (
                                <Chip tone="green">Passed</Chip>
                              ) : (
                                <Chip tone="red">Blocked</Chip>
                              )}
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                              {(draft.reviewerOnly?.auditTrace?.localizationAuditResult?.violations || []).map((violation, index) => (
                                <li key={`${violation.phrase}-${index}`}>
                                  <span className="text-red-200">{violation.phrase}</span>
                                  <span className="text-zinc-600"> / {violation.source || 'sport'}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </section>
                    </aside>
                  </div>
                </>
              )}
            </main>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default SportsIntelligenceReportsAdminPage;
