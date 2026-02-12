import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, addDoc, getDocs, query, orderBy, limit, Unsubscribe, Timestamp } from 'firebase/firestore';
import { db } from '../config';

export type AgentStatus = 'offline' | 'idle' | 'working';

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
}

/* ─── Agent presence with execution context ────────────── */

export interface AgentPresence {
  id: string;
  displayName: string;
  emoji?: string;
  status: AgentStatus;

  // Task context
  currentTask?: string;        // Human-readable task name
  currentTaskId?: string;      // Links to kanbanTasks document
  notes?: string;

  // Execution pipeline
  executionSteps: AgentThoughtStep[];  // Live step checklist
  currentStepIndex: number;            // Which step is active (-1 = none)
  taskStartedAt?: Date;                // When agent began this task
  taskProgress: number;                // 0-100 completion percentage

  // Manifesto / self-correction
  manifestoEnabled?: boolean;          // Toggle: allow manifesto injection
  manifestoInjections?: number;        // How many times manifesto was injected this session
  lastManifestoInjection?: Date;       // When it was last injected

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
const HISTORY_SUBCOLLECTION = 'task-history';

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
    const { onSnapshot: snapOnce } = await import('firebase/firestore');
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
          executionSteps: (data.executionSteps || []).map(deserialiseStep),
          currentStepIndex: data.currentStepIndex ?? -1,
          taskProgress: data.taskProgress ?? 0,
          taskStartedAt: data.taskStartedAt?.toDate?.() || undefined,
          manifestoEnabled: data.manifestoEnabled !== false, // default true
          manifestoInjections: data.manifestoInjections ?? 0,
          lastManifestoInjection: data.lastManifestoInjection?.toDate?.() || undefined,
          lastUpdate: data.lastUpdate?.toDate?.() || undefined,
          sessionStartedAt: data.sessionStartedAt?.toDate?.() || undefined,
        };
      });
      callback(agents);
    });
  },

  /**
   * Toggle manifesto injection for a specific agent
   */
  async toggleManifesto(agentId: string, enabled: boolean): Promise<void> {
    const docRef = doc(db, COLLECTION, agentId);
    await updateDoc(docRef, { manifestoEnabled: enabled });
  }
};
