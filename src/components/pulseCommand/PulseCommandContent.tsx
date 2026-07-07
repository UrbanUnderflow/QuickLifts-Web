import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminRouteGuard from '../auth/AdminRouteGuard';
import { db } from '../../api/firebase/config';
import { presenceService, type AgentPresence } from '../../api/firebase/presence/service';
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  Clock3,
  Database,
  FileText,
  Gauge,
  Inbox,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

type PulseCommandAgent = {
  id: string;
  displayName: string;
  role: string;
  focus: string;
  color: string;
  launchService?: string;
};

type PulseCommandTeam = {
  id: string;
  name: string;
  product: string;
  status: 'operating' | 'planning' | 'paused';
  defaultRoundtableId: string;
  missionId: string;
  northStarTitle: string;
  northStarSummary: string;
  primaryMetric: string;
  guardrails: string[];
  cadence: {
    daily: string[];
    weekly: string[];
  };
  sourceSurfaces: Array<{ label: string; href: string }>;
  agents: PulseCommandAgent[];
};

type MissionStatus = {
  status?: 'idle' | 'active' | 'paused';
  missionId?: string;
  northStarTitle?: string;
  missionSummary?: string;
  taskCount?: number;
  updatedAt?: unknown;
};

type AgentTask = {
  id: string;
  name: string;
  assignee?: string;
  status?: string;
  missionId?: string;
  project?: string;
  updatedAt?: unknown;
  objectiveCode?: string;
  northStarObjective?: string;
};

type OperatorMessage = {
  id: string;
  from: string;
  content: string;
  type?: string;
  operatorEvent?: string;
  operatorPriority?: string;
  operatorSummary?: string;
  taskName?: string;
  missionId?: string;
  requiresReply?: boolean;
  evidenceRefs?: string[];
  createdAt?: unknown;
};

type RoundtableMessage = {
  id: string;
  from: string;
  content: string;
  responses?: Record<string, { content?: string; status?: string }>;
  createdAt?: unknown;
};

type MacraOperatingRead = {
  generatedAt: string;
  targetDate: string;
  action: 'refresh_data_first' | 'hold_and_diagnose_checkout' | 'ready_for_one_controlled_change' | string;
  operatorSummary: string;
  blockers: string[];
  recommendedNextSteps: string[];
  scoreboard: {
    coverageStart?: string | null;
    coverageEnd?: string | null;
    importedAt?: string | null;
    freshness?: string;
    coverageLagDays?: number | null;
  };
  appsFlyer: {
    latestAggregatePeriod?: {
      startDate?: string | null;
      endDate?: string | null;
      funnelEvents?: Record<string, number>;
      mediaSourceEventVolume?: Record<string, number>;
    } | null;
  };
  experiment: {
    activeVariantId?: string;
    resultsGeneratedAt?: string | null;
    qualityLabel?: string;
    decisionGrade?: boolean;
  };
  lowerFunnel: {
    purchaseLogs: {
      total: number;
      byStatus: Record<string, number>;
      byDate: Record<string, number>;
    };
    cancelReasons: {
      total: number;
      byReason: Record<string, number>;
    };
    macraUsers: {
      total: number;
      completedOnboarding: number;
    };
  };
  systemHealth: {
    push: {
      successes: number;
      failures: number;
      failureCodes: Record<string, number>;
    };
    tasks: {
      byStatus: Record<string, number>;
      staleActive: Array<{ id: string; name: string; assignee: string; status: string; updatedAt?: string | null }>;
    };
  };
};

const MACRA_TEAM_FALLBACK: PulseCommandTeam = {
  id: 'macra-growth',
  name: 'Macra Growth',
  product: 'Macra',
  status: 'operating',
  defaultRoundtableId: 'macra-growth-ops-roundtable',
  missionId: 'macra-growth-ops',
  northStarTitle: 'Macra Trial-Start Operating System',
  northStarSummary:
    'Make trial starts repeatable without breaking trust by operating from Scoreboard, Experiments, purchase logs, cancel reasons, user state, retargeting state, and AppsFlyer imports.',
  primaryMetric: 'Qualified onboarding start to trial start',
  guardrails: [
    'Apple purchase cancels',
    'Checkout failure and cancel rate',
    'Under-18 or missing-birthdate blocks',
    'Trial activation after start',
    'Paid conversion after trial',
    'Cancel reasons: price, not ready, proof needed, broken flow',
  ],
  cadence: {
    daily: [
      'Validate AppsFlyer CSV coverage',
      'Refresh Scoreboard and experiment freshness',
      'Post one KPI snapshot',
      'Each agent posts one finding and one proposed action',
      'Nora chooses at most one operational change',
    ],
    weekly: [
      'Decide whether active experiment continues',
      'Review Apple Search Ads quality',
      'Review trials, paid conversion, and cancel feedback',
      'Promote, pause, or design next experiment',
    ],
  },
  sourceSurfaces: [
    { label: 'Macra Scoreboard', href: '/admin/emailSequences' },
    { label: 'Experiments', href: '/admin/experiments' },
    { label: 'User Management', href: '/admin/users' },
    { label: 'Cancel Reasons', href: '/admin/macraCancelReasons' },
    { label: 'Purchase Logs', href: '/admin/purchaseLogs' },
  ],
  agents: [
    {
      id: 'nora',
      displayName: 'Nora',
      role: 'Macra operator/CEO',
      focus: 'Daily operating rhythm, KPI snapshot, experiment ledger, prioritization, and decision log.',
      color: '#8b5cf6',
      launchService: 'com.quicklifts.agent.nora',
    },
    {
      id: 'scout',
      displayName: 'Scout',
      role: 'Growth/acquisition lead',
      focus: 'Apple Search Ads, source quality, campaign hypotheses, keywords, and install-to-trial movement.',
      color: '#06b6d4',
      launchService: 'com.quicklifts.agent.scout',
    },
    {
      id: 'solara',
      displayName: 'Solara',
      role: 'Lifecycle/conversion lead',
      focus: 'Onboarding copy, paywall copy, retargeting emails, cancel reasons, trust assets, and offer tests.',
      color: '#f43f5e',
      launchService: 'com.quicklifts.agent.solara',
    },
    {
      id: 'sage',
      displayName: 'Sage',
      role: 'Product quality/trust lead',
      focus: 'Nutrition safety, eligibility, activation quality, claims, compliance, and event semantics.',
      color: '#22c55e',
      launchService: 'com.quicklifts.agent.sage',
    },
  ],
};

