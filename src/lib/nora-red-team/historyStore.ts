import type { Firestore } from 'firebase-admin/firestore';
import type {
  NoraRedTeamHistoryRecord,
  NoraRedTeamRegressionCase,
  NoraRedTeamRun,
  NoraRedTeamScenario,
} from './types';

export const NORA_RED_TEAM_HISTORY_COLLECTION = 'nora-red-team-run-history';
export const NORA_RED_TEAM_REGRESSION_COLLECTION = 'nora-red-team-regression-cases';

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class NoraRedTeamHistoryStore {
  constructor(private readonly db: Firestore) {}

  async saveCompletedRun(input: {
    run: NoraRedTeamRun;
    ownerEmail: string;
    firebaseMode: 'prod' | 'dev';
  }): Promise<NoraRedTeamHistoryRecord> {
    const now = new Date().toISOString();
    const reference = this.db.collection(NORA_RED_TEAM_HISTORY_COLLECTION).doc(input.run.runId);
    const existing = await reference.get();
    const previous = existing.exists ? existing.data() as NoraRedTeamHistoryRecord : null;
    const record: NoraRedTeamHistoryRecord = {
      runId: input.run.runId,
      scenarioId: input.run.scenarioId,
      scenarioTitle: input.run.scenarioTitle,
      verdict: input.run.verdict,
      severity: input.run.severity,
      completedAt: input.run.completedAt,
      ownerEmail: input.ownerEmail.trim().toLowerCase(),
      firebaseMode: input.firebaseMode,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      releaseStatus: input.run.releaseBlocking ? 'blocking' : 'clear',
      releaseResolvedAt: previous?.releaseResolvedAt || null,
      releaseResolutionRunId: previous?.releaseResolutionRunId || null,
      promotedRegression: previous?.promotedRegression || false,
      promotedAt: previous?.promotedAt || null,
      promotedBy: previous?.promotedBy || null,
      run: clean(input.run),
    };
    await reference.set(clean(record));

    if (input.run.verdict === 'pass') {
      await this.resolveEarlierBlockers(input.run.scenarioId, input.run.runId, now);
    }
    return record;
  }

  private async resolveEarlierBlockers(
    scenarioId: string,
    resolutionRunId: string,
    resolvedAt: string,
  ): Promise<void> {
    const snapshot = await this.db
      .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
      .where('scenarioId', '==', scenarioId)
      .limit(100)
      .get();
    const blockers = snapshot.docs.filter((document) => {
      if (document.id === resolutionRunId) return false;
      return (document.data() as NoraRedTeamHistoryRecord).releaseStatus === 'blocking';
    });
    if (!blockers.length) return;
    const batch = this.db.batch();
    blockers.forEach((document) => batch.set(document.ref, {
      releaseStatus: 'resolved',
      releaseResolvedAt: resolvedAt,
      releaseResolutionRunId: resolutionRunId,
      updatedAt: resolvedAt,
    }, { merge: true }));
    await batch.commit();
  }

  async list(limit = 100): Promise<NoraRedTeamHistoryRecord[]> {
    const snapshot = await this.db
      .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
      .orderBy('completedAt', 'desc')
      .limit(Math.max(1, Math.min(250, limit)))
      .get();
    return snapshot.docs.map((document) => document.data() as NoraRedTeamHistoryRecord);
  }

  async updateReview(input: {
    runId: string;
    status: 'confirmed' | 'inconclusive';
    reviewerEmail: string;
  }): Promise<NoraRedTeamHistoryRecord | null> {
    const reference = this.db.collection(NORA_RED_TEAM_HISTORY_COLLECTION).doc(input.runId);
    const snapshot = await reference.get();
    if (!snapshot.exists) return null;
    const current = snapshot.data() as NoraRedTeamHistoryRecord;
    const reviewedAt = new Date().toISOString();
    const updated: NoraRedTeamHistoryRecord = {
      ...current,
      updatedAt: reviewedAt,
      run: {
        ...current.run,
        humanReview: {
          status: input.status,
          reviewedAt,
          reviewerEmail: input.reviewerEmail.trim().toLowerCase(),
        },
        agentTrace: current.run.agentTrace.map((trace) => trace.role === 'human_reviewer'
          ? {
              ...trace,
              status: 'completed',
              summary: input.status === 'confirmed'
                ? 'A human reviewer confirmed the recorded finding.'
                : 'A human reviewer marked the result inconclusive for follow-up.',
            }
          : trace),
      },
    };
    await reference.set(clean(updated));
    return updated;
  }

  async promoteRegression(input: {
    runId: string;
    scenario: NoraRedTeamScenario;
    reviewerEmail: string;
  }): Promise<NoraRedTeamRegressionCase | null> {
    const historyReference = this.db.collection(NORA_RED_TEAM_HISTORY_COLLECTION).doc(input.runId);
    const historySnapshot = await historyReference.get();
    if (!historySnapshot.exists) return null;
    const promotedAt = new Date().toISOString();
    const promotedBy = input.reviewerEmail.trim().toLowerCase();
    const regression: NoraRedTeamRegressionCase = {
      scenarioId: input.scenario.id,
      sourceRunId: input.runId,
      promotedAt,
      promotedBy,
      enabled: true,
      scenario: clean(input.scenario),
    };
    const batch = this.db.batch();
    batch.set(
      this.db.collection(NORA_RED_TEAM_REGRESSION_COLLECTION).doc(input.scenario.id),
      clean(regression),
    );
    batch.set(historyReference, {
      promotedRegression: true,
      promotedAt,
      promotedBy,
      updatedAt: promotedAt,
    }, { merge: true });
    await batch.commit();
    return regression;
  }

  async listEnabledRegressions(): Promise<NoraRedTeamRegressionCase[]> {
    const snapshot = await this.db
      .collection(NORA_RED_TEAM_REGRESSION_COLLECTION)
      .where('enabled', '==', true)
      .limit(250)
      .get();
    return snapshot.docs.map((document) => document.data() as NoraRedTeamRegressionCase);
  }

  async countOpenCriticalBlockers(): Promise<number> {
    const snapshot = await this.db
      .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
      .where('releaseStatus', '==', 'blocking')
      .limit(250)
      .get();
    return snapshot.docs.filter((document) => {
      const record = document.data() as NoraRedTeamHistoryRecord;
      return record.run.releaseBlocking && record.run.severity === 'critical';
    }).length;
  }
}
