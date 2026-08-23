import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  FileJson,
  FlaskConical,
  Gavel,
  LockKeyhole,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { auth } from '../../../api/firebase/config';
import { NORA_RED_TEAM_SCENARIOS } from '../../../lib/nora-red-team/scenarios';
import type {
  NoraRedTeamAgentTrace,
  NoraRedTeamDimension,
  NoraRedTeamRun,
  NoraRedTeamScenario,
  NoraRedTeamSeverity,
  NoraRedTeamVerdict,
} from '../../../lib/nora-red-team/types';
import {
  NORA_RED_TEAM_CONTRACT_VERSION,
  NORA_RED_TEAM_VERSION,
} from '../../../lib/nora-red-team/types';

type RiskFilter = 'all' | 'critical' | 'major' | 'minor';

const SEVERITY_STYLE: Record<NoraRedTeamSeverity, string> = {
  none: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200',
  minor: 'border-sky-500/35 bg-sky-500/10 text-sky-200',
  major: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
  critical: 'border-red-500/40 bg-red-500/10 text-red-200',
};

const VERDICT_STYLE: Record<NoraRedTeamVerdict, string> = {
  pass: 'border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-100',
  fail: 'border-red-500/45 bg-red-500/[0.08] text-red-100',
  review: 'border-amber-500/45 bg-amber-500/[0.08] text-amber-100',
};

const DIMENSION_LABELS: Array<{
  key: keyof NoraRedTeamRun['judge']['dimensionScores'];
  label: string;
  dimension: NoraRedTeamDimension;
}> = [
  { key: 'laneChoice', label: 'Lane choice', dimension: 'lane_choice' },
  { key: 'safety', label: 'Safety', dimension: 'safety' },
  { key: 'privacy', label: 'Privacy', dimension: 'privacy' },
  { key: 'toolTruthfulness', label: 'Tool truthfulness', dimension: 'tool_truthfulness' },
  { key: 'voice', label: 'Voice', dimension: 'voice' },
];

const ROLE_META: Record<NoraRedTeamAgentTrace['role'], {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  scenario_generator: { label: 'Scenario', icon: FileJson },
  attacker: { label: 'Attacker', icon: ShieldAlert },
  athlete_simulator: { label: 'Athlete', icon: UserRound },
  nora_target: { label: 'Nora', icon: Bot },
  judge: { label: 'Judge', icon: Gavel },
  adjudicator: { label: 'Adjudicator', icon: ShieldCheck },
  human_reviewer: { label: 'Human review', icon: UserCheck },
};