const STATUS_ORDER: Record<string, number> = {
  'in-progress': 0,
  working: 0,
  todo: 1,
  pending: 1,
  blocked: 2,
  'needs-review': 3,
  done: 4,
  completed: 4,
};

const normalize = (value?: string) => String(value || '').trim().toLowerCase();

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const raw = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (typeof raw.seconds === 'number') {
    return new Date(raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1_000_000));
  }
  return null;
};

const formatRelative = (value: unknown) => {
  const date = toDate(value);
  if (!date) return 'No timestamp';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
};

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value || 0)));

const isPresenceOnline = (agent?: AgentPresence) => {
  if (!agent || agent.status === 'offline') return false;
  if (!agent.lastUpdate) return true;
  return Date.now() - agent.lastUpdate.getTime() < 10 * 60_000;
};

const totalTokensForAgent = (agent?: AgentPresence) => {
  if (!agent) return 0;
  return agent.tokenUsageCumulative?.totalTokens || agent.tokenUsage?.totalTokens || 0;
};

const slugify = (value: string) =>
  normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);

function hydrateTeam(id: string, data: Partial<PulseCommandTeam>): PulseCommandTeam {
  return {
    ...MACRA_TEAM_FALLBACK,
    ...data,
    id,
    agents: Array.isArray(data.agents) ? data.agents : [],
    guardrails: Array.isArray(data.guardrails) ? data.guardrails : [],
    sourceSurfaces: Array.isArray(data.sourceSurfaces) ? data.sourceSurfaces : [],
    cadence: {
      daily: Array.isArray(data.cadence?.daily) ? data.cadence.daily : [],
      weekly: Array.isArray(data.cadence?.weekly) ? data.cadence.weekly : [],
    },
  };
}

