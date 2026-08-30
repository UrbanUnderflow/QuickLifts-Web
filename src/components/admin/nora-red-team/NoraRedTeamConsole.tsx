import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  BookmarkPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  Eye,
  FileJson,
  FlaskConical,
  Gavel,
  History,
  LockKeyhole,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  UserCheck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { auth, getFirebaseModeRequestHeaders, isUsingDevFirebase } from '../../../api/firebase/config';
import { EscalationCategory, EscalationTier } from '../../../api/firebase/escalation/types';
import EscalationModal, { type EscalationSupportOption } from '../../pulsecheck/EscalationModal';
import { NORA_RED_TEAM_SCENARIOS } from '../../../lib/nora-red-team/scenarios';
import type {
  NoraRedTeamAgentTrace,
  NoraRedTeamDimension,
  NoraRedTeamHistoryRecord,
  NoraRedTeamJob,
  NoraRedTeamRun,
  NoraRedTeamScenario,
  NoraRedTeamSeverity,
  NoraRedTeamSuiteRecord,
  NoraRedTeamTarget,
  NoraRedTeamTurn,
  NoraRedTeamVerdict,
} from '../../../lib/nora-red-team/types';
import {
  NORA_RED_TEAM_CONTRACT_VERSION,
  NORA_RED_TEAM_VERSION,
} from '../../../lib/nora-red-team/types';

type RiskFilter = 'all' | 'critical' | 'major' | 'minor';
type RunLogLevel = 'info' | 'success' | 'warning' | 'error';

type RunLogEntry = {
  id: string;
  timestamp: string;
  level: RunLogLevel;
  message: string;
  detail?: string;
};

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
  safety_classifier: { label: 'Safety check', icon: ShieldCheck },
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

function createLogId(): string {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `log-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 0 : 1)} s`;
}

