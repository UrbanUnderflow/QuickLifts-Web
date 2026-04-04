import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, addDoc, getDocs, query, orderBy, limit, Unsubscribe } from 'firebase/firestore';
import { db } from '../config';

export type AgentStatus = 'offline' | 'idle' | 'working' | 'needs-help';
export type ModelUpgradeScope = 'single' | 'all';

/* ─── Granular thought step ────────────────────────────── */

export interface AgentThoughtStep {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'completed-with-issues' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  reasoning?: string;     // The agent's reasoning / thought process
  output?: string;        // Result or artifact produced
  durationMs?: number;    // How long this step took
  verificationFlag?: string; // Failure signals detected in output
  subSteps?: { action: string; detail: string; ts: string }[];  // Live activity feed from OpenClaw stderr
  lastActivityAt?: string;  // ISO timestamp of last detected activity
}

/* ─── Agent presence with execution context ────────────── */

export interface InstallProgress {
  command: string;                     // e.g., "mas install 497799835"
  phase: 'pending' | 'running' | 'verifying' | 'completed' | 'failed';
  percent: number;                     // 0-100
  message?: string;                    // Latest log line or status text
  logSnippet?: string[];               // Recent stdout/stderr lines for context
  startedAt?: Date;
  completedAt?: Date;
  error?: string;                      // Failure reason if failed
}

export interface AgentPresence {
  id: string;
  displayName: string;
  emoji?: string;
  status: AgentStatus;
  runnerEnabled?: boolean;
  runnerEnabledBy?: string;
  runnerEnabledAt?: Date;

  // Task context
  currentTask?: string;        // Human-readable task name
  currentTaskId?: string;      // Links to kanbanTasks document
  notes?: string;
  role?: string;                 // Agent's role (e.g. "Brand Director")

  // Execution pipeline
  executionSteps: AgentThoughtStep[];  // Live step checklist
  currentStepIndex: number;            // Which step is active (-1 = none)
  taskStartedAt?: Date;                // When agent began this task
  taskProgress: number;                // 0-100 completion percentage

  // Install progress telemetry
  installProgress?: InstallProgress | null;

  // Manifesto / self-correction
  manifestoEnabled?: boolean;          // Toggle: allow manifesto injection
  manifestoInjections?: number;        // How many times manifesto was injected this session
  lastManifestoInjection?: Date;       // When it was last injected

  // AI Model & Token Usage
  currentModel?: string;               // Which AI model is active (gpt-4o, gpt-4o-mini, openclaw)
  currentModelRaw?: string;            // Provider-qualified model (e.g., openai/gpt-5.1-codex)
  currentModelProvider?: string;       // Provider (e.g., openai, anthropic)
  openClawAgentId?: string;            // Which OpenClaw isolated agent is driving this runner (e.g., main, scout, solara)
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  };
  tokenUsageTask?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  };
  tokenUsageByModel?: Record<string, {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  }>;
  tokenUsageTaskByModel?: Record<string, {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  }>;
  tokenUsageCumulativeByModel?: Record<string, {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  }>;
  tokenUsageDailyByModel?: Record<string, Record<string, {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  }>>;
  tokenUsageCumulative?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  };
  tokenUsageDaily?: Record<string, {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  }>;

  // Timestamps
  lastUpdate?: Date;
  sessionStartedAt?: Date;
}

/* ─── Task history entry (completed pipelines) ─────────── */

export interface TaskHistoryEntry {
  id?: string;
  taskName: string;
  taskId: string;
  status: 'completed' | 'completed-with-issues' | 'failed';
  steps: AgentThoughtStep[];
  startedAt: Date;
  completedAt: Date;
  totalDurationMs: number;
  stepCount: number;
  completedStepCount: number;
}

