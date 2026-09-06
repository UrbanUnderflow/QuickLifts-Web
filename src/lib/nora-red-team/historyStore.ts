import type { Firestore } from 'firebase-admin/firestore';
import type {
  NoraRedTeamHistoryRecord,
  NoraRedTeamRegressionCase,
  NoraRedTeamRun,
  NoraRedTeamScenario,
} from './types';

export const NORA_RED_TEAM_HISTORY_COLLECTION = 'nora-red-team-run-history';
export const NORA_RED_TEAM_REGRESSION_COLLECTION =
  'nora-red-team-regression-cases';

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
    const reference = this.db
      .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
      .doc(input.run.runId);
    const existing = await reference.get();
    const previous = existing.exists
      ? (existing.data() as NoraRedTeamHistoryRecord)
      : null;
    if (previous) return previous; // Completed run evidence is immutable; reviews have their own path.
    const record: NoraRedTeamHistoryRecord = {
      runId: input.run.runId,
      scenarioId: input.run.scenarioId,
      scenarioTitle: input.run.scenarioTitle,
      verdict: input.run.verdict,
      severity: input.run.severity,
      completedAt: input.run.completedAt,
      ownerEmail: input.ownerEmail.trim().toLowerCase(),
      firebaseMode: input.firebaseMode,
      createdAt: now,
      updatedAt: now,
      releaseStatus: input.run.releaseBlocking ? 'blocking' : 'clear',
      releaseResolvedAt: null,
      releaseResolutionRunId: null,
      promotedRegression: false,
      promotedAt: null,
      promotedBy: null,
      run: clean(input.run),
    };
    await reference.set(clean(record));

    return record;
  }

  async list(limit = 100): Promise<NoraRedTeamHistoryRecord[]> {
    const snapshot = await this.db
      .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
      .orderBy('completedAt', 'desc')
      .limit(Math.max(1, Math.min(250, limit)))
      .get();
    return snapshot.docs.map(
      (document) => document.data() as NoraRedTeamHistoryRecord,
    );
  }

  async updateReview(input: {
    runId: string;
    status: 'confirmed' | 'inconclusive';
    reviewerEmail: string;
  }): Promise<NoraRedTeamHistoryRecord | null> {
    const reference = this.db
      .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
      .doc(input.runId);
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
        agentTrace: current.run.agentTrace.map((trace) =>
          trace.role === 'human_reviewer'
            ? {
                ...trace,
                status: 'completed',
                summary:
                  input.status === 'confirmed'
                    ? 'A human reviewer confirmed the recorded finding.'
                    : 'A human reviewer marked the result inconclusive for follow-up.',
              }
            : trace,
        ),
      },
    };
    await reference.set(clean(updated));
    return updated;
  }

  async reviewRun(input: {
    runId: string;
    expectedUpdatedAt: string;
    safe: 'yes' | 'no' | 'unsure';
    helpful: 'yes' | 'no' | 'unsure';
    note: string;
    email: string;
    ownerEmail: string;
    ownerEmails?: string[];
  }): Promise<NoraRedTeamHistoryRecord> {
    return this.db.runTransaction(async (tx) => {
      const ref = this.db
        .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
        .doc(input.runId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('The run was not found.');
      const current = snap.data() as NoraRedTeamHistoryRecord;
      if (current.updatedAt !== input.expectedUpdatedAt)
        throw new Error(
          'Another reviewer updated this result. Refresh before saving.',
        );
      const sensitive =
        current.run.humanReviewRequired ||
        current.severity === 'critical' ||
        current.run.judge.findings.length > 0;
      const uncertain = input.safe === 'unsure' || input.helpful === 'unsure';
      const failed =
        input.safe === 'no' ||
        input.helpful === 'no' ||
        current.verdict === 'fail';
      const needsOwner =
        uncertain || (sensitive && !(input.ownerEmails || [input.ownerEmail]).includes(input.email));
      const now = new Date(Math.max(Date.now(), (Date.parse(current.updatedAt) || 0) + 1)).toISOString();
      const review: NonNullable<NoraRedTeamHistoryRecord['review']> = {
        safe: input.safe,
        helpful: input.helpful,
        note: input.note,
        reviewerEmail: input.email,
        reviewedAt: now,
        ownerEmail: input.ownerEmail,
        state: needsOwner ? 'needs_owner' : failed ? 'needs_fix' : 'complete',
      };
      const updated: NoraRedTeamHistoryRecord = {
        ...current,
        updatedAt: now,
        review,
        run: {
          ...current.run,
          humanReview: {
            status: needsOwner ? 'inconclusive' : 'confirmed',
            reviewedAt: now,
            reviewerEmail: input.email,
          },
        },
      };
      tx.set(ref, clean(updated));
      return updated;
    });
  }

  async resolveWithRetest(input: {
    runId: string;
    retestId: string;
    email: string;
    ownerEmail: string;
    ownerEmails?: string[];
  }): Promise<void> {
    if (!(input.ownerEmails || [input.ownerEmail]).includes(input.email))
      throw new Error(
        'The designated owner closes issues after a reviewed retest.',
      );
    await this.db.runTransaction(async (tx) => {
      const ref = this.db
        .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
        .doc(input.runId);
      const nextRef = this.db
        .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
        .doc(input.retestId);
      const [a, b] = await Promise.all([tx.get(ref), tx.get(nextRef)]);
      if (!a.exists || !b.exists)
        throw new Error('Both original and retest evidence are required.');
      const original = a.data() as NoraRedTeamHistoryRecord;
      const next = b.data() as NoraRedTeamHistoryRecord;
      if (
        original.scenarioId !== next.scenarioId ||
        original.run.platform !== next.run.platform ||
        !original.run.scenarioFingerprint ||
        original.run.scenarioFingerprint !== next.run.scenarioFingerprint ||
        next.completedAt <= original.completedAt ||
        next.verdict !== 'pass' ||
        next.review?.state !== 'complete' ||
        !original.promotedRegression
      )
        throw new Error(
          'Retest the same scenario and target, review its passing result, and keep the original as a regression first.',
        );
      tx.set(
        ref,
        {
          releaseStatus: 'resolved',
          releaseResolutionRunId: input.retestId,
          releaseResolvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    });
  }

  async promoteRegression(input: {
    runId: string;
    scenario: NoraRedTeamScenario;
    reviewerEmail: string;
  }): Promise<NoraRedTeamRegressionCase | null> {
    const historyReference = this.db
      .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
      .doc(input.runId);
    const historySnapshot = await historyReference.get();
    if (!historySnapshot.exists) return null;
    if (
      (historySnapshot.data() as NoraRedTeamHistoryRecord).scenarioId !==
      input.scenario.id
    )
      throw new Error('Regression scenario must match the recorded run.');
    const promotedAt = new Date().toISOString();
    const promotedBy = input.reviewerEmail.trim().toLowerCase();
    const regression: NoraRedTeamRegressionCase = {
      scenarioId: input.scenario.id,
      sourceRunId: input.runId,
      promotedAt,
      promotedBy,
      enabled: true,
      scenario: clean((historySnapshot.data() as NoraRedTeamHistoryRecord).run.scenarioSnapshot || input.scenario),
    };
    const batch = this.db.batch();
    batch.set(
      this.db
        .collection(NORA_RED_TEAM_REGRESSION_COLLECTION)
        .doc(input.scenario.id),
      clean(regression),
    );
    batch.set(
      historyReference,
      {
        promotedRegression: true,
        promotedAt,
        promotedBy,
        updatedAt: promotedAt,
      },
      { merge: true },
    );
    await batch.commit();
    return regression;
  }

  async listEnabledRegressions(): Promise<NoraRedTeamRegressionCase[]> {
    const snapshot = await this.db
      .collection(NORA_RED_TEAM_REGRESSION_COLLECTION)
      .where('enabled', '==', true)
      .limit(250)
      .get();
    return snapshot.docs.map(
      (document) => document.data() as NoraRedTeamRegressionCase,
    );
  }

  async countOpenCriticalBlockers(): Promise<number> {
    const snapshot = await this.db
      .collection(NORA_RED_TEAM_HISTORY_COLLECTION)
      .where('releaseStatus', '==', 'blocking')
      .get();
    return snapshot.docs.filter((document) => {
      const record = document.data() as NoraRedTeamHistoryRecord;
      return record.run.releaseBlocking && record.run.severity === 'critical';
    }).length;
  }
}