function formatLogTimestamp(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function explainRunError(code: string | undefined, fallback: string | undefined, status?: number): string {
  if (code === 'AI_PROVIDER_NOT_CONFIGURED') {
    return 'The OpenAI bridge is not available for this run. Refresh and try again, or check the bridge console entry below.';
  }
  if (code === 'AI_BRIDGE_UNAVAILABLE') return 'The OpenAI bridge could not complete this run. No result was saved.';
  if (code === 'ESCALATION_POLICY_UNAVAILABLE') return 'The production escalation safety check is unavailable. No result was saved.';
  if (code === 'ADMIN_AUTH_REQUIRED') return 'Your admin session was not accepted. Sign in again, then rerun the scenario.';
  if (code === 'INVALID_SCENARIO') return 'The selected scenario was not recognized. Refresh the page and try again.';
  if (code === 'INVALID_RANDOM_SEED') return 'The random seed must be a positive whole number.';
  if (code === 'RED_TEAM_RUN_FAILED') return 'The agent run failed before a complete result was produced. No result was saved.';
  if (code === 'RED_TEAM_WORKER_UNAVAILABLE') return 'The background runner could not start. No model request was made.';
  if (code === 'NORA_RED_TEAM_REQUEST_TIMEOUT') return 'A model request timed out after the bounded retry. No result was saved.';
  if (code === 'NORA_RED_TEAM_TIME_LIMIT_EXCEEDED') return 'The run reached its time limit and stopped safely. No result was saved.';
  if (code === 'NORA_RED_TEAM_COST_LIMIT_EXCEEDED') return 'The run reached its cost limit and stopped safely. No result was saved.';
  if (code === 'STAGING_REQUIRES_DEVELOPMENT') return 'Switch the admin database selector to Development database before running the real staging chat.';
  if (code === 'STAGING_AUTH_UNAVAILABLE') return 'The signed synthetic staging account could not be created. Check the development Firebase configuration.';
  if (code === 'STAGING_ENDPOINT_OUTDATED') return 'The staging chat endpoint has not received the synthetic no-contact lock yet.';
  if (code === 'STAGING_CHAT_FAILED') return 'The real staging chat endpoint could not complete this scenario.';
  if (code === 'HISTORY_UNAVAILABLE') return 'Protected red-team history is temporarily unavailable.';
  if (code === 'JOB_EXPIRED') return 'The temporary run expired. Start the scenario again.';
  if (status === 500) return 'The server returned an unexpected 500 before sending run details. This is usually a timeout or server runtime error.';
  return fallback || 'The red-team run could not be completed.';
}

function waitForPoll(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function isActiveJob(job: NoraRedTeamJob | null): boolean {
  return Boolean(job && ['queued', 'running', 'cancelling'].includes(job.status));
}

function runStorageKey(target: NoraRedTeamTarget, scenarioId: string): string {
  return `${target}:${scenarioId}`;
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
  target: NoraRedTeamTarget,
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
  const run = runs[runStorageKey(target, scenarioId)];
  if (!run) return { label: 'Not run', className: 'text-zinc-500', icon: Circle };
  if (run.verdict === 'pass') return { label: 'Passed', className: 'text-emerald-300', icon: CheckCircle2 };
  if (run.verdict === 'fail') return { label: 'Failed', className: 'text-red-300', icon: XCircle };
  return { label: 'Review', className: 'text-amber-300', icon: AlertTriangle };
}

function previewTier2SupportOptions(turn: NoraRedTeamTurn | null): {
  options: EscalationSupportOption[];
  defaultOptionId: string;
  routeLocked: boolean;
} {
  if (!turn || turn.escalation.tier !== 2) {
    return { options: [], defaultOptionId: '', routeLocked: false };
  }
  const requiresClinicalRoute = turn.escalation.requiresClinicalHandoff
    || turn.escalation.classificationFamily === 'care_escalation';
  if (requiresClinicalRoute) {
    return {
      routeLocked: true,
      defaultOptionId: 'configured-clinical-support',
      options: [{
        id: 'configured-clinical-support',
        kind: 'configured_route',
        label: 'Care team',
        roleLabel: 'Licensed support path',
        description: 'PulseCheck will connect the athlete through the configured licensed support path.',
        route: 'clinician',
        selectable: true,
        default: true,
        locked: true,
      }],
    };
  }

  return {
    routeLocked: false,
    defaultOptionId: 'synthetic-athletic-trainer',
    options: [
      {
        id: 'synthetic-athletic-trainer',
        kind: 'staff',
        label: 'Athletic trainer',
        roleLabel: 'Athletic trainer',
        description: 'Synthetic red-team recipient. Production loads eligible team staff.',
        route: 'selected_staff',
        selectable: true,
        default: true,
      },
      {
        id: 'synthetic-coach',
        kind: 'staff',
        label: 'Coach',
        roleLabel: 'Coach',
        description: 'Synthetic red-team recipient. Production validates this against team access.',
        route: 'selected_staff',
        selectable: true,
      },
    ],
  };
}

const NoraRedTeamConsole: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState(NORA_RED_TEAM_SCENARIOS[0].id);
  const [target, setTarget] = useState<NoraRedTeamTarget>('policy_sandbox');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [randomSeed, setRandomSeed] = useState(20_260_820);
  const [runs, setRuns] = useState<Record<string, NoraRedTeamRun>>({});
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<NoraRedTeamJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<RunLogEntry[]>([]);
  const [history, setHistory] = useState<NoraRedTeamHistoryRecord[]>([]);
  const [latestSuite, setLatestSuite] = useState<NoraRedTeamSuiteRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const consoleInitialized = useRef(false);
  const developmentDatabase = isUsingDevFirebase();

  const selectedScenario = useMemo(
    () => NORA_RED_TEAM_SCENARIOS.find((scenario) => scenario.id === selectedScenarioId) || NORA_RED_TEAM_SCENARIOS[0],
    [selectedScenarioId],
  );
  const selectedRun = runs[runStorageKey(target, selectedScenario.id)] || null;
  const selectedJob = activeJob?.scenarioId === selectedScenario.id && activeJob.target === target ? activeJob : null;
  const filteredScenarios = useMemo(
    () => NORA_RED_TEAM_SCENARIOS.filter((scenario) => riskFilter === 'all' || scenario.risk === riskFilter),
    [riskFilter],
  );
  const completedRuns = Object.values(runs).filter((run) => (
    target === 'staging_chat'
      ? run.platform === 'web-staging-chat'
      : run.platform === 'web-admin-policy-sandbox'
  ));
  const scenarioFamilyCount = new Set(NORA_RED_TEAM_SCENARIOS.map((scenario) => scenario.familyId)).size;
  const passedRuns = completedRuns.filter((run) => run.verdict === 'pass').length;
  const durableCriticalBlockers = history.filter((record) => (
    record.releaseStatus === 'blocking' && record.run.releaseBlocking && record.run.severity === 'critical'
  )).length;
  const promotedRegressionCount = history.filter((record) => record.promotedRegression).length;

  const appendLog = useCallback((level: RunLogLevel, message: string, detail?: string) => {
    setRunLogs((current) => [
      {
        id: createLogId(),
        timestamp: new Date().toISOString(),
        level,
        message,
        detail,
      },
      ...current,
    ].slice(0, 80));
  }, []);

  const loadHistory = useCallback(async (quiet = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setHistoryLoading(true);
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/pulsecheck/nora-red-team/history?limit=100', {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...getFirebaseModeRequestHeaders(),
          ...(currentUser.email ? { 'x-admin-email': currentUser.email } : {}),
        },
      });
      const payload = await response.json().catch(() => null) as {
        history?: NoraRedTeamHistoryRecord[];
        latestSuite?: NoraRedTeamSuiteRecord | null;
        error?: string;
      } | null;
      if (!response.ok || !payload?.history) {
        throw new Error(payload?.error || 'Protected history could not be loaded.');
      }
      setHistory(payload.history);
      setLatestSuite(payload.latestSuite || null);
      if (!quiet) appendLog('success', 'Protected history loaded', `${payload.history.length} durable run records are available.`);
    } catch (historyError) {
      if (!quiet) {
        appendLog('warning', 'Protected history unavailable', historyError instanceof Error ? historyError.message : String(historyError));
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [appendLog]);

  useEffect(() => {
    if (consoleInitialized.current) return;
    consoleInitialized.current = true;
    appendLog('info', 'Console ready', 'Browser evidence is session only. Deployed background status expires after two hours. No auth token or athlete-data write is stored.');
  }, [appendLog]);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    if (currentUser) void loadHistory(true);
  }), [loadHistory]);

  const changeRiskFilter = (filter: RiskFilter) => {
    setRiskFilter(filter);
    appendLog('info', `Scenario filter changed to ${filter}.`);
    if (filter === 'all' || selectedScenario.risk === filter) return;
    const firstMatch = NORA_RED_TEAM_SCENARIOS.find((scenario) => scenario.risk === filter);
    if (firstMatch) setSelectedScenarioId(firstMatch.id);
  };

  const selectScenario = (scenarioId: string) => {
    const scenario = NORA_RED_TEAM_SCENARIOS.find((item) => item.id === scenarioId);
    setSelectedScenarioId(scenarioId);
    if (scenario) appendLog('info', `Selected scenario: ${scenario.title}`, `Risk: ${scenario.risk}. Expected lane: ${scenario.expectedLane}.`);
  };

  const runScenario = async () => {
    if (runningScenarioId) return;
    const scenarioForRun = selectedScenario;
    const targetForRun = target;
    setError(null);
    setRunningScenarioId(scenarioForRun.id);
    const startedAt = Date.now();
    appendLog(
      'info',
      `Starting scenario: ${scenarioForRun.title}`,
      `Seed ${randomSeed}. Target: ${targetForRun === 'staging_chat' ? 'real development chat' : 'policy sandbox'}. Synthetic evidence only.`,
    );
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        appendLog('warning', 'Admin session missing', 'The browser does not have a signed-in Firebase admin user for this request.');
        throw new Error('Your admin session is not available. Sign in again.');
      }
      appendLog('success', 'Admin session found', 'Request will include a short-lived admin authorization token. The token is not logged.');
      const idToken = await currentUser.getIdToken();
      const requestHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...getFirebaseModeRequestHeaders(),
        ...(currentUser.email ? { 'x-admin-email': currentUser.email } : {}),
      };
      appendLog('info', 'Creating a bounded background run.');
      const response = await fetch('/api/admin/pulsecheck/nora-red-team/run', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          scenarioId: scenarioForRun.id,
          randomSeed,
          target: targetForRun,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        job?: NoraRedTeamJob;
        error?: string;
        code?: string;
        detail?: string;
      } | null;
      if (!response.ok || !payload?.job) {
        const explainedError = explainRunError(payload?.code, payload?.error, response.status);
        appendLog(
          'error',
          `Run stopped: ${payload?.code || response.status}`,
          `${explainedError} HTTP ${response.status}. Nothing was saved.${payload?.detail ? ` Detail: ${payload.detail}` : ''}`,
        );
        throw new Error(explainedError);
      }
      let job = payload.job;
      let lastStage = job.progress.stage;
      setActiveJob(job);
      appendLog(
        'success',
        'Background run accepted',
        `Time limit ${formatDuration(job.limits.maxDurationMs)}. ${job.limits.maxModelCalls} model calls, ${job.limits.maxRetriesPerRequest} retry per request, ${job.limits.maxTotalTokens.toLocaleString()} tokens maximum.`,
      );

      while (isActiveJob(job)) {
        await waitForPoll(900);
        const pollToken = await currentUser.getIdToken();
        const pollResponse = await fetch(
          `/api/admin/pulsecheck/nora-red-team/run?jobId=${encodeURIComponent(job.jobId)}`,
          {
            method: 'GET',
            headers: {
              ...requestHeaders,
              Authorization: `Bearer ${pollToken}`,
            },
          },
        );
        const pollPayload = await pollResponse.json().catch(() => null) as {
          job?: NoraRedTeamJob;
          error?: string;
          code?: string;
        } | null;
        if (!pollResponse.ok || !pollPayload?.job) {
          throw new Error(explainRunError(pollPayload?.code, pollPayload?.error, pollResponse.status));
        }
        job = pollPayload.job;
        setActiveJob(job);
        if (job.progress.stage !== lastStage) {
          lastStage = job.progress.stage;
          appendLog(
            job.status === 'cancelling' ? 'warning' : 'info',
            job.progress.message,
            `${job.progress.percent}% complete. ${job.progress.modelCalls}/${job.limits.maxModelCalls} model calls. ${job.progress.usage.totalTokens.toLocaleString()}/${job.limits.maxTotalTokens.toLocaleString()} tokens. ${job.progress.retryCount} retries.`,
          );
        }
      }

      if (job.status === 'cancelled') {
        appendLog('warning', 'Run cancelled', 'The active model request was stopped and no result was saved.');
        return;
      }
      if (job.status === 'failed' || !job.run) {
        const explainedError = explainRunError(job.error?.code, job.error?.message);
        appendLog('error', `Run stopped: ${job.error?.code || job.status}`, explainedError);
        throw new Error(explainedError);
      }

      setRuns((current) => ({
        ...current,
        [runStorageKey(targetForRun, scenarioForRun.id)]: job.run!,
      }));
      void loadHistory(true);
      appendLog(
        job.run.verdict === 'pass' ? 'success' : job.run.verdict === 'review' ? 'warning' : 'error',
        `Run completed: ${job.run.verdict}`,
        `Severity ${job.run.severity}. Highest escalation Tier ${Math.max(...job.run.turns.map((turn) => turn.escalation.tier))}. Duration ${formatDuration(job.run.durationMs)}. Tokens ${job.run.usage.totalTokens.toLocaleString()}.`,
      );
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : 'The red-team run could not be completed.';
      setError(message);
      appendLog('error', 'Scenario did not complete', `${message} Elapsed ${formatDuration(Date.now() - startedAt)}.`);
    } finally {
      setActiveJob(null);
      setRunningScenarioId(null);
      appendLog('info', 'Runner returned to idle.');
    }
  };

  const cancelScenario = async () => {
    if (!activeJob || !isActiveJob(activeJob)) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError('Your admin session is not available. Sign in again.');
      return;
    }
    appendLog('warning', 'Cancellation requested', 'Stopping the active model request.');
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(
        `/api/admin/pulsecheck/nora-red-team/run?jobId=${encodeURIComponent(activeJob.jobId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${idToken}`,
            ...getFirebaseModeRequestHeaders(),
            ...(currentUser.email ? { 'x-admin-email': currentUser.email } : {}),
          },
        },
      );
      const payload = await response.json().catch(() => null) as {
        job?: NoraRedTeamJob;
        error?: string;
        code?: string;
      } | null;
      if (!response.ok || !payload?.job) {
        throw new Error(explainRunError(payload?.code, payload?.error, response.status));
      }
      setActiveJob(payload.job);
    } catch (cancelError) {
      const message = cancelError instanceof Error ? cancelError.message : 'The run could not be cancelled.';
      setError(message);
      appendLog('error', 'Cancellation failed', message);
    }
  };

  const exportEvidence = () => {
    if (!completedRuns.length) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      version: NORA_RED_TEAM_VERSION,
      contractVersion: NORA_RED_TEAM_CONTRACT_VERSION,
      runCount: completedRuns.length,
      runLogs,
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
    appendLog('warning', 'Cleared session results', 'Completed run evidence was removed from this browser page.');
  };

  const clearLogs = () => {
    setRunLogs([]);
    appendLog('info', 'Console cleared.');
  };

  const recordHumanReview = async (runId: string, status: 'confirmed' | 'inconclusive') => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/pulsecheck/nora-red-team/history', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          ...getFirebaseModeRequestHeaders(),
          ...(currentUser.email ? { 'x-admin-email': currentUser.email } : {}),
        },
        body: JSON.stringify({ runId, status }),
      });
      const payload = await response.json().catch(() => null) as {
        history?: NoraRedTeamHistoryRecord;
        error?: string;
      } | null;
      if (!response.ok || !payload?.history) throw new Error(payload?.error || 'The review decision could not be saved.');
      setHistory((current) => current.map((record) => record.runId === runId ? payload.history! : record));
      setRuns((current) => Object.fromEntries(
        Object.entries(current).map(([key, run]) => [key, run.runId === runId ? payload.history!.run : run]),
      ));
      appendLog('success', 'Review decision saved', `${status === 'confirmed' ? 'Confirmed finding' : 'Marked inconclusive'} by ${currentUser.email || 'admin reviewer'}.`);
    } catch (reviewError) {
      const message = reviewError instanceof Error ? reviewError.message : String(reviewError);
      setError(message);
      appendLog('error', 'Review decision was not saved', message);
    }
  };

  const promoteRegression = async (run: NoraRedTeamRun) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/pulsecheck/nora-red-team/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          ...getFirebaseModeRequestHeaders(),
          ...(currentUser.email ? { 'x-admin-email': currentUser.email } : {}),
        },
        body: JSON.stringify({
          action: 'promote_regression',
          runId: run.runId,
          scenarioId: run.scenarioId,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || 'The regression case could not be saved.');
      setHistory((current) => current.map((record) => record.runId === run.runId
        ? {
            ...record,
            promotedRegression: true,
            promotedAt: new Date().toISOString(),
            promotedBy: currentUser.email || null,
          }
        : record));
      appendLog('success', 'Regression case promoted', `${run.scenarioTitle} is now part of the protected regression set.`);
    } catch (promoteError) {
      const message = promoteError instanceof Error ? promoteError.message : String(promoteError);
      setError(message);
      appendLog('error', 'Regression case was not saved', message);
    }
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
              Contract {NORA_RED_TEAM_CONTRACT_VERSION} | Synthetic evidence | Protected run history | No production athlete-data writes
            </p>
          </div>
          <div className="grid grid-cols-2 rounded-md border border-zinc-700 bg-zinc-950 p-1" role="group" aria-label="Red-team target">
            <button
              type="button"
              onClick={() => setTarget('policy_sandbox')}
              disabled={Boolean(runningScenarioId)}
              aria-pressed={target === 'policy_sandbox'}
              className={`h-8 rounded px-3 text-xs font-medium transition ${target === 'policy_sandbox' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Policy sandbox
            </button>
            <button
              type="button"
              onClick={() => setTarget('staging_chat')}
              disabled={Boolean(runningScenarioId) || !developmentDatabase}
              aria-pressed={target === 'staging_chat'}
              className={`h-8 rounded px-3 text-xs font-medium transition ${target === 'staging_chat' ? 'bg-cyan-700 text-white' : 'text-zinc-400 hover:text-white'} disabled:cursor-not-allowed disabled:opacity-35`}
              title={developmentDatabase ? 'Run through the real development chat endpoint' : 'Switch the admin banner to Development database first'}
            >
              Staging chat
            </button>
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
              onClick={() => {
                setHistoryOpen((current) => !current);
                if (!historyOpen) void loadHistory();
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-md border bg-zinc-900 transition ${historyOpen ? 'border-cyan-500/50 text-cyan-200' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'}`}
              aria-label="Run history"
              title="Run history"
            >
              <History className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
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
          <Metric label="Scenario families" value={String(scenarioFamilyCount)} detail={`${NORA_RED_TEAM_SCENARIOS.length} cases`} />
          <Metric label="Completed" value={`${completedRuns.length}/${NORA_RED_TEAM_SCENARIOS.length}`} detail={`${passedRuns} passed`} />
          <Metric label="Critical blockers" value={String(durableCriticalBlockers)} detail={latestSuite ? `Suite ${latestSuite.status}` : 'No scheduled suite'} tone={durableCriticalBlockers ? 'red' : 'green'} />
          <Metric label="Regression set" value={String(promotedRegressionCount)} detail="Promoted cases" tone={promotedRegressionCount ? 'amber' : 'zinc'} />
        </div>
      </section>

      {historyOpen && (
        <RunHistory history={history} latestSuite={latestSuite} loading={historyLoading} onSelect={(record) => {
          setTarget(record.run.platform === 'web-staging-chat' ? 'staging_chat' : 'policy_sandbox');
          setSelectedScenarioId(record.scenarioId);
          setRuns((current) => ({
            ...current,
            [runStorageKey(record.run.platform === 'web-staging-chat' ? 'staging_chat' : 'policy_sandbox', record.scenarioId)]: record.run,
          }));
        }} />
      )}

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
                onChange={(event) => selectScenario(event.target.value)}
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
                status={scenarioStatus(scenario.id, target, runs, runningScenarioId)}
                onSelect={() => selectScenario(scenario.id)}
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
            job={selectedJob}
            onSeedChange={setRandomSeed}
            onRefreshSeed={() => setRandomSeed(createRandomSeed())}
            onRun={runScenario}
            onCancel={cancelScenario}
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

          {selectedJob && <RunProgress job={selectedJob} />}

          {selectedRun ? (
            <RunEvidence
              run={selectedRun}
              onHumanReview={recordHumanReview}
              onPromoteRegression={promoteRegression}
              promotedRegression={history.some((record) => record.runId === selectedRun.runId && record.promotedRegression)}
            />
          ) : (
            <ScenarioPreview scenario={selectedScenario} />
          )}

          <RunConsole logs={runLogs} onClear={clearLogs} />
        </main>
      </div>
    </div>
  );
};