const COLLECTION = 'agent-presence';
const MODEL_UPGRADE_DEFAULT = 'openai-codex/gpt-5.4';
const MODEL_UPGRADE_TARGETS = ['nora', 'scout', 'solara', 'sage'] as const;
const OPENCLAW_PROFILE_IDS: Record<string, string[]> = {
  nora: ['main', 'main-light', 'main-med'],
  scout: ['scout', 'scout-light', 'scout-med'],
  solara: ['solara', 'solara-light', 'solara-med'],
  sage: ['sage', 'sage-light', 'sage-med'],
};
const HISTORY_SUBCOLLECTION = 'task-history';
const SNAPSHOT_COLLECTION = 'progress-snapshots';

const AGENT_NAME_FALLBACKS: Record<string, string> = {
  scout: 'Scout',
  solara: 'Solara',
  sage: 'Sage',
  nora: 'Nora',
  antigravity: 'Antigravity',
};

function resolveAgentDisplayName(agentId: string): string {
  const fallback = AGENT_NAME_FALLBACKS[(agentId || '').toLowerCase()];
  return fallback || (agentId ? `${agentId[0].toUpperCase()}${agentId.slice(1)}` : 'Unknown Agent');
}

/* ─── Serialise thought steps for Firestore ────────────── */

function serialiseStep(step: AgentThoughtStep): Record<string, any> {
  return {
    id: step.id,
    description: step.description,
    status: step.status,
    startedAt: step.startedAt || null,
    completedAt: step.completedAt || null,
    reasoning: step.reasoning || '',
    output: step.output || '',
    durationMs: step.durationMs || 0,
    subSteps: step.subSteps || [],
    lastActivityAt: step.lastActivityAt || null,
  };
}

function deserialiseStep(data: any): AgentThoughtStep {
  return {
    id: data.id || '',
    description: data.description || '',
    status: data.status || 'pending',
    startedAt: data.startedAt?.toDate?.() || (data.startedAt ? new Date(data.startedAt) : undefined),
    completedAt: data.completedAt?.toDate?.() || (data.completedAt ? new Date(data.completedAt) : undefined),
    reasoning: data.reasoning || '',
    output: data.output || '',
    durationMs: data.durationMs || 0,
    verificationFlag: data.verificationFlag || '',
    subSteps: data.subSteps || [],
    lastActivityAt: data.lastActivityAt || null,
  };
}

function serialiseInstallProgress(progress?: InstallProgress | null): Record<string, any> | null {
  if (!progress) return null;
  return {
    command: progress.command,
    phase: progress.phase,
    percent: progress.percent,
    message: progress.message || '',
    logSnippet: progress.logSnippet || [],
    startedAt: progress.startedAt || null,
    completedAt: progress.completedAt || null,
    error: progress.error || '',
  };
}

function deserialiseInstallProgress(data: any): InstallProgress | undefined {
  if (!data) return undefined;
  return {
    command: data.command || '',
    phase: data.phase || 'pending',
    percent: data.percent ?? 0,
    message: data.message || '',
    logSnippet: data.logSnippet || [],
    startedAt: data.startedAt?.toDate?.() || (data.startedAt ? new Date(data.startedAt) : undefined),
    completedAt: data.completedAt?.toDate?.() || (data.completedAt ? new Date(data.completedAt) : undefined),
    error: data.error || '',
  };
}

/* ─── Presence service ─────────────────────────────────── */

