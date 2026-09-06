import type { Firestore } from 'firebase-admin/firestore';
import type {
  NoraRedTeamJob,
  NoraRedTeamRunLimits,
  NoraRedTeamTarget,
} from './types';

export const NORA_RED_TEAM_JOB_COLLECTION = 'nora-red-team-run-jobs';
export const NORA_RED_TEAM_JOB_RETENTION_MS = 2 * 60 * 60 * 1000;

export interface NoraRedTeamJobRecord extends NoraRedTeamJob {
  scenarioSnapshot?: import('./types').NoraRedTeamScenario;
  ownerEmail: string;
  workerTokenHash: string;
  firebaseMode: 'prod' | 'dev';
  firebaseProjectId: string;
  targetModel: string;
  agentModel: string;
  build: string;
}

export interface NoraRedTeamJobStore {
  kind: NoraRedTeamJob['storage'];
  create: (record: NoraRedTeamJobRecord) => Promise<void>;
  claim: (jobId: string, startedAt: string) => Promise<NoraRedTeamJobRecord | null>;
  get: (jobId: string) => Promise<NoraRedTeamJobRecord | null>;
  update: (jobId: string, update: Partial<NoraRedTeamJobRecord>) => Promise<void>;
  remove: (jobId: string) => Promise<void>;
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pruneMemoryJobs(jobs: Map<string, NoraRedTeamJobRecord>): void {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (new Date(job.expiresAt).getTime() <= now) jobs.delete(jobId);
  }
  if (jobs.size <= 100) return;
  const oldest = [...jobs.values()]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, jobs.size - 100);
  for (const job of oldest) jobs.delete(job.jobId);
}

const memoryGlobal = globalThis as typeof globalThis & {
  __noraRedTeamJobs?: Map<string, NoraRedTeamJobRecord>;
};

function memoryJobs(): Map<string, NoraRedTeamJobRecord> {
  if (!memoryGlobal.__noraRedTeamJobs) memoryGlobal.__noraRedTeamJobs = new Map();
  return memoryGlobal.__noraRedTeamJobs;
}

export function createMemoryNoraRedTeamJobStore(): NoraRedTeamJobStore {
  const jobs = memoryJobs();
  return {
    kind: 'memory',
    create: async (record) => {
      pruneMemoryJobs(jobs);
      jobs.set(record.jobId, stripUndefined(record));
    },
    claim: async (jobId, startedAt) => {
      const current = jobs.get(jobId);
      if (!current || current.status !== 'queued' || current.cancelRequested) return null;
      const claimed: NoraRedTeamJobRecord = {
        ...current,
        status: 'running',
        startedAt,
      };
      jobs.set(jobId, stripUndefined(claimed));
      return claimed;
    },
    get: async (jobId) => {
      pruneMemoryJobs(jobs);
      const record = jobs.get(jobId);
      return record ? stripUndefined(record) : null;
    },
    update: async (jobId, update) => {
      const current = jobs.get(jobId);
      if (!current) return;
      jobs.set(jobId, stripUndefined({ ...current, ...update }));
    },
    remove: async (jobId) => {
      jobs.delete(jobId);
    },
  };
}

export function createFirestoreNoraRedTeamJobStore(db: Firestore): NoraRedTeamJobStore {
  const collection = db.collection(NORA_RED_TEAM_JOB_COLLECTION);
  return {
    kind: 'temporary_firestore',
    create: async (record) => {
      await collection.doc(record.jobId).set(stripUndefined(record));
    },
    claim: async (jobId, startedAt) => db.runTransaction(async (transaction) => {
      const reference = collection.doc(jobId);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      const current = snapshot.data() as NoraRedTeamJobRecord;
      if (current.status !== 'queued' || current.cancelRequested) return null;
      const claimed: NoraRedTeamJobRecord = {
        ...current,
        status: 'running',
        startedAt,
      };
      transaction.set(reference, stripUndefined(claimed));
      return claimed;
    }),
    get: async (jobId) => {
      const snapshot = await collection.doc(jobId).get();
      return snapshot.exists ? snapshot.data() as NoraRedTeamJobRecord : null;
    },
    update: async (jobId, update) => {
      await collection.doc(jobId).set(stripUndefined(update), { merge: true });
    },
    remove: async (jobId) => {
      await collection.doc(jobId).delete();
    },
  };
}

export function createNoraRedTeamJobRecord(input: {
  jobId: string;
  scenarioId: string;
  randomSeed: number;
  target: NoraRedTeamTarget;
  ownerEmail: string;
  workerTokenHash: string;
  firebaseMode: 'prod' | 'dev';
  firebaseProjectId: string;
  targetModel: string;
  agentModel: string;
  build: string;
  limits: NoraRedTeamRunLimits;
  storage: NoraRedTeamJob['storage'];
  now?: Date;
}): NoraRedTeamJobRecord {
  const now = input.now || new Date();
  const createdAt = now.toISOString();
  return {
    jobId: input.jobId,
    scenarioId: input.scenarioId,
    randomSeed: input.randomSeed,
    target: input.target,
    ownerEmail: input.ownerEmail.trim().toLowerCase(),
    workerTokenHash: input.workerTokenHash,
    firebaseMode: input.firebaseMode,
    firebaseProjectId: input.firebaseProjectId,
    targetModel: input.targetModel,
    agentModel: input.agentModel,
    build: input.build,
    status: 'queued',
    progress: {
      stage: 'queued',
      percent: 0,
      message: 'The red-team run is queued.',
      modelCalls: 0,
      retryCount: 0,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      updatedAt: createdAt,
    },
    limits: input.limits,
    storage: input.storage,
    createdAt,
    startedAt: null,
    completedAt: null,
    expiresAt: new Date(now.getTime() + NORA_RED_TEAM_JOB_RETENTION_MS).toISOString(),
    cancelRequested: false,
    run: null,
    error: null,
  };
}

export function toPublicNoraRedTeamJob(record: NoraRedTeamJobRecord): NoraRedTeamJob {
  const {
    ownerEmail: _ownerEmail,
    workerTokenHash: _workerTokenHash,
    firebaseMode: _firebaseMode,
    firebaseProjectId: _firebaseProjectId,
    targetModel: _targetModel,
    agentModel: _agentModel,
    build: _build,
    ...job
  } = record;
  return job;
}