const RunHistory: React.FC<{
  history: NoraRedTeamHistoryRecord[];
  latestSuite: NoraRedTeamSuiteRecord | null;
  loading: boolean;
  onSelect: (record: NoraRedTeamHistoryRecord) => void;
}> = ({ history, latestSuite, loading, onSelect }) => (
  <section className="border-b border-zinc-800 bg-[#0c0f15]">
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">Protected run history</p>
          <p className="mt-1 text-sm text-zinc-300">Reviewer identity, release status, and promoted regressions</p>
        </div>
        <span className="font-mono text-xs text-zinc-500">{history.length} {history.length === 1 ? 'record' : 'records'}</span>
      </div>
      {latestSuite && (
        <div className="mt-4 grid border-y border-zinc-800 sm:grid-cols-4 sm:divide-x sm:divide-zinc-800">
          <SuiteValue label="Latest suite" value={latestSuite.status} />
          <SuiteValue label="Coverage" value={`${latestSuite.completedScenarioIds.length}/${latestSuite.scenarioIds.length}`} />
          <SuiteValue label="Result" value={`${latestSuite.passed} pass | ${latestSuite.failed} fail | ${latestSuite.review} review`} />
          <SuiteValue label="Completed" value={latestSuite.completedAt ? formatTimestamp(latestSuite.completedAt) : 'In progress'} />
        </div>
      )}
      {loading && !history.length ? (
        <div className="mt-4 border-y border-zinc-800 py-4 text-sm text-zinc-500">Loading protected history...</div>
      ) : history.length ? (
        <div className="mt-4 max-h-72 overflow-auto border-y border-zinc-800">
          {history.map((record) => {
            const RecordIcon = verdictIcon(record.verdict);
            return (
              <button
                type="button"
                key={record.runId}
                onClick={() => onSelect(record)}
                className="grid w-full gap-2 border-t border-zinc-800 px-2 py-3 text-left first:border-t-0 hover:bg-zinc-900 sm:grid-cols-[24px_minmax(220px,1fr)_120px_120px_150px] sm:items-center"
              >
                <RecordIcon className={`h-4 w-4 ${record.verdict === 'pass' ? 'text-emerald-300' : record.verdict === 'fail' ? 'text-red-300' : 'text-amber-300'}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-200">{record.scenarioTitle}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-600">{record.run.platform === 'web-staging-chat' ? 'Staging chat' : 'Policy sandbox'} | {record.ownerEmail}</span>
                </span>
                <span className={`text-xs capitalize ${record.releaseStatus === 'blocking' ? 'text-red-300' : record.releaseStatus === 'resolved' ? 'text-cyan-300' : 'text-emerald-300'}`}>
                  {record.releaseStatus}
                </span>
                <span className="text-xs text-zinc-400">{record.promotedRegression ? 'Regression' : 'Not promoted'}</span>
                <span className="text-xs text-zinc-500">{formatTimestamp(record.completedAt)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 border-y border-zinc-800 py-4 text-sm text-zinc-500">No durable runs have been recorded in this database yet.</div>
      )}
    </div>
  </section>
);

const SuiteValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0 px-3 py-3">
    <p className="text-[10px] font-medium uppercase text-zinc-600">{label}</p>
    <p className="mt-1 truncate text-xs capitalize text-zinc-300">{value}</p>
  </div>
);

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
  job: NoraRedTeamJob | null;
  onSeedChange: (value: number) => void;
  onRefreshSeed: () => void;
  onRun: () => void;
  onCancel: () => void;
}> = ({ scenario, run, randomSeed, running, anotherRunActive, job, onSeedChange, onRefreshSeed, onRun, onCancel }) => (
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
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300">
            Expected escalation: Tier {scenario.expectedEscalationTier}
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
        {running && job ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={job.status === 'cancelling'}
            className="inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-wait disabled:opacity-50"
          >
            {job.status === 'cancelling'
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Square className="h-3.5 w-3.5 fill-current" />}
            {job.status === 'cancelling' ? 'Stopping' : 'Stop run'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRun}
            disabled={anotherRunActive}
            className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-md bg-[#d7ff00] px-4 text-sm font-semibold text-black transition hover:bg-[#e3ff55] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Play className="h-4 w-4 fill-current" />
            {run ? 'Run again' : 'Run scenario'}
          </button>
        )}
      </div>
    </div>
  </div>
);

const RunProgress: React.FC<{ job: NoraRedTeamJob }> = ({ job }) => (
  <section
    className="border-b border-cyan-500/25 bg-cyan-500/[0.045] px-4 py-4 sm:px-6"
    aria-live="polite"
    aria-label="Red-team run progress"
  >
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 shrink-0 text-cyan-300 ${job.status === 'cancelling' ? '' : 'animate-spin'}`} />
          <p className="truncate text-sm font-medium text-cyan-100">{job.progress.message}</p>
          <span className="shrink-0 font-mono text-xs text-cyan-300">{job.progress.percent}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${job.status === 'cancelling' ? 'bg-amber-400' : 'bg-cyan-400'}`}
            style={{ width: `${job.progress.percent}%` }}
          />
        </div>
      </div>
      <dl className="grid shrink-0 grid-cols-3 gap-x-5 text-xs">
        <EvidenceDatum label="Model calls" value={`${job.progress.modelCalls}/${job.limits.maxModelCalls}`} mono />
        <EvidenceDatum label="Tokens" value={`${job.progress.usage.totalTokens.toLocaleString()}/${job.limits.maxTotalTokens.toLocaleString()}`} mono />
        <EvidenceDatum label="Retries" value={`${job.progress.retryCount} total`} mono />
      </dl>
    </div>
  </section>
);

const ScenarioPreview: React.FC<{ scenario: NoraRedTeamScenario }> = ({ scenario }) => (
  <div className="px-4 py-6 sm:px-6">
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

const EscalationEvidence: React.FC<{
  turn: NoraRedTeamTurn;
  onPreview: () => void;
}> = ({ turn, onPreview }) => {
  const escalation = turn.escalation;
  const tierTone = escalation.tier === 3
    ? 'border-red-500/40 bg-red-500/10 text-red-100'
    : escalation.tier === 2
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
      : escalation.tier === 1
        ? 'border-sky-500/35 bg-sky-500/10 text-sky-100'
        : 'border-zinc-700 bg-zinc-900 text-zinc-300';
  const workflow = escalation.tier === 3
    ? 'Safety mode and the configured clinical/safety handoff would start; coach notification would start.'
    : escalation.tier === 2
      ? 'A care record and consent modal would start the handoff workflow; no person is contacted until the athlete confirms.'
      : escalation.tier === 1
        ? 'Monitor-only classification; no athlete modal.'
        : 'No escalation record, modal, safety mode, or handoff.';

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-cyan-300" />
        <span className="text-xs font-medium text-zinc-300">Production safety check</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${tierTone}`}>
          Tier {escalation.tier}
        </span>
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
          Dry run
        </span>
        {escalation.modal !== 'none' && (
          <button
            type="button"
            onClick={onPreview}
            className="ml-auto inline-flex h-8 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 transition hover:border-cyan-500/50 hover:text-cyan-100"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview athlete modal
          </button>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-400">{workflow}</p>
      <p className="mt-1 break-words text-[11px] leading-5 text-zinc-600">
        {escalation.category.replace(/_/g, ' ')} | {escalation.classificationSource.replace(/_/g, ' ')} | {escalation.conditionCount} active conditions | {formatDuration(escalation.durationMs)}
      </p>
    </div>
  );
};

const RunEvidence: React.FC<{
  run: NoraRedTeamRun;
  onHumanReview: (runId: string, status: 'confirmed' | 'inconclusive') => Promise<void>;
  onPromoteRegression: (run: NoraRedTeamRun) => Promise<void>;
  promotedRegression: boolean;
}> = ({ run, onHumanReview, onPromoteRegression, promotedRegression }) => {
  const VerdictIcon = verdictIcon(run.verdict);
  const [previewTurnNumber, setPreviewTurnNumber] = useState<number | null>(null);
  const previewTurn = run.turns.find((turn) => turn.turn === previewTurnNumber) || null;
  const previewSupport = useMemo(() => previewTier2SupportOptions(previewTurn), [previewTurn]);
  const [previewSupportOptionId, setPreviewSupportOptionId] = useState('');

  useEffect(() => {
    setPreviewSupportOptionId(previewSupport.defaultOptionId);
  }, [previewSupport.defaultOptionId]);

  return (
    <>
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
        <div className="grid overflow-hidden rounded-md border border-zinc-800 sm:grid-cols-2 xl:grid-cols-8">
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
                  <EscalationEvidence turn={turn} onPreview={() => setPreviewTurnNumber(turn.turn)} />
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

          {run.stagingEvidence && (
            <EvidenceSection title="Staging workflow evidence" icon={FlaskConical}>
              <div className="grid gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-2">
                {[
                  { label: 'Anonymous request denied', passed: run.stagingEvidence.anonymousRequestDenied, applicable: true },
                  { label: 'Cross-account request denied', passed: run.stagingEvidence.crossAccountRequestDenied, applicable: true },
                  { label: 'Health snapshot read', passed: run.stagingEvidence.stateSnapshotRead, applicable: true },
                  { label: 'Conversation write observed', passed: run.stagingEvidence.conversationWriteObserved, applicable: true },
                  {
                    label: 'Escalation write observed',
                    passed: run.stagingEvidence.escalationRecordWriteObserved,
                    applicable: run.turns.some((turn) => turn.escalation.tier >= 2),
                  },
                  {
                    label: `Coach handoff writes observed (${run.stagingEvidence.coachHandoffWriteCount ?? 0})`,
                    passed: run.stagingEvidence.coachHandoffWriteObserved,
                    applicable: run.scenarioId === 'successful-action-confirmed' || run.stagingEvidence.coachHandoffWriteObserved,
                  },
                  {
                    label: 'Critical safety state observed',
                    passed: run.stagingEvidence.safetyStateWriteObserved,
                    applicable: run.turns.some((turn) => turn.escalation.tier === 3),
                  },
                  {
                    label: 'Tier 2 licensed-care route locked',
                    passed: run.stagingEvidence.tier2ClinicalRoutingLocked,
                    applicable: run.turns.some((turn) => turn.escalation.tier === 2),
                  },
                  { label: 'Synthetic cleanup completed', passed: run.stagingEvidence.cleanupCompleted, applicable: true },
                ].map(({ label, passed, applicable }) => (
                  <div key={label} className="flex items-center gap-2 bg-[#090b10] px-3 py-3 text-xs">
                    {!applicable
                      ? <Circle className="h-4 w-4 text-zinc-600" />
                      : passed
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        : <XCircle className="h-4 w-4 text-red-300" />}
                    <span className="min-w-0 flex-1 text-zinc-300">{label}</span>
                    <span className={applicable ? (passed ? 'text-emerald-300' : 'text-red-300') : 'text-zinc-600'}>
                      {applicable ? (passed ? 'Confirmed' : 'Missing') : 'Not exercised'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-zinc-600">External contact remained disabled for the entire staging run.</p>
            </EvidenceSection>
          )}

          <EvidenceSection title="Simulated tool outcomes" icon={FileJson}>
            {run.simulatedTools.length ? (
              <div className="overflow-hidden rounded-md border border-zinc-800">
                {run.simulatedTools.map((tool) => {
                  const outcomeTone = tool.outcome === 'succeeded'
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                    : tool.outcome === 'failed' || tool.outcome === 'blocked'
                      ? 'border-red-500/35 bg-red-500/10 text-red-200'
                      : 'border-amber-500/35 bg-amber-500/10 text-amber-200';
                  return (
                    <div key={`${tool.tool}-${tool.outcome}`} className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm text-zinc-200">{tool.tool}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${outcomeTone}`}>
                          {tool.outcome.replace(/_/g, ' ')}
                        </span>
                        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
                          zero side effects
                        </span>
                      </div>
                      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3 xl:grid-cols-6">
                        <EvidenceDatum label="Authorization" value={tool.authorization.replace(/_/g, ' ')} />
                        <EvidenceDatum label="Confirmation" value={tool.confirmation ? 'Verified' : 'None'} />
                        <EvidenceDatum label="Receipt" value={tool.confirmationId || 'None'} mono={Boolean(tool.confirmationId)} />
                        <EvidenceDatum label="Attempts" value={tool.attemptCount === undefined ? 'Not tracked' : String(tool.attemptCount)} mono={tool.attemptCount !== undefined} />
                        <EvidenceDatum label="Duplicate blocked" value={tool.duplicatePrevented === undefined ? 'Not applicable' : tool.duplicatePrevented ? 'Yes' : 'No'} />
                        <EvidenceDatum label="Idempotency key" value={tool.idempotencyKey || 'None'} mono={Boolean(tool.idempotencyKey)} />
                      </dl>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border-y border-zinc-800 py-4 text-sm text-zinc-500">No simulated tool was requested.</div>
            )}
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
              <DecisionRow label="Reviewer" value={run.humanReview.reviewerEmail || 'Not reviewed'} />
              <DecisionRow label="Athlete-data writes" value="None" tone="green" />
              <DecisionRow
                label="Run storage"
                value={run.evidencePolicy.persistenceScope === 'protected_history'
                  ? 'Protected history'
                  : run.evidencePolicy.applicationPersistence
                    ? 'Temporary job state'
                    : 'Session memory only'}
                tone="green"
              />
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
            <button
              type="button"
              onClick={() => void onPromoteRegression(run)}
              disabled={promotedRegression}
              className={`mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${promotedRegression ? 'border-cyan-400/45 bg-cyan-400/10 text-cyan-100' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-100'} disabled:cursor-default`}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              {promotedRegression ? 'Regression case saved' : 'Promote to regression'}
            </button>
          </EvidenceSection>
        </div>
      </div>
    </div>
    {previewTurn && previewTurn.escalation.modal !== 'none' && (
      <EscalationModal
        isOpen
        tier={previewTurn.escalation.tier as EscalationTier}
        category={previewTurn.escalation.category as EscalationCategory}
        reason={previewTurn.escalation.reason}
        handoffConfirmed={false}
        handoffStatus="simulation-only"
        supportOptions={previewSupport.options}
        selectedSupportOptionId={previewSupportOptionId}
        supportRouteLocked={previewSupport.routeLocked}
        onSelectSupportOption={setPreviewSupportOptionId}
        onAcceptConsent={async () => setPreviewTurnNumber(null)}
        onDeclineConsent={async () => setPreviewTurnNumber(null)}
        onClose={() => setPreviewTurnNumber(null)}
        previewMode
      />
    )}
    </>
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

const LOG_LEVEL_STYLE: Record<RunLogLevel, string> = {
  info: 'border-zinc-700 bg-zinc-800 text-zinc-300',
  success: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
  error: 'border-red-500/40 bg-red-500/10 text-red-200',
};

const RunConsole: React.FC<{
  logs: RunLogEntry[];
  onClear: () => void;
}> = ({ logs, onClear }) => (
  <section className="border-t border-zinc-800 bg-[#080a0f] px-4 py-5 sm:px-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Terminal className="h-4 w-4 text-cyan-300" />
        <h3 className="text-xs font-semibold uppercase text-zinc-400">Run console</h3>
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-500">
          Session only
        </span>
      </div>
      <button
        type="button"
        onClick={onClear}
        disabled={!logs.length}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
    <div className="max-h-72 overflow-auto rounded-md border border-zinc-800 bg-black/35 font-mono text-xs">
      {logs.length ? (
        <ol className="divide-y divide-zinc-900">
          {logs.map((log) => (
            <li key={log.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[96px_76px_minmax(0,1fr)]">
              <time className="text-zinc-600">{formatLogTimestamp(log.timestamp)}</time>
              <span className={`w-fit rounded border px-1.5 py-0.5 text-[10px] uppercase ${LOG_LEVEL_STYLE[log.level]}`}>
                {log.level}
              </span>
              <span className="min-w-0 text-zinc-300">
                <span className="break-words">{log.message}</span>
                {log.detail && <span className="mt-1 block break-words text-zinc-500">{log.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-3 py-4 text-zinc-600">No console entries for this browser session.</div>
      )}
    </div>
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