function createRandomSeed(): number {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return (values[0] % 2_147_483_646) + 1;
  }
  return Math.floor(Math.random() * 2_147_483_646) + 1;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 0 : 1)} s`;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function verdictIcon(verdict: NoraRedTeamVerdict) {
  if (verdict === 'pass') return CheckCircle2;
  if (verdict === 'fail') return XCircle;
  return AlertTriangle;
}

function scenarioStatus(
  scenarioId: string,
  runs: Record<string, NoraRedTeamRun>,
  runningScenarioId: string | null,
): { label: string; className: string; icon: React.ComponentType<{ className?: string }> } {
  if (runningScenarioId === scenarioId) {
    return {
      label: 'Running',
      className: 'text-cyan-300',
      icon: RefreshCw,
    };
  }
  const run = runs[scenarioId];
  if (!run) return { label: 'Not run', className: 'text-zinc-500', icon: Circle };
  if (run.verdict === 'pass') return { label: 'Passed', className: 'text-emerald-300', icon: CheckCircle2 };
  if (run.verdict === 'fail') return { label: 'Failed', className: 'text-red-300', icon: XCircle };
  return { label: 'Review', className: 'text-amber-300', icon: AlertTriangle };
}

const NoraRedTeamConsole: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState(NORA_RED_TEAM_SCENARIOS[0].id);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [randomSeed, setRandomSeed] = useState(20_260_820);
  const [runs, setRuns] = useState<Record<string, NoraRedTeamRun>>({});
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedScenario = useMemo(
    () => NORA_RED_TEAM_SCENARIOS.find((scenario) => scenario.id === selectedScenarioId) || NORA_RED_TEAM_SCENARIOS[0],
    [selectedScenarioId],
  );
  const selectedRun = runs[selectedScenario.id] || null;
  const filteredScenarios = useMemo(
    () => NORA_RED_TEAM_SCENARIOS.filter((scenario) => riskFilter === 'all' || scenario.risk === riskFilter),
    [riskFilter],
  );
  const completedRuns = Object.values(runs);
  const passedRuns = completedRuns.filter((run) => run.verdict === 'pass').length;
  const criticalBlockers = completedRuns.filter((run) => run.releaseBlocking).length;
  const reviewCount = completedRuns.filter(
    (run) => run.humanReview.status === 'pending' || run.humanReview.status === 'inconclusive',
  ).length;

  const changeRiskFilter = (filter: RiskFilter) => {
    setRiskFilter(filter);
    if (filter === 'all' || selectedScenario.risk === filter) return;
    const firstMatch = NORA_RED_TEAM_SCENARIOS.find((scenario) => scenario.risk === filter);
    if (firstMatch) setSelectedScenarioId(firstMatch.id);
  };

  const runScenario = async () => {
    if (runningScenarioId) return;
    setError(null);
    setRunningScenarioId(selectedScenario.id);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Your admin session is not available. Sign in again.');
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/pulsecheck/nora-red-team/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          ...(currentUser.email ? { 'x-admin-email': currentUser.email } : {}),
        },
        body: JSON.stringify({
          scenarioId: selectedScenario.id,
          randomSeed,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        run?: NoraRedTeamRun;
        error?: string;
      } | null;
      if (!response.ok || !payload?.run) {
        throw new Error(payload?.error || 'The red-team run could not be completed.');
      }
      setRuns((current) => ({ ...current, [selectedScenario.id]: payload.run! }));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'The red-team run could not be completed.');
    } finally {
      setRunningScenarioId(null);
    }
  };

  const exportEvidence = () => {
    if (!completedRuns.length) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      version: NORA_RED_TEAM_VERSION,
      contractVersion: NORA_RED_TEAM_CONTRACT_VERSION,
      runCount: completedRuns.length,
      runs: completedRuns,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nora-red-team-v0-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const clearEvidence = () => {
    if (!completedRuns.length) return;
    if (!window.confirm('Clear all red-team results from this page? Export first if you need to keep them.')) return;
    setRuns({});
    setError(null);
  };

  const recordHumanReview = (runId: string, status: 'confirmed' | 'inconclusive') => {
    setRuns((current) => Object.fromEntries(
      Object.entries(current).map(([scenarioId, run]) => {
        if (run.runId !== runId) return [scenarioId, run];
        return [scenarioId, {
          ...run,
          humanReview: {
            status,
            reviewedAt: new Date().toISOString(),
          },
          agentTrace: run.agentTrace.map((trace) => trace.role === 'human_reviewer'
            ? {
                ...trace,
                status: 'completed' as const,
                summary: status === 'confirmed'
                  ? 'A human reviewer confirmed the recorded finding.'
                  : 'A human reviewer marked the result inconclusive for follow-up.',
              }
            : trace),
        }];
      }),
    ));
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-zinc-100">
      <header className="border-b border-zinc-800 bg-[#0c0f15]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/admin"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            aria-label="Back to admin"
            title="Back to admin"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-white sm:text-2xl">Nora Red Team</h1>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-200">
                v{NORA_RED_TEAM_VERSION}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Contract {NORA_RED_TEAM_CONTRACT_VERSION} | Synthetic data | Session only | No production writes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/systemOverview#pulsecheck-nora-chat-contract"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              <LockKeyhole className="h-4 w-4" />
              <span className="hidden sm:inline">Contract</span>
            </Link>
            <button
              type="button"
              onClick={exportEvidence}
              disabled={!completedRuns.length}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Export evidence"
              title="Export evidence"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={clearEvidence}
              disabled={!completedRuns.length}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-red-500/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Clear session results"
              title="Clear session results"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-800 bg-[#0b0e13]">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 divide-x divide-zinc-800 sm:grid-cols-4">
          <Metric label="Scenario families" value={String(NORA_RED_TEAM_SCENARIOS.length)} detail="Contract coverage" />
          <Metric label="Completed" value={`${completedRuns.length}/${NORA_RED_TEAM_SCENARIOS.length}`} detail={`${passedRuns} passed`} />
          <Metric label="Critical blockers" value={String(criticalBlockers)} detail="Release gate" tone={criticalBlockers ? 'red' : 'green'} />
          <Metric label="Human review" value={String(reviewCount)} detail="Open decisions" tone={reviewCount ? 'amber' : 'zinc'} />
        </div>
      </section>

      <div className="mx-auto grid max-w-[1600px] lg:min-h-[calc(100vh-153px)] lg:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="border-b border-zinc-800 bg-[#0c0f15] lg:border-b-0 lg:border-r">
          <div className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0c0f15] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">Scenario queue</p>
                <p className="mt-0.5 text-sm text-zinc-300">{filteredScenarios.length} shown</p>
              </div>
              <FlaskConical className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-3 grid grid-cols-4 rounded-md border border-zinc-700 bg-zinc-950 p-1" role="group" aria-label="Filter by risk">
              {(['all', 'critical', 'major', 'minor'] as RiskFilter[]).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  onClick={() => changeRiskFilter(filter)}
                  aria-pressed={riskFilter === filter}
                  className={`min-w-0 rounded px-1.5 py-1.5 text-xs capitalize transition ${
                    riskFilter === filter
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <label className="mt-3 block lg:hidden">
              <span className="sr-only">Selected red-team scenario</span>
              <select
                value={selectedScenario.id}
                onChange={(event) => setSelectedScenarioId(event.target.value)}
                className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-cyan-500"
              >
                {filteredScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {String(NORA_RED_TEAM_SCENARIOS.indexOf(scenario) + 1).padStart(2, '0')} | {scenario.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="hidden divide-y divide-zinc-800/80 lg:block">
            {filteredScenarios.map((scenario) => (
              <ScenarioRow
                key={scenario.id}
                scenario={scenario}
                index={NORA_RED_TEAM_SCENARIOS.indexOf(scenario) + 1}
                selected={scenario.id === selectedScenario.id}
                status={scenarioStatus(scenario.id, runs, runningScenarioId)}
                onSelect={() => setSelectedScenarioId(scenario.id)}
              />
            ))}
          </div>
        </aside>

        <main className="min-w-0 bg-[#090b10]">
          <ScenarioHeader
            scenario={selectedScenario}
            run={selectedRun}
            randomSeed={randomSeed}
            running={runningScenarioId === selectedScenario.id}
            anotherRunActive={Boolean(runningScenarioId && runningScenarioId !== selectedScenario.id)}
            onSeedChange={setRandomSeed}
            onRefreshSeed={() => setRandomSeed(createRandomSeed())}
            onRun={runScenario}
          />

          {error && (
            <div className="mx-4 mt-4 flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100 sm:mx-6">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-red-300 hover:text-white"
                aria-label="Dismiss error"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {selectedRun ? (
            <RunEvidence run={selectedRun} onHumanReview={recordHumanReview} />
          ) : (
            <ScenarioPreview scenario={selectedScenario} running={runningScenarioId === selectedScenario.id} />
          )}
        </main>
      </div>
    </div>
  );
};

const Metric: React.FC<{
  label: string;
  value: string;
  detail: string;
  tone?: 'zinc' | 'green' | 'amber' | 'red';
}> = ({ label, value, detail, tone = 'zinc' }) => {
  const valueColor = {
    zinc: 'text-white',
    green: 'text-emerald-300',
    amber: 'text-amber-300',
    red: 'text-red-300',
  }[tone];
  return (
    <div className="min-w-0 px-4 py-3 sm:px-6">
      <p className="truncate text-[11px] font-medium uppercase text-zinc-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-xl font-semibold ${valueColor}`}>{value}</span>
        <span className="truncate text-xs text-zinc-600">{detail}</span>
      </div>
    </div>
  );
};

const ScenarioRow: React.FC<{
  scenario: NoraRedTeamScenario;
  index: number;
  selected: boolean;
  status: { label: string; className: string; icon: React.ComponentType<{ className?: string }> };
  onSelect: () => void;
}> = ({ scenario, index, selected, status, onSelect }) => {
  const StatusIcon = status.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full min-w-0 items-start gap-3 px-4 py-3.5 text-left transition ${
        selected ? 'bg-zinc-800/70' : 'hover:bg-zinc-900/70'
      }`}
    >
      <span className="mt-0.5 w-6 shrink-0 font-mono text-xs text-zinc-600">{String(index).padStart(2, '0')}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">{scenario.familyLabel}</span>
          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLE[scenario.risk]}`}>
            {scenario.risk}
          </span>
        </span>
        <span className="mt-1 block text-sm font-medium leading-5 text-zinc-100">{scenario.title}</span>
        <span className={`mt-1.5 flex items-center gap-1.5 text-xs ${status.className}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${status.label === 'Running' ? 'animate-spin' : ''}`} />
          {status.label}
        </span>
      </span>
      <ChevronRight className={`mt-5 h-4 w-4 shrink-0 ${selected ? 'text-cyan-300' : 'text-zinc-700 group-hover:text-zinc-500'}`} />
    </button>
  );
};

const ScenarioHeader: React.FC<{
  scenario: NoraRedTeamScenario;
  run: NoraRedTeamRun | null;
  randomSeed: number;
  running: boolean;
  anotherRunActive: boolean;
  onSeedChange: (value: number) => void;
  onRefreshSeed: () => void;
  onRun: () => void;
}> = ({ scenario, run, randomSeed, running, anotherRunActive, onSeedChange, onRefreshSeed, onRun }) => (
  <div className="border-b border-zinc-800 bg-[#0b0e13] px-4 py-5 sm:px-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${SEVERITY_STYLE[scenario.risk]}`}>
            {scenario.risk} risk
          </span>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300">
            Expected lane: {scenario.expectedLane.replace(/_/g, ' ')}
          </span>
          {run && (
            <span className="text-xs text-zinc-500">Last run {formatTimestamp(run.completedAt)}</span>
          )}
        </div>
        <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">{scenario.title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{scenario.description}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase text-zinc-500">Random seed</span>
          <span className="flex h-10 overflow-hidden rounded-md border border-zinc-700 bg-zinc-950">
            <input
              type="number"
              min={1}
              max={2_147_483_647}
              value={randomSeed}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isSafeInteger(next)) onSeedChange(Math.max(1, Math.min(2_147_483_647, next)));
              }}
              className="w-32 bg-transparent px-3 text-sm text-zinc-200 outline-none"
              aria-label="Random seed"
            />
            <button
              type="button"
              onClick={onRefreshSeed}
              disabled={running || anotherRunActive}
              className="flex w-10 items-center justify-center border-l border-zinc-700 text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-40"
              aria-label="Generate a new random seed"
              title="New seed"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </span>
        </label>
        <button
          type="button"
          onClick={onRun}
          disabled={running || anotherRunActive}
          className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-md bg-[#d7ff00] px-4 text-sm font-semibold text-black transition hover:bg-[#e3ff55] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
          {running ? 'Running scenario' : run ? 'Run again' : 'Run scenario'}
        </button>
      </div>
    </div>
  </div>
);

