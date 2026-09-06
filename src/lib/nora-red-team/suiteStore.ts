import type { Firestore } from 'firebase-admin/firestore';
import type { NoraRedTeamSuiteRecord } from './types';

export const NORA_RED_TEAM_SUITE_COLLECTION = 'nora-red-team-suite-history';

export interface NoraRedTeamSuiteStoreRecord extends NoraRedTeamSuiteRecord {
  workerTokenHash: string;
  firebaseMode?: 'prod' | 'dev';
  scenarios?: import('./suiteRunner').NoraRedTeamSuiteScenario[];
}

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toPublicNoraRedTeamSuite(
  record: NoraRedTeamSuiteStoreRecord,
): NoraRedTeamSuiteRecord {
  const { workerTokenHash: _workerTokenHash, scenarios: _scenarios, firebaseMode: _firebaseMode, ...suite } = record;
  return suite;
}

export class NoraRedTeamSuiteStore {
  constructor(private readonly db: Firestore) {}

  async createIfMissing(record: NoraRedTeamSuiteStoreRecord): Promise<boolean> {
    return this.db.runTransaction(async (transaction) => {
      const reference = this.db.collection(NORA_RED_TEAM_SUITE_COLLECTION).doc(record.suiteId);
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) return false;
      transaction.create(reference, clean(record));
      return true;
    });
  }

  async claim(suiteId: string, startedAt: string): Promise<NoraRedTeamSuiteStoreRecord | null> {
    return this.db.runTransaction(async (transaction) => {
      const reference = this.db.collection(NORA_RED_TEAM_SUITE_COLLECTION).doc(suiteId);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      const current = snapshot.data() as NoraRedTeamSuiteStoreRecord;
      if (current.status !== 'queued') return null;
      const claimed = { ...current, status: 'running' as const, startedAt };
      transaction.set(reference, clean(claimed));
      return claimed;
    });
  }

  async get(suiteId: string): Promise<NoraRedTeamSuiteStoreRecord | null> {
    const snapshot = await this.db.collection(NORA_RED_TEAM_SUITE_COLLECTION).doc(suiteId).get();
    return snapshot.exists ? snapshot.data() as NoraRedTeamSuiteStoreRecord : null;
  }

  async update(suiteId: string, update: Partial<NoraRedTeamSuiteStoreRecord>): Promise<void> {
    await this.db.collection(NORA_RED_TEAM_SUITE_COLLECTION).doc(suiteId).set(clean(update), { merge: true });
  }

  async latest(): Promise<NoraRedTeamSuiteRecord | null> {
    const snapshot = await this.db
      .collection(NORA_RED_TEAM_SUITE_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return toPublicNoraRedTeamSuite(snapshot.docs[0].data() as NoraRedTeamSuiteStoreRecord);
  }

  async latestCompleted(): Promise<NoraRedTeamSuiteRecord | null> {
    const snapshot = await this.db
      .collection(NORA_RED_TEAM_SUITE_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(25)
      .get();
    const completed = snapshot.docs
      .map((document) => document.data() as NoraRedTeamSuiteStoreRecord)
      .find((suite) => suite.status === 'completed');
    return completed ? toPublicNoraRedTeamSuite(completed) : null;
  }
}