function classifyOperatorMessage(message: OperatorMessage): { label: string; className: string } {
  const raw = normalize(`${message.operatorPriority || ''} ${message.operatorEvent || ''} ${message.type || ''}`);
  if (raw.includes('urgent') || raw.includes('blocker') || raw.includes('failed') || raw.includes('warning')) {
    return { label: 'Needs Review', className: 'bg-red-500/10 text-red-200 border-red-500/25' };
  }
  if (raw.includes('decision')) return { label: 'Decision', className: 'bg-amber-500/10 text-amber-200 border-amber-500/25' };
  if (raw.includes('finding') || raw.includes('signal')) return { label: 'Finding', className: 'bg-cyan-500/10 text-cyan-200 border-cyan-500/25' };
  if (raw.includes('complete') || raw.includes('result')) return { label: 'Result', className: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/25' };
  return { label: 'Update', className: 'bg-violet-500/10 text-violet-200 border-violet-500/25' };
}

function taskMatchesTeam(task: AgentTask, team: PulseCommandTeam) {
  const ids = new Set(team.agents.map((agent) => normalize(agent.id)));
  const names = new Set(team.agents.map((agent) => normalize(agent.displayName)));
  const assignee = normalize(task.assignee);
  const project = normalize(task.project);
  return (
    ids.has(assignee) ||
    names.has(assignee) ||
    task.missionId === team.missionId ||
    project === normalize(team.product) ||
    normalize(task.name).includes(normalize(team.product))
  );
}

function operatorMessageMatchesTeam(message: OperatorMessage, team: PulseCommandTeam) {
  const agentIds = new Set(team.agents.map((agent) => normalize(agent.id)));
  const haystack = normalize([
    message.content,
    message.operatorSummary,
    message.taskName,
    message.missionId,
    ...(message.evidenceRefs || []),
  ].join(' '));
  return (
    agentIds.has(normalize(message.from)) ||
    message.missionId === team.missionId ||
    haystack.includes(normalize(team.product)) ||
    haystack.includes('macra')
  );
}

function buildTurnState(participants: string[], content: string) {
  const mentioned = participants.filter((agentId) => normalize(content).includes(`@${agentId}`));
  const turnOrder = mentioned.length ? [...mentioned, ...participants.filter((id) => !mentioned.includes(id))] : participants;
  return {
    participants,
    turnOrder,
    coordinator: participants.includes('nora') ? 'nora' : participants[0] || '',
    turnIndex: 0,
    currentTurnAgent: turnOrder[0] || '',
    turnSlaMs: 30_000,
    currentTurnStartedAt: serverTimestamp(),
  };
}

function PulseCommandDashboard() {
  const [teams, setTeams] = useState<PulseCommandTeam[]>([MACRA_TEAM_FALLBACK]);
  const [activeTeamId, setActiveTeamId] = useState(MACRA_TEAM_FALLBACK.id);
  const [presence, setPresence] = useState<AgentPresence[]>([]);
  const [mission, setMission] = useState<MissionStatus>({ status: 'idle' });
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [operatorMessages, setOperatorMessages] = useState<OperatorMessage[]>([]);
  const [roundtableMessages, setRoundtableMessages] = useState<RoundtableMessage[]>([]);
  const [composer, setComposer] = useState('');
  const [mode, setMode] = useState<'task' | 'brainstorm' | 'command'>('task');
  const [toast, setToast] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamProduct, setNewTeamProduct] = useState('');
  const [newAgent, setNewAgent] = useState({ id: '', displayName: '', role: '', focus: '' });
  const [macraRead, setMacraRead] = useState<MacraOperatingRead | null>(null);
  const [macraReadLoading, setMacraReadLoading] = useState(false);
  const [macraReadError, setMacraReadError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'pulse-command-teams'),
      (snap) => {
        const loaded = snap.docs.map((teamDoc) => hydrateTeam(teamDoc.id, teamDoc.data() as Partial<PulseCommandTeam>));
        if (loaded.length === 0) {
          setTeams([MACRA_TEAM_FALLBACK]);
          return;
        }
        loaded.sort((a, b) => a.name.localeCompare(b.name));
        setTeams(loaded);
        setActiveTeamId((current) => loaded.some((team) => team.id === current) ? current : loaded[0].id);
      },
      (error) => {
        console.error('[PulseCommand] team listener failed', error);
        setTeams([MACRA_TEAM_FALLBACK]);
      },
    );
    return unsub;
  }, []);

  useEffect(() => presenceService.listen(setPresence), []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'company-config', 'mission-status'),
      (snap) => setMission(snap.exists() ? (snap.data() as MissionStatus) : { status: 'idle' }),
    );
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'agent-tasks'), limit(250));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((taskDoc) => ({ ...(taskDoc.data() as Omit<AgentTask, 'id'>), id: taskDoc.id }));
      items.sort((a, b) => {
        const rank = (value?: string) => STATUS_ORDER[normalize(value)] ?? 9;
        const diff = rank(a.status) - rank(b.status);
        if (diff !== 0) return diff;
        return (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0);
      });
      setTasks(items);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'agent-commands'), orderBy('createdAt', 'desc'), limit(140));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((commandDoc) => ({ ...(commandDoc.data() as Omit<OperatorMessage, 'id'>), id: commandDoc.id }))
        .filter((message) => normalize((message as any).to) === 'admin' || Boolean(message.operatorSummary));
      setOperatorMessages(items);
    });
    return unsub;
  }, []);

  const activeTeam = useMemo(
    () => teams.find((team) => team.id === activeTeamId) || teams[0] || MACRA_TEAM_FALLBACK,
    [activeTeamId, teams],
  );

  const agentPresenceById = useMemo(() => {
    const map = new Map<string, AgentPresence>();
    presence.forEach((agent) => map.set(normalize(agent.id), agent));
    return map;
  }, [presence]);

  const activeAgents = activeTeam.agents;
  const activeAgentIds = useMemo(() => activeAgents.map((agent) => agent.id), [activeAgents]);
  const onlineCount = activeAgents.filter((agent) => isPresenceOnline(agentPresenceById.get(normalize(agent.id)))).length;
  const teamTasks = tasks.filter((task) => taskMatchesTeam(task, activeTeam)).slice(0, 18);
  const teamMessages = operatorMessages.filter((message) => operatorMessageMatchesTeam(message, activeTeam)).slice(0, 12);
  const tokenTotal = activeAgents.reduce((sum, agent) => sum + totalTokensForAgent(agentPresenceById.get(normalize(agent.id))), 0);
  const isMacraTeam = normalize(activeTeam.product) === 'macra' || normalize(activeTeam.name).includes('macra');

  const refreshMacraRead = useCallback(async () => {
    if (!isMacraTeam) return;
    setMacraReadLoading(true);
    setMacraReadError(null);
    try {
      const res = await fetch('/api/agent/macra-operating-read');
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.read) throw new Error(payload?.error || 'Macra operating read failed.');
      setMacraRead(payload.read as MacraOperatingRead);
    } catch (error: any) {
      setMacraReadError(error?.message || 'Macra operating read failed.');
    } finally {
      setMacraReadLoading(false);
    }
  }, [isMacraTeam]);

  useEffect(() => {
    refreshMacraRead();
    if (!isMacraTeam) return undefined;
    const interval = window.setInterval(refreshMacraRead, 5 * 60_000);
    return () => window.clearInterval(interval);
  }, [isMacraTeam, refreshMacraRead]);

  useEffect(() => {
    if (!activeTeam.defaultRoundtableId) return undefined;
    const q = query(
      collection(db, `agent-group-chats/${activeTeam.defaultRoundtableId}/messages`),
      orderBy('createdAt', 'asc'),
      limit(80),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRoundtableMessages(
        snap.docs.map((messageDoc) => ({ ...(messageDoc.data() as Omit<RoundtableMessage, 'id'>), id: messageDoc.id })),
      );
    });
    return unsub;
  }, [activeTeam.defaultRoundtableId]);

  const runAction = useCallback(async (label: string, action: () => Promise<string | void>) => {
    setBusyAction(label);
    setToast(null);
    try {
      const result = await action();
      setToast(result || `${label} completed.`);
    } catch (error: any) {
      console.error(`[PulseCommand] ${label} failed`, error);
      setToast(error?.message || `${label} failed.`);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const sendRoundtableMessage = useCallback(async () => {
    const content = composer.trim();
    if (!content || busyAction) return;
    await runAction('Sending roundtable message', async () => {
      const participants = activeAgents.map((agent) => normalize(agent.id)).filter(Boolean);
      if (participants.length === 0) throw new Error('Add at least one agent to this team first.');

      const chatId = activeTeam.defaultRoundtableId || `${activeTeam.id}-roundtable`;
      const chatRef = doc(db, 'agent-group-chats', chatId);
      const messageRef = doc(collection(db, `agent-group-chats/${chatId}/messages`));
      const turnState = buildTurnState(participants, content);
      const responses = Object.fromEntries(participants.map((agentId) => [agentId, { content: '', status: 'pending' }]));
      const batch = writeBatch(db);

      batch.set(chatRef, {
        participants,
        createdBy: 'admin',
        status: 'active',
        phase: mode === 'brainstorm' ? 'mission-kickoff' : 'mission-execution',
        context: {
          teamId: activeTeam.id,
          teamName: activeTeam.name,
          product: activeTeam.product,
          missionId: activeTeam.missionId,
          northStarTitle: activeTeam.northStarTitle,
          missionSummary: activeTeam.northStarSummary,
          missionPhase: mode === 'brainstorm' ? 'planning' : 'execution',
          meetingPhase: mode === 'brainstorm' ? 'strategy' : 'action',
          participants,
        },
        metadata: {
          messageCount: 0,
          sessionDuration: 0,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
      }, { merge: true });

      batch.set(messageRef, {
        from: 'admin',
        content,
        createdAt: serverTimestamp(),
        broadcastedAt: serverTimestamp(),
        responses,
        allCompleted: false,
        mode,
        turnState,
        context: {
          teamId: activeTeam.id,
          missionId: activeTeam.missionId,
          missionPhase: mode === 'brainstorm' ? 'planning' : 'execution',
          meetingPhase: mode === 'brainstorm' ? 'strategy' : 'action',
        },
      });

      participants.forEach((agentId) => {
        const commandRef = doc(collection(db, 'agent-commands'));
        batch.set(commandRef, {
          from: 'admin',
          to: agentId,
          type: 'group-chat',
          content,
          status: 'pending',
          createdAt: serverTimestamp(),
          groupChatId: chatId,
          messageId: messageRef.id,
          context: {
            teamId: activeTeam.id,
            missionId: activeTeam.missionId,
            otherAgents: participants.filter((id) => id !== agentId),
            mentionedAgents: participants.filter((id) => normalize(content).includes(`@${id}`)),
            turnState,
            turnSlaMs: 30_000,
            followUpDepth: 0,
            meetingPhase: mode === 'brainstorm' ? 'strategy' : 'action',
            missionPhase: mode === 'brainstorm' ? 'planning' : 'execution',
          },
        });
      });

      await batch.commit();
      setComposer('');
      return `Message sent to ${participants.length} agent${participants.length === 1 ? '' : 's'}.`;
    });
  }, [activeAgents, activeTeam, busyAction, composer, mode, runAction]);

  const restartTeamAgents = useCallback(async () => {
    await runAction('Restarting team agents', async () => {
      const participants = activeAgents.map((agent) => agent.id);
      const results = await Promise.allSettled(
        participants.map(async (agentId) => {
          const res = await fetch('/api/agent/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, action: 'restart' }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok || payload?.success === false) throw new Error(`${agentId}: ${payload?.error || res.statusText}`);
          return agentId;
        }),
      );
      const failed = results.filter((result) => result.status === 'rejected').length;
      if (failed > 0) throw new Error(`Restarted ${participants.length - failed}/${participants.length}; ${failed} failed.`);
      return `Restarted ${participants.length} team agents.`;
    });
  }, [activeAgents, runAction]);

  const queueDailySnapshot = useCallback(async () => {
    await runAction('Queueing daily snapshot', async () => {
      const today = new Date().toISOString().slice(0, 10);
      await addDoc(collection(db, 'agent-commands'), {
        from: 'admin',
        to: 'nora',
        type: 'task',
        content:
          `Create the ${today} Macra daily operating snapshot. First run \`node scripts/macraDailyOpsRead.js --write --date=${today}\` and use that deterministic read as source truth. Then explain the Scoreboard, Experiments, purchase logs, cancel reasons, retargeting state, and AppsFlyer coverage. Post one PulseCommand update and log one decision or explicit no-change decision.`,
        status: 'pending',
        createdAt: serverTimestamp(),
        metadata: {
          teamId: activeTeam.id,
          missionId: activeTeam.missionId,
          source: 'pulse-command-web',
          taskTemplateId: 'macra-daily-operating-snapshot',
          expectedArtifactPath: `docs/ops/macra-operating-snapshot-${today}.md`,
        },
      });
      return 'Daily snapshot task queued for Nora.';
    });
  }, [activeTeam.id, activeTeam.missionId, runAction]);

  const launchMission = useCallback(async () => {
    await runAction('Starting mission', async () => {
      const res = await fetch('/api/agent/kickoff-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: mission.status === 'paused', mode: 'execute', systemVersion: 2, canary: true }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Mission start failed.');
      return payload?.note || payload?.message || 'Mission start accepted.';
    });
  }, [mission.status, runAction]);

  const pauseMission = useCallback(async () => {
    await runAction('Pausing mission', async () => {
      const res = await fetch('/api/agent/kickoff-mission', { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Mission pause failed.');
      return payload?.message || 'Mission paused.';
    });
  }, [runAction]);

  const runTelemetry = useCallback(async () => {
    await runAction('Running telemetry', async () => {
      const res = await fetch('/api/agent/trigger-standup', { method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Telemetry check failed.');
      return payload?.message || 'Telemetry check started.';
    });
  }, [runAction]);

  const saveTeam = useCallback(async () => {
    const name = newTeamName.trim();
    if (!name) return;
    await runAction('Creating team', async () => {
      const id = slugify(name);
      if (!id) throw new Error('Team name needs at least one letter or number.');
      const product = newTeamProduct.trim() || name;
      await setDoc(doc(db, 'pulse-command-teams', id), {
        name,
        product,
        status: 'planning',
        defaultRoundtableId: `${id}-roundtable`,
        missionId: `${id}-mission`,
        northStarTitle: `${product} Operating System`,
        northStarSummary: 'Define this team mission before assigning autonomous work.',
        primaryMetric: 'Define primary metric',
        guardrails: [],
        cadence: { daily: [], weekly: [] },
        sourceSurfaces: [],
        agents: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setNewTeamName('');
      setNewTeamProduct('');
      setShowTeamForm(false);
      setActiveTeamId(id);
      return `Created ${name}.`;
    });
  }, [newTeamName, newTeamProduct, runAction]);

  const saveAgent = useCallback(async () => {
    const id = slugify(newAgent.id || newAgent.displayName);
    if (!id || !newAgent.displayName.trim()) return;
    await runAction('Adding agent', async () => {
      const nextAgents = [
        ...activeAgents.filter((agent) => agent.id !== id),
        {
          id,
          displayName: newAgent.displayName.trim(),
          role: newAgent.role.trim() || 'Agent',
          focus: newAgent.focus.trim() || 'Define this agent focus before assigning work.',
          color: '#f59e0b',
          launchService: `com.quicklifts.agent.${id}`,
        },
      ];
      await updateDoc(doc(db, 'pulse-command-teams', activeTeam.id), {
        agents: nextAgents,
        updatedAt: serverTimestamp(),
      });
      setNewAgent({ id: '', displayName: '', role: '', focus: '' });
      setShowAgentForm(false);
      return `Added ${newAgent.displayName.trim()} to ${activeTeam.name}.`;
    });
  }, [activeAgents, activeTeam.id, activeTeam.name, newAgent, runAction]);

  const missionTone =
    mission.status === 'active'
      ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-100'
      : mission.status === 'paused'
        ? 'border-amber-500/25 bg-amber-500/8 text-amber-100'
        : 'border-zinc-700 bg-zinc-900/70 text-zinc-300';

  return (
    <>
      <Head>
        <title>Pulse Command</title>
      </Head>
      <main className="min-h-screen bg-[#0b0b0d] text-zinc-100">
        <div className="border-b border-white/8 bg-[#111113]/95">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Operations</p>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">Pulse Command</h1>
                  </div>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  One control surface for agent teams, mission state, operator updates, and roundtable decisions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setShowTeamForm(true)} className="pc-btn pc-btn-muted">
                  <Plus className="h-4 w-4" />
                  Team
                </button>
                <button type="button" onClick={runTelemetry} className="pc-btn pc-btn-muted" disabled={Boolean(busyAction)}>
                  <Activity className="h-4 w-4" />
                  Telemetry
                </button>
                <button type="button" onClick={restartTeamAgents} className="pc-btn pc-btn-muted" disabled={Boolean(busyAction)}>
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </button>
                <button type="button" onClick={mission.status === 'active' ? pauseMission : launchMission} className="pc-btn pc-btn-primary" disabled={Boolean(busyAction)}>
                  {mission.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {mission.status === 'active' ? 'Pause Mission' : 'Start Mission'}
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="pc-stat">
                <div className="pc-stat-icon text-emerald-200"><Users className="h-4 w-4" /></div>
                <div>
                  <p className="pc-stat-label">Agents Online</p>
                  <p className="pc-stat-value">{onlineCount}/{activeAgents.length}</p>
                </div>
              </div>
              <div className="pc-stat">
                <div className="pc-stat-icon text-amber-200"><Zap className="h-4 w-4" /></div>
                <div>
                  <p className="pc-stat-label">Tokens Total</p>
                  <p className="pc-stat-value">{formatNumber(tokenTotal)}</p>
                </div>
              </div>
              <div className="pc-stat">
                <div className="pc-stat-icon text-cyan-200"><Inbox className="h-4 w-4" /></div>
                <div>
                  <p className="pc-stat-label">Operator Inbox</p>
                  <p className="pc-stat-value">{teamMessages.length}</p>
                </div>
              </div>
              <div className={`pc-stat ${missionTone}`}>
                <div className="pc-stat-icon"><Gauge className="h-4 w-4" /></div>
                <div>
                  <p className="pc-stat-label">Mission</p>
                  <p className="pc-stat-value capitalize">{mission.status || 'idle'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <aside className="space-y-4">
            <section className="pc-panel">
              <div className="pc-panel-heading">
                <div>
                  <p className="pc-eyebrow">Teams</p>
                  <h2 className="pc-section-title">Operating Units</h2>
                </div>
              </div>
              <div className="space-y-2">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setActiveTeamId(team.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${team.id === activeTeam.id ? 'border-violet-400/45 bg-violet-500/12' : 'border-white/8 bg-white/[0.025] hover:border-white/18'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{team.name}</p>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase text-zinc-400">{team.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{team.product} · {team.agents.length} agents</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="pc-panel">
              <div className="pc-panel-heading">
                <div>
                  <p className="pc-eyebrow">Source of Truth</p>
                  <h2 className="pc-section-title">Macra Surfaces</h2>
                </div>
              </div>
              <div className="space-y-2">
                {activeTeam.sourceSurfaces.length === 0 ? (
                  <p className="pc-empty">No source surfaces configured.</p>
                ) : activeTeam.sourceSurfaces.map((surface) => (
                  <Link key={surface.href} href={surface.href} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-sm text-zinc-300 hover:border-white/18 hover:text-white">
                    <span>{surface.label}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="pc-panel">
              <div className="pc-panel-heading">
                <div>
                  <p className="pc-eyebrow">Guardrails</p>
                  <h2 className="pc-section-title">Do Not Break</h2>
                </div>
              </div>
              <div className="space-y-2">
                {activeTeam.guardrails.map((guardrail) => (
                  <div key={guardrail} className="flex gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-zinc-300">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-300" />
                    <span>{guardrail}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <div className="space-y-5">
            {toast && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#18151c] px-4 py-3 text-sm text-zinc-200">
                <span>{toast}</span>
                <button type="button" onClick={() => setToast(null)} className="text-zinc-500 hover:text-white">Dismiss</button>
              </div>
            )}

            {isMacraTeam && (
              <section className="pc-panel">
                <div className="pc-panel-heading">
                  <div>
                    <p className="pc-eyebrow">Macra Operating Read</p>
                    <h2 className="pc-section-title">Source Truth</h2>
                  </div>
                  <button type="button" onClick={refreshMacraRead} className="pc-btn pc-btn-muted" disabled={macraReadLoading}>
                    {macraReadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh
                  </button>
                </div>

                {macraReadError ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-3 text-sm text-red-100">
                    {macraReadError}
                  </div>
                ) : !macraRead ? (
                  <p className="pc-empty">Loading Macra source read...</p>
                ) : (
                  <div className="space-y-4">
                    <div className={`rounded-lg border p-4 ${
                      macraRead.action === 'refresh_data_first'
                        ? 'border-red-500/25 bg-red-500/8'
                        : macraRead.action === 'hold_and_diagnose_checkout'
                          ? 'border-amber-500/25 bg-amber-500/8'
                          : 'border-emerald-500/25 bg-emerald-500/8'
                    }`}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Current posture</p>
                          <h3 className="mt-1 text-lg font-semibold text-white">{macraRead.operatorSummary}</h3>
                          <p className="mt-2 text-sm text-zinc-400">Generated {formatRelative(macraRead.generatedAt)} for {macraRead.targetDate}</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold uppercase text-zinc-200">
                          {macraRead.action.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="pc-stat">
                        <div className="pc-stat-icon text-cyan-200"><Database className="h-4 w-4" /></div>
                        <div>
                          <p className="pc-stat-label">Scoreboard</p>
                          <p className="pc-stat-value capitalize">{macraRead.scoreboard.freshness || 'unknown'}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {macraRead.scoreboard.coverageEnd ? `Through ${macraRead.scoreboard.coverageEnd}` : 'No coverage date'}
                          </p>
                        </div>
                      </div>
                      <div className="pc-stat">
                        <div className="pc-stat-icon text-violet-200"><Gauge className="h-4 w-4" /></div>
                        <div>
                          <p className="pc-stat-label">Experiment</p>
                          <p className="pc-stat-value">{macraRead.experiment.decisionGrade ? 'Clean' : 'Stale'}</p>
                          <p className="mt-1 text-xs text-zinc-500">{macraRead.experiment.activeVariantId || 'No variant'} · {macraRead.experiment.qualityLabel || 'No quality label'}</p>
                        </div>
                      </div>
                      <div className="pc-stat">
                        <div className="pc-stat-icon text-emerald-200"><CheckCircle2 className="h-4 w-4" /></div>
                        <div>
                          <p className="pc-stat-label">Purchase Logs</p>
                          <p className="pc-stat-value">{formatNumber(macraRead.lowerFunnel.purchaseLogs.total)}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {Object.entries(macraRead.lowerFunnel.purchaseLogs.byStatus).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'No rows'}
                          </p>
                        </div>
                      </div>
                      <div className="pc-stat">
                        <div className="pc-stat-icon text-red-200"><AlertTriangle className="h-4 w-4" /></div>
                        <div>
                          <p className="pc-stat-label">System Blocks</p>
                          <p className="pc-stat-value">{formatNumber(macraRead.blockers.length)}</p>
                          <p className="mt-1 text-xs text-zinc-500">Push failures: {formatNumber(macraRead.systemHealth.push.failures)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                        <p className="pc-eyebrow">Latest AppsFlyer Funnel</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          {[
                            ['Starts', macraRead.appsFlyer.latestAggregatePeriod?.funnelEvents?.macra_onboarding_started],
                            ['Paywall', macraRead.appsFlyer.latestAggregatePeriod?.funnelEvents?.macra_onboarding_paywall_reached],
                            ['CTA', macraRead.appsFlyer.latestAggregatePeriod?.funnelEvents?.macra_paywall_primary_button_pressed],
                            ['Checkout', macraRead.appsFlyer.latestAggregatePeriod?.funnelEvents?.af_initiated_checkout],
                            ['Trials', macraRead.appsFlyer.latestAggregatePeriod?.funnelEvents?.af_start_trial],
                            ['Purchases', macraRead.appsFlyer.latestAggregatePeriod?.funnelEvents?.af_purchase],
                          ].map(([label, value]) => (
                            <div key={label as string} className="rounded-lg border border-white/8 bg-black/15 p-2">
                              <p className="text-xs text-zinc-500">{label}</p>
                              <p className="mt-1 font-semibold text-white">{formatNumber(Number(value || 0))}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                        <p className="pc-eyebrow">Next Steps</p>
                        <div className="mt-3 space-y-2">
                          {macraRead.recommendedNextSteps.slice(0, 4).map((step) => (
                            <div key={step} className="flex gap-2 text-sm leading-6 text-zinc-300">
                              <ArrowRight className="mt-1 h-3.5 w-3.5 flex-none text-violet-300" />
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="pc-panel">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
                <div>
                  <p className="pc-eyebrow">{activeTeam.product}</p>
                  <h2 className="text-xl font-semibold text-white">{activeTeam.northStarTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{activeTeam.northStarSummary}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
                      <p className="pc-stat-label">Primary Metric</p>
                      <p className="mt-1 text-sm font-medium text-white">{activeTeam.primaryMetric}</p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
                      <p className="pc-stat-label">Roundtable</p>
                      <p className="mt-1 truncate text-sm font-medium text-white">{activeTeam.defaultRoundtableId}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/8 bg-[#101014] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="pc-eyebrow">Next Action</p>
                      <h3 className="pc-section-title">Nora Snapshot</h3>
                    </div>
                    <button type="button" onClick={queueDailySnapshot} disabled={Boolean(busyAction)} className="pc-btn pc-btn-primary">
                      <FileText className="h-4 w-4" />
                      Queue
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    Ask Nora to refresh the daily operating snapshot, post an operator update, and log a decision or no-change decision.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="pc-panel">
                <div className="pc-panel-heading">
                  <div>
                    <p className="pc-eyebrow">Operator Inbox</p>
                    <h2 className="pc-section-title">Updates, Findings, Decisions</h2>
                  </div>
                  <Inbox className="h-4 w-4 text-zinc-500" />
                </div>
                <div className="space-y-3">
                  {teamMessages.length === 0 ? (
                    <p className="pc-empty">No operator updates for this team yet.</p>
                  ) : teamMessages.map((message) => {
                    const kind = classifyOperatorMessage(message);
                    return (
                      <article key={message.id} className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{message.operatorSummary || message.taskName || `${message.from} update`}</p>
                            <p className="mt-1 text-xs text-zinc-500">{message.from || 'agent'} · {formatRelative(message.createdAt)}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${kind.className}`}>{kind.label}</span>
                        </div>
                        <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-zinc-300">{message.content}</p>
                        {message.evidenceRefs && message.evidenceRefs.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {message.evidenceRefs.slice(0, 4).map((ref) => (
                              <span key={ref} className="rounded-md border border-white/8 bg-black/20 px-2 py-1 text-[11px] text-zinc-400">{ref}</span>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="pc-panel">
                <div className="pc-panel-heading">
                  <div>
                    <p className="pc-eyebrow">Live Roundtable</p>
                    <h2 className="pc-section-title">Talk To The Team</h2>
                  </div>
                  <MessageSquare className="h-4 w-4 text-zinc-500" />
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(['task', 'brainstorm', 'command'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMode(item)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${mode === item ? 'border-violet-400/45 bg-violet-500/15 text-violet-100' : 'border-white/8 bg-white/[0.025] text-zinc-400 hover:text-white'}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="h-[360px] overflow-y-auto rounded-lg border border-white/8 bg-[#08080a] p-3">
                  {roundtableMessages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-sm text-zinc-500">
                      <Users className="mb-3 h-7 w-7 text-zinc-700" />
                      Send a message to start the team roundtable.
                    </div>
                  ) : roundtableMessages.map((message) => (
                    <article key={message.id} className="mb-3 rounded-lg border border-white/8 bg-white/[0.025] p-3 last:mb-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{message.from}</p>
                        <p className="text-xs text-zinc-600">{formatRelative(message.createdAt)}</p>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-200">{message.content}</p>
                      {message.responses && Object.entries(message.responses).map(([agentId, response]) => (
                        response.content ? (
                          <div key={agentId} className="mt-3 border-l-2 border-violet-400/40 pl-3">
                            <p className="text-xs font-semibold text-violet-200">{agentId}</p>
                            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-zinc-300">{response.content}</p>
                          </div>
                        ) : null
                      ))}
                    </article>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <textarea
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    placeholder="Ask the team what they found, assign the next Macra task, or request a decision."
                    className="min-h-[76px] flex-1 resize-none rounded-lg border border-white/10 bg-[#111113] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                  />
                  <button type="button" onClick={sendRoundtableMessage} disabled={!composer.trim() || Boolean(busyAction)} className="pc-icon-btn self-stretch">
                    {busyAction === 'Sending roundtable message' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="pc-panel">
                <div className="pc-panel-heading">
                  <div>
                    <p className="pc-eyebrow">Team Roster</p>
                    <h2 className="pc-section-title">Agents</h2>
                  </div>
                  <button type="button" onClick={() => setShowAgentForm(true)} className="pc-btn pc-btn-muted">
                    <Plus className="h-4 w-4" />
                    Agent
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {activeAgents.map((agent) => {
                    const live = agentPresenceById.get(normalize(agent.id));
                    const online = isPresenceOnline(live);
                    return (
                      <article key={agent.id} className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold" style={{ borderColor: `${agent.color}55`, background: `${agent.color}18`, color: agent.color }}>
                            {agent.displayName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-white">{agent.displayName}</p>
                              <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                            </div>
                            <p className="mt-0.5 text-xs text-zinc-500">{agent.role}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-zinc-400">{agent.focus}</p>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-lg border border-white/8 bg-black/15 p-2">
                            <p className="text-zinc-500">Status</p>
                            <p className="mt-1 capitalize text-zinc-200">{online ? live?.status || 'idle' : 'offline'}</p>
                          </div>
                          <div className="rounded-lg border border-white/8 bg-black/15 p-2">
                            <p className="text-zinc-500">Progress</p>
                            <p className="mt-1 text-zinc-200">{live?.taskProgress ?? 0}%</p>
                          </div>
                          <div className="rounded-lg border border-white/8 bg-black/15 p-2">
                            <p className="text-zinc-500">Tokens</p>
                            <p className="mt-1 text-zinc-200">{formatNumber(totalTokensForAgent(live))}</p>
                          </div>
                        </div>
                        {live?.currentTask && (
                          <p className="mt-3 truncate rounded-lg border border-white/8 bg-black/15 px-2 py-1.5 text-xs text-zinc-300">{live.currentTask}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="pc-panel">
                <div className="pc-panel-heading">
                  <div>
                    <p className="pc-eyebrow">Queued Work</p>
                    <h2 className="pc-section-title">Team Tasks</h2>
                  </div>
                  <Database className="h-4 w-4 text-zinc-500" />
                </div>
                <div className="space-y-2">
                  {teamTasks.length === 0 ? (
                    <p className="pc-empty">No team tasks found.</p>
                  ) : teamTasks.map((task) => (
                    <div key={task.id} className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
                      <div className="flex items-start gap-2">
                        {normalize(task.status) === 'done' || normalize(task.status) === 'completed'
                          ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-300" />
                          : normalize(task.status) === 'blocked'
                            ? <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
                            : <Circle className="mt-0.5 h-4 w-4 flex-none text-zinc-500" />}
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium text-white">{task.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">{task.assignee || 'Unassigned'} · {task.status || 'todo'} · {formatRelative(task.updatedAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>

        {showTeamForm && (
          <div className="pc-modal">
            <div className="pc-dialog">
              <h2 className="text-lg font-semibold text-white">Create Team</h2>
              <p className="mt-1 text-sm text-zinc-500">Teams define the mission, roundtable, agents, and source surfaces.</p>
              <label className="pc-label">Team name</label>
              <input value={newTeamName} onChange={(event) => setNewTeamName(event.target.value)} className="pc-input" placeholder="Example: FitClub Growth" />
              <label className="pc-label">Product</label>
              <input value={newTeamProduct} onChange={(event) => setNewTeamProduct(event.target.value)} className="pc-input" placeholder="Example: FitClub" />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowTeamForm(false)} className="pc-btn pc-btn-muted">Cancel</button>
                <button type="button" onClick={saveTeam} className="pc-btn pc-btn-primary" disabled={Boolean(busyAction)}>Create</button>
              </div>
            </div>
          </div>
        )}

        {showAgentForm && (
          <div className="pc-modal">
            <div className="pc-dialog">
              <h2 className="text-lg font-semibold text-white">Add Agent</h2>
              <p className="mt-1 text-sm text-zinc-500">This adds the agent to the active team roster. The runner service must exist separately.</p>
              <label className="pc-label">Agent ID</label>
              <input value={newAgent.id} onChange={(event) => setNewAgent((current) => ({ ...current, id: event.target.value }))} className="pc-input" placeholder="example-agent" />
              <label className="pc-label">Display name</label>
              <input value={newAgent.displayName} onChange={(event) => setNewAgent((current) => ({ ...current, displayName: event.target.value }))} className="pc-input" placeholder="Example Agent" />
              <label className="pc-label">Role</label>
              <input value={newAgent.role} onChange={(event) => setNewAgent((current) => ({ ...current, role: event.target.value }))} className="pc-input" placeholder="Lifecycle Lead" />
              <label className="pc-label">Focus</label>
              <textarea value={newAgent.focus} onChange={(event) => setNewAgent((current) => ({ ...current, focus: event.target.value }))} className="pc-input min-h-[84px]" placeholder="What this agent owns." />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAgentForm(false)} className="pc-btn pc-btn-muted">Cancel</button>
                <button type="button" onClick={saveAgent} className="pc-btn pc-btn-primary" disabled={Boolean(busyAction)}>Add</button>
              </div>
            </div>
          </div>
        )}

        <style jsx global>{`
          .pc-panel {
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(19,19,22,0.82);
            border-radius: 8px;
            padding: 16px;
          }
          .pc-panel-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
          }
          .pc-eyebrow {
            margin: 0 0 4px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #71717a;
          }
          .pc-section-title {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #f4f4f5;
          }
          .pc-stat {
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 74px;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            background: rgba(255,255,255,0.03);
            padding: 12px;
          }
          .pc-stat-icon {
            display: flex;
            height: 34px;
            width: 34px;
            flex: none;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            background: rgba(255,255,255,0.05);
          }
          .pc-stat-label {
            margin: 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #71717a;
          }
          .pc-stat-value {
            margin: 2px 0 0;
            font-size: 18px;
            font-weight: 700;
            color: #fff;
          }
          .pc-btn {
            display: inline-flex;
            min-height: 36px;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 8px;
            padding: 0 12px;
            font-size: 13px;
            font-weight: 700;
            transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
          }
          .pc-btn:disabled, .pc-icon-btn:disabled {
            cursor: not-allowed;
            opacity: 0.55;
          }
          .pc-btn-muted {
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.035);
            color: #d4d4d8;
          }
          .pc-btn-muted:hover {
            border-color: rgba(255,255,255,0.2);
            color: #fff;
          }
          .pc-btn-primary {
            border: 1px solid rgba(139,92,246,0.55);
            background: rgba(139,92,246,0.2);
            color: #ede9fe;
          }
          .pc-btn-primary:hover {
            border-color: rgba(167,139,250,0.75);
            background: rgba(139,92,246,0.28);
          }
          .pc-icon-btn {
            display: inline-flex;
            min-width: 46px;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(139,92,246,0.55);
            border-radius: 8px;
            background: rgba(139,92,246,0.22);
            color: #ede9fe;
          }
          .pc-empty {
            margin: 0;
            border: 1px dashed rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 18px;
            text-align: center;
            font-size: 13px;
            color: #71717a;
          }
          .pc-modal {
            position: fixed;
            inset: 0;
            z-index: 50;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.72);
            padding: 16px;
          }
          .pc-dialog {
            width: min(520px, 100%);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            background: #131316;
            padding: 20px;
            box-shadow: 0 24px 80px rgba(0,0,0,0.42);
          }
          .pc-label {
            display: block;
            margin: 16px 0 6px;
            font-size: 12px;
            font-weight: 700;
            color: #a1a1aa;
          }
          .pc-input {
            width: 100%;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            background: #0b0b0d;
            padding: 10px 12px;
            color: #fff;
            outline: none;
          }
          .pc-input:focus {
            border-color: rgba(139,92,246,0.55);
          }
        `}</style>
      </main>
    </>
  );
}

export default function PulseCommandContent() {
  return (
    <AdminRouteGuard>
      <PulseCommandDashboard />
    </AdminRouteGuard>
  );
}