const ScenarioPreview: React.FC<{ scenario: NoraRedTeamScenario; running: boolean }> = ({ scenario, running }) => (
  <div className="px-4 py-6 sm:px-6">
    {running && (
      <div className="mb-6 flex items-center gap-3 rounded-md border border-cyan-500/35 bg-cyan-500/[0.06] px-4 py-3 text-sm text-cyan-100">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>The bounded agent run is in progress. Nothing has been saved.</span>
      </div>
    )}
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
      <div className="min-w-0 space-y-8">
        <PreviewSection title="Opening athlete message" icon={UserRound}>
          <blockquote className="border-l-2 border-cyan-400 pl-4 text-base leading-7 text-zinc-200">
            {scenario.seedAthleteMessage}
          </blockquote>
        </PreviewSection>

        <PreviewSection title="Attack objective" icon={ShieldAlert}>
          <p className="text-sm leading-6 text-zinc-300">{scenario.attackGoal}</p>
        </PreviewSection>

        <PreviewSection title="Contract rules under test" icon={LockKeyhole}>
          <ul className="divide-y divide-zinc-800 border-y border-zinc-800">
            {scenario.contractRules.map((rule) => (
              <li key={rule} className="flex gap-3 py-3 text-sm leading-6 text-zinc-300">
                <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                {rule}
              </li>
            ))}
          </ul>
        </PreviewSection>
      </div>

      <div className="min-w-0 space-y-8">
        <PreviewSection title="Synthetic context" icon={Sparkles}>
          <p className="text-sm leading-6 text-zinc-400">{scenario.syntheticContext}</p>
        </PreviewSection>

        <PreviewSection title="Deterministic checks" icon={ShieldCheck}>
          <div className="divide-y divide-zinc-800 border-y border-zinc-800">
            {scenario.checks.map((check) => (
              <div key={check.id} className="flex items-start gap-3 py-3">
                <span className={`mt-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLE[check.severity]}`}>
                  {check.severity}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">{check.label}</p>
                  <p className="mt-0.5 text-xs text-zinc-600">{check.dimension.replace(/_/g, ' ')}</p>
                </div>
              </div>
            ))}
          </div>
        </PreviewSection>
      </div>
    </div>
  </div>
);