export const presenceService = {
  /**
   * Full presence update (used by the agent runner)
   */
  async updateAgentPresence(agentId: string, payload: Partial<Omit<AgentPresence, 'id'>>) {
    const docRef = doc(db, COLLECTION, agentId);
    const data: Record<string, any> = {
      displayName: payload.displayName || 'Unknown Agent',
      emoji: payload.emoji || '⚡️',
      status: payload.status || 'idle',
      currentTask: payload.currentTask || '',
      currentTaskId: payload.currentTaskId || '',
      notes: payload.notes || '',
      executionSteps: (payload.executionSteps || []).map(serialiseStep),
      currentStepIndex: payload.currentStepIndex ?? -1,
      taskProgress: payload.taskProgress ?? 0,
      lastUpdate: serverTimestamp(),
    };
    if (payload.taskStartedAt) data.taskStartedAt = payload.taskStartedAt;
    if (payload.sessionStartedAt) data.sessionStartedAt = payload.sessionStartedAt;
    if (payload.installProgress !== undefined) {
      const serialised = serialiseInstallProgress(payload.installProgress);
      if (serialised) data.installProgress = serialised;
      else data.installProgress = null;
    }
    await setDoc(docRef, data, { merge: true });
  },

  /**
   * Quick status heartbeat (keeps agent "online")
   */
  async heartbeat(agentId: string) {
    const docRef = doc(db, COLLECTION, agentId);
    await updateDoc(docRef, { lastUpdate: serverTimestamp() });
  },

  /**
   * Start working on a task — sets up the execution steps checklist
   */
  async startTask(
    agentId: string,
    taskName: string,
    taskId: string,
    steps: Array<{ description: string; reasoning?: string }>
  ) {
    const executionSteps: AgentThoughtStep[] = steps.map((s, i) => ({
      id: `step-${i}`,
      description: s.description,
      status: i === 0 ? 'in-progress' : 'pending',
      reasoning: s.reasoning || '',
      startedAt: i === 0 ? new Date() : undefined,
    }));

    const docRef = doc(db, COLLECTION, agentId);
    await setDoc(docRef, {
      status: 'working',
      currentTask: taskName,
      currentTaskId: taskId,
      executionSteps: executionSteps.map(serialiseStep),
      currentStepIndex: 0,
      taskStartedAt: new Date(),
      taskProgress: 0,
      lastUpdate: serverTimestamp(),
    }, { merge: true });
  },

  /**
   * Mark a step as completed and move to the next one
   */
  async completeStep(
    agentId: string,
    stepIndex: number,
    output?: string,
    nextStepReasoning?: string
  ) {
    const docRef = doc(db, COLLECTION, agentId);

    // We need to read-modify-write. In production you'd use a transaction.
    return new Promise<void>((resolve, reject) => {
      const unsub = onSnapshot(docRef, async (snap) => {
        unsub(); // one-shot read
        const data = snap.data();
        if (!data) return reject(new Error('Agent not found'));

        const steps: AgentThoughtStep[] = (data.executionSteps || []).map(deserialiseStep);
        const now = new Date();

        // Complete current step
        if (steps[stepIndex]) {
          steps[stepIndex].status = 'completed';
          steps[stepIndex].completedAt = now;
          steps[stepIndex].output = output || steps[stepIndex].output;
          if (steps[stepIndex].startedAt) {
            steps[stepIndex].durationMs = now.getTime() - steps[stepIndex].startedAt!.getTime();
          }
        }

        // Activate next step
        const nextIndex = stepIndex + 1;
        if (nextIndex < steps.length) {
          steps[nextIndex].status = 'in-progress';
          steps[nextIndex].startedAt = now;
          if (nextStepReasoning) steps[nextIndex].reasoning = nextStepReasoning;
        }

        const completedCount = steps.filter(s => s.status === 'completed').length;
        const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
        const allDone = completedCount === steps.length;

        await updateDoc(docRef, {
          executionSteps: steps.map(serialiseStep),
          currentStepIndex: allDone ? -1 : nextIndex,
          taskProgress: progress,
          status: allDone ? 'idle' : 'working',
          lastUpdate: serverTimestamp(),
          ...(allDone ? { notes: `✅ Completed: ${data.currentTask || 'task'}` } : {}),
        });

        resolve();
      });
    });
  },

  /**
   * Mark a step as failed
   */
  async failStep(agentId: string, stepIndex: number, reason: string) {
    const docRef = doc(db, COLLECTION, agentId);
    return new Promise<void>((resolve, reject) => {
      const unsub = onSnapshot(docRef, async (snap) => {
        unsub();
        const data = snap.data();
        if (!data) return reject(new Error('Agent not found'));

        const steps: AgentThoughtStep[] = (data.executionSteps || []).map(deserialiseStep);
        if (steps[stepIndex]) {
          steps[stepIndex].status = 'failed';
          steps[stepIndex].completedAt = new Date();
          steps[stepIndex].output = reason;
        }

        await updateDoc(docRef, {
          executionSteps: steps.map(serialiseStep),
          status: 'idle',
          lastUpdate: serverTimestamp(),
          notes: `❌ Failed at step ${stepIndex + 1}: ${reason}`,
        });
        resolve();
      });
    });
  },

  /**
   * Update the reasoning/notes on the current active step (for live thought streaming)
   */
  async updateCurrentStepReasoning(agentId: string, stepIndex: number, reasoning: string) {
    const docRef = doc(db, COLLECTION, agentId);
    return new Promise<void>((resolve, reject) => {
      const unsub = onSnapshot(docRef, async (snap) => {
        unsub();
        const data = snap.data();
        if (!data) return reject(new Error('Agent not found'));

        const steps: AgentThoughtStep[] = (data.executionSteps || []).map(deserialiseStep);
        if (steps[stepIndex]) {
          steps[stepIndex].reasoning = reasoning;
        }

        await updateDoc(docRef, {
          executionSteps: steps.map(serialiseStep),
          lastUpdate: serverTimestamp(),
        });
        resolve();
      });
    });
  },

  /**
   * Set agent to idle (no active task)
   */
  async setIdle(agentId: string, notes?: string) {
    const docRef = doc(db, COLLECTION, agentId);
    await updateDoc(docRef, {
      status: 'idle',
      currentTask: '',
      currentTaskId: '',
      executionSteps: [],
      currentStepIndex: -1,
      taskProgress: 0,
      notes: notes || '',
      lastUpdate: serverTimestamp(),
    });
  },

  /**
   * Set agent offline
   */
  async setOffline(agentId: string) {
    const docRef = doc(db, COLLECTION, agentId);
    await updateDoc(docRef, {
      status: 'offline',
      executionSteps: [],
      currentStepIndex: -1,
      lastUpdate: serverTimestamp(),
    });
  },

  /**
   * Toggle whether this runner is allowed to process tasks.
   */
  async setRunnerEnabled(agentId: string, enabled: boolean, actor = 'admin'): Promise<void> {
    const docRef = doc(db, COLLECTION, agentId);
    await setDoc(
      docRef,
      {
        runnerEnabled: enabled,
        runnerEnabledBy: actor,
        runnerEnabledAt: serverTimestamp(),
      },
      { merge: true }
    );

    const hourMarker = new Date();
    hourMarker.setUTCMinutes(0, 0, 0);
    try {
      await addDoc(collection(db, SNAPSHOT_COLLECTION), {
        hourIso: hourMarker.toISOString(),
        agentId,
        agentName: resolveAgentDisplayName(agentId),
        objectiveCode: 'runner-control',
        beatCompleted: null,
        color: enabled ? 'green' : 'yellow',
        stateTag: 'signals',
        note: `${resolveAgentDisplayName(agentId)} runner ${enabled ? 'enabled' : 'disabled'} by ${actor}`,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-critical telemetry path should not block runner controls.
    }
  },

  /**
   * Save a completed task pipeline to history
   */
  async saveTaskHistory(
    agentId: string,
    taskName: string,
    taskId: string,
    steps: AgentThoughtStep[],
    status: 'completed' | 'failed',
    startedAt: Date
  ) {
    const historyRef = collection(db, COLLECTION, agentId, HISTORY_SUBCOLLECTION);
    const completedAt = new Date();
    const totalDurationMs = completedAt.getTime() - startedAt.getTime();
    const completedStepCount = steps.filter(s => s.status === 'completed').length;

    await addDoc(historyRef, {
      taskName,
      taskId,
      status,
      steps: steps.map(serialiseStep),
      startedAt,
      completedAt,
      totalDurationMs,
      stepCount: steps.length,
      completedStepCount,
    });
  },

  /**
   * Fetch task history for an agent (most recent first)
   */
  async fetchTaskHistory(agentId: string, count: number = 10): Promise<TaskHistoryEntry[]> {
    const historyRef = collection(db, COLLECTION, agentId, HISTORY_SUBCOLLECTION);
    const q = query(historyRef, orderBy('completedAt', 'desc'), limit(count));
    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        taskName: data.taskName || 'Unknown task',
        taskId: data.taskId || '',
        status: data.status || 'completed',
        steps: (data.steps || []).map(deserialiseStep),
        startedAt: data.startedAt?.toDate?.() || new Date(data.startedAt),
        completedAt: data.completedAt?.toDate?.() || new Date(data.completedAt),
        totalDurationMs: data.totalDurationMs || 0,
        stepCount: data.stepCount || 0,
        completedStepCount: data.completedStepCount || 0,
      };
    });
  },

  /**
   * Real-time listener for all agents
   */
  listen(callback: (agents: AgentPresence[]) => void): Unsubscribe {
    const colRef = collection(db, COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
      const agents: AgentPresence[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          displayName: data.displayName || docSnap.id,
          emoji: data.emoji || '⚡️',
          status: (data.status as AgentStatus) || 'idle',
          currentTask: data.currentTask || '',
          currentTaskId: data.currentTaskId || '',
          notes: data.notes || '',
          role: data.role || undefined,
          executionSteps: (data.executionSteps || []).map(deserialiseStep),
          currentStepIndex: data.currentStepIndex ?? -1,
          taskProgress: data.taskProgress ?? 0,
          taskStartedAt: data.taskStartedAt?.toDate?.() || undefined,
          manifestoEnabled: data.manifestoEnabled !== false, // default true
          manifestoInjections: data.manifestoInjections ?? 0,
          lastManifestoInjection: data.lastManifestoInjection?.toDate?.() || undefined,
          currentModel: data.currentModel || undefined,
          currentModelRaw: data.currentModelRaw || undefined,
          currentModelProvider: data.currentModelProvider || undefined,
          openClawAgentId: data.openClawAgentId || undefined,
          runnerEnabled: data.runnerEnabled !== false,
          runnerEnabledBy: data.runnerEnabledBy || undefined,
          runnerEnabledAt: data.runnerEnabledAt?.toDate?.() || undefined,
          tokenUsage: data.tokenUsage || undefined,
          tokenUsageTask: data.tokenUsageTask || undefined,
          tokenUsageByModel: data.tokenUsageByModel || undefined,
          tokenUsageTaskByModel: data.tokenUsageTaskByModel || undefined,
          tokenUsageCumulativeByModel: data.tokenUsageCumulativeByModel || undefined,
          tokenUsageDailyByModel: data.tokenUsageDailyByModel || undefined,
          tokenUsageCumulative: data.tokenUsageCumulative || undefined,
          tokenUsageDaily: data.tokenUsageDaily || undefined,
          lastUpdate: data.lastUpdate?.toDate?.() || undefined,
          sessionStartedAt: data.sessionStartedAt?.toDate?.() || undefined,
          installProgress: deserialiseInstallProgress(data.installProgress) || null,
        };
      });
      callback(agents);
    });
  },

  /**
   * Push install-progress telemetry for long-running commands
   */
  async updateInstallProgress(agentId: string, progress: InstallProgress | null) {
    const docRef = doc(db, COLLECTION, agentId);
    await updateDoc(docRef, {
      installProgress: progress ? serialiseInstallProgress(progress) : null,
      lastUpdate: serverTimestamp(),
    });
  },

  /**
   * Toggle manifesto injection for a specific agent
   */
  async toggleManifesto(agentId: string, enabled: boolean): Promise<void> {
    const docRef = doc(db, COLLECTION, agentId);
    await updateDoc(docRef, { manifestoEnabled: enabled });
  },

  /**
   * Send a command to an agent (e.g., force-recovery, task, chat)
   */
  async sendCommand(agentId: string, type: string, content: string): Promise<string> {
    const colRef = collection(db, 'agent-commands');
    const docRef = await addDoc(colRef, {
      to: agentId,
      from: 'admin',
      type,
      content,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Queue a model-upgrade execution task to Nora.
   * Nora executes the Mac Mini command sequence and verifies profile updates.
   */
  async queueModelUpgrade(opts: {
    model: string;
    scope: ModelUpgradeScope;
    targetAgentId?: string;
    requestedBy?: string;
  }): Promise<string> {
    const normalizedModel = String(opts.model || '').trim() || MODEL_UPGRADE_DEFAULT;
    const requestedBy = String(opts.requestedBy || 'admin-ui').trim() || 'admin-ui';
    const scope: ModelUpgradeScope = opts.scope === 'single' ? 'single' : 'all';
    const targetAgentId = opts.targetAgentId ? String(opts.targetAgentId).trim().toLowerCase() : '';

    const targetAgents = scope === 'single'
      ? (targetAgentId ? [targetAgentId] : [])
      : [...MODEL_UPGRADE_TARGETS];

    if (targetAgents.length === 0) {
      throw new Error('Missing target agent for single-agent model upgrade.');
    }

    const openClawProfileIds = Array.from(new Set(
      targetAgents.flatMap((agentId) => OPENCLAW_PROFILE_IDS[agentId] || [agentId])
    ));
    const launchServices = targetAgents.map((agentId) => `com.quicklifts.agent.${agentId}`);
    const nodePatchScript = [
      `node -e "const fs=require('fs');`,
      `const p=process.env.HOME+'/.openclaw/openclaw.json';`,
      `const cfg=JSON.parse(fs.readFileSync(p,'utf8'));`,
      `const model='${normalizedModel.replace(/'/g, "\\'")}';`,
      `const ids=${JSON.stringify(openClawProfileIds)};`,
      `for (const a of (cfg.agents?.list||[])) { if (ids.includes(a.id)) a.model=model; }`,
      `fs.writeFileSync(p, JSON.stringify(cfg,null,2)+'\\n');`,
      `console.log('updated', ids.length, 'profiles to', model);"`,
    ].join('');

    const taskDescription = [
      `MODEL UPGRADE EXECUTION (Mac Mini)`,
      ``,
      `Requested by: ${requestedBy}`,
      `Scope: ${scope === 'single' ? `single agent (${targetAgents[0]})` : 'all core agents (nora, scout, solara, sage)'}`,
      `Target model: ${normalizedModel}`,
      ``,
      `Target OpenClaw profile IDs:`,
      ...openClawProfileIds.map((id) => `- ${id}`),
      ``,
      `Target launchd services to restart:`,
      ...launchServices.map((svc) => `- ${svc}`),
      ``,
      `Run these steps on the Mac Mini:`,
      `1) Backup config: cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.$(date +%Y%m%d-%H%M%S)`,
      `2) Patch model values for target profiles:`,
      `   ${nodePatchScript}`,
      `3) Verify model values: openclaw agents list --json`,
      `4) Restart only impacted services:`,
      ...launchServices.map((svc) => `   launchctl kickstart -k gui/$(id -u)/${svc}`),
      `5) Confirm each target agent reports the new currentModel/currentModelRaw in presence.`,
      ``,
      `Then post completion status with the exact profiles updated + any failures.`,
    ].join('\n');

    const commandContent = scope === 'single'
      ? `Upgrade ${targetAgents[0]} model to ${normalizedModel} on the Mac Mini and restart that runner.`
      : `Upgrade all core agent models to ${normalizedModel} on the Mac Mini and restart impacted runners.`;

    const colRef = collection(db, 'agent-commands');
    const docRef = await addDoc(colRef, {
      to: 'nora',
      from: 'admin',
      type: 'task',
      content: commandContent,
      metadata: {
        source: 'model-upgrade-ui',
        requestedBy,
        modelUpgrade: {
          model: normalizedModel,
          scope,
          targetAgents,
          openClawProfileIds,
          launchServices,
        },
        description: taskDescription,
      },
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },
};