const PreviewSection: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}> = ({ title, icon: Icon, children }) => (
  <section>
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-zinc-500" />
      <h3 className="text-xs font-semibold uppercase text-zinc-400">{title}</h3>
    </div>
    {children}
  </section>
);

const RunEvidence: React.FC<{
  run: NoraRedTeamRun;
  onHumanReview: (runId: string, status: 'confirmed' | 'inconclusive') => void;
}> = ({ run, onHumanReview }) => {
  const VerdictIcon = verdictIcon(run.verdict);
  return (
    <div className="px-4 py-6 sm:px-6">
      <section className={`rounded-md border px-4 py-4 ${VERDICT_STYLE[run.verdict]}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <VerdictIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold capitalize">{run.verdict}</h3>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLE[run.severity]}`}>
                  {run.severity}
                </span>
                {run.releaseBlocking && (
                  <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-100">
                    Release blocker
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm leading-6 opacity-90">{run.judge.summary}</p>
            </div>
          </div>
          <dl className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-4 lg:grid-cols-2">
            <EvidenceDatum label="Run" value={run.runId.replace('nrt-', '').slice(0, 8)} mono />
            <EvidenceDatum label="Seed" value={String(run.randomSeed)} mono />
            <EvidenceDatum label="Duration" value={formatDuration(run.durationMs)} />
            <EvidenceDatum label="Tokens" value={run.usage.totalTokens.toLocaleString()} />
          </dl>
        </div>
      </section>

      <EvidenceSection title="Agent trace" icon={Sparkles}>
        <div className="grid overflow-hidden rounded-md border border-zinc-800 sm:grid-cols-2 xl:grid-cols-7">
          {run.agentTrace.map((trace) => (
            <AgentTraceCell key={trace.role} trace={trace} />
          ))}
        </div>
      </EvidenceSection>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="min-w-0">
          <EvidenceSection title="Conversation evidence" icon={Bot}>
            <div className="space-y-5">
              {run.turns.map((turn) => (
                <div key={turn.turn} className="border-l border-zinc-700 pl-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-mono">Turn {String(turn.turn).padStart(2, '0')}</span>
                    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-300">
                      {turn.lane.replace(/_/g, ' ')}
                    </span>
                    {turn.usedFallback && (
                      <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                        Guardrail fallback
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <TranscriptMessage role="Athlete" text={turn.athleteMessage} tone="athlete" />
                    <TranscriptMessage role="Nora" text={turn.noraResponse} tone="nora" />
                  </div>
                  {turn.guardrailIntervened && (
                    <p className="mt-2 text-xs text-amber-300">
                      Pre-delivery guardrail caught: {turn.preDeliveryFailureIds.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </EvidenceSection>

          <EvidenceSection title="Deterministic checks" icon={ShieldCheck}>
            <div className="overflow-hidden rounded-md border border-zinc-800">
              {run.checkResults.map((result) => (
                <div key={result.id} className="grid gap-2 border-t border-zinc-800 px-3 py-3 first:border-t-0 sm:grid-cols-[24px_minmax(180px,0.55fr)_minmax(0,1fr)] sm:items-start">
                  {result.passed
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    : <XCircle className="h-4 w-4 text-red-300" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{result.label}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">{result.dimension.replace(/_/g, ' ')} | {result.severity}</p>
                  </div>
                  <p className="text-xs leading-5 text-zinc-500">{result.evidence}</p>
                </div>
              ))}
            </div>
          </EvidenceSection>
        </div>

        <div className="min-w-0">
          <EvidenceSection title="Judge scores" icon={Gavel}>
            <div className="space-y-3">
              {DIMENSION_LABELS.map(({ key, label }) => {
                const score = run.judge.dimensionScores[key];
                const barColor = score >= 85 ? 'bg-emerald-400' : score >= 70 ? 'bg-amber-400' : 'bg-red-400';
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-zinc-400">{label}</span>
                      <span className="font-mono text-zinc-300">{score}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs">
                <span className="text-zinc-500">Judge confidence</span>
                <span className="font-mono text-zinc-300">{Math.round(run.judge.confidence * 100)}%</span>
              </div>
            </div>
          </EvidenceSection>

          <EvidenceSection title="Findings" icon={AlertTriangle}>
            {run.judge.findings.length ? (
              <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                {run.judge.findings.map((finding, index) => (
                  <div key={`${finding.title}-${index}`} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLE[finding.severity]}`}>
                        {finding.severity}
                      </span>
                      <p className="text-sm font-medium text-zinc-200">{finding.title}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">{finding.evidence}</p>
                    <p className="mt-1 text-[11px] leading-5 text-zinc-600">{finding.contractRule}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 border-y border-zinc-800 py-4 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                No judge findings.
              </div>
            )}
          </EvidenceSection>

          <EvidenceSection title="Decision record" icon={UserCheck}>
            <dl className="divide-y divide-zinc-800 border-y border-zinc-800 text-sm">
              <DecisionRow label="Adjudication" value={run.adjudication ? run.adjudication.decision.replace(/_/g, ' ') : 'Not required'} />
              <DecisionRow
                label="Human review"
                value={run.humanReview.status.replace(/_/g, ' ')}
                tone={run.humanReview.status === 'confirmed' || run.humanReview.status === 'not_required' ? 'green' : 'amber'}
              />
              <DecisionRow label="Production writes" value="Blocked" tone="green" />
              <DecisionRow label="Application storage" value="Off" tone="green" />
              <DecisionRow label="OpenAI response storage" value="Off" tone="green" />
            </dl>
            {run.adjudication && (
              <p className="mt-3 text-xs leading-5 text-zinc-500">{run.adjudication.rationale}</p>
            )}
            {run.humanReviewRequired && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onHumanReview(run.runId, 'confirmed')}
                  className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${
                    run.humanReview.status === 'confirmed'
                      ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-100'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm finding
                </button>
                <button
                  type="button"
                  onClick={() => onHumanReview(run.runId, 'inconclusive')}
                  className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${
                    run.humanReview.status === 'inconclusive'
                      ? 'border-amber-400/50 bg-amber-400/15 text-amber-100'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-amber-500/50 hover:text-amber-200'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Inconclusive
                </button>
              </div>
            )}
          </EvidenceSection>
        </div>
      </div>
    </div>
  );
};

const EvidenceSection: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}> = ({ title, icon: Icon, children }) => (
  <section className="mt-8 border-t border-zinc-800 pt-5">
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-zinc-500" />
      <h3 className="text-xs font-semibold uppercase text-zinc-400">{title}</h3>
    </div>
    {children}
  </section>
);

const AgentTraceCell: React.FC<{ trace: NoraRedTeamAgentTrace }> = ({ trace }) => {
  const meta = ROLE_META[trace.role];
  const Icon = meta.icon;
  const statusColor = trace.status === 'completed'
    ? 'text-emerald-300'
    : trace.status === 'required'
      ? 'text-amber-300'
      : 'text-zinc-600';
  return (
    <div className="min-w-0 border-t border-zinc-800 px-3 py-3 first:border-t-0 sm:border-l sm:first:border-l-0 sm:[&:nth-child(-n+2)]:border-t-0 xl:border-t-0">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${statusColor}`} />
        <p className="truncate text-xs font-medium text-zinc-200">{meta.label}</p>
      </div>
      <p className={`mt-1 text-[10px] uppercase ${statusColor}`}>{trace.status.replace(/_/g, ' ')}</p>
      <p className="mt-1 truncate text-[10px] text-zinc-600">
        {trace.model || trace.mode} | {formatDuration(trace.durationMs)}
      </p>
    </div>
  );
};

const TranscriptMessage: React.FC<{
  role: string;
  text: string;
  tone: 'athlete' | 'nora';
}> = ({ role, text, tone }) => (
  <div className={`min-w-0 rounded-md border px-3 py-3 ${
    tone === 'athlete'
      ? 'border-sky-500/25 bg-sky-500/[0.05]'
      : 'border-emerald-500/25 bg-emerald-500/[0.05]'
  }`}>
    <p className={`text-[10px] font-semibold uppercase ${tone === 'athlete' ? 'text-sky-300' : 'text-emerald-300'}`}>
      {role}
    </p>
    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{text}</p>
  </div>
);

const EvidenceDatum: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <dt className="text-[10px] uppercase opacity-60">{label}</dt>
    <dd className={`mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</dd>
  </div>
);

const DecisionRow: React.FC<{
  label: string;
  value: string;
  tone?: 'zinc' | 'green' | 'amber';
}> = ({ label, value, tone = 'zinc' }) => (
  <div className="flex items-center justify-between gap-4 py-2.5">
    <dt className="text-zinc-500">{label}</dt>
    <dd className={tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-zinc-300'}>
      {value}
    </dd>
  </div>
);

export default NoraRedTeamConsole;
