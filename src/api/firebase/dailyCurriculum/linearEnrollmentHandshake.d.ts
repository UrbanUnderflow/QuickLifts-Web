import type { firestore } from 'firebase-admin';
export function hasActiveLegacyWork(data: Record<string, unknown>): boolean;
export function assertNoActiveLegacyWork(tx: firestore.Transaction, db: firestore.Firestore, athleteId: string): Promise<void>;
export function commitLegacyStart(db: firestore.Firestore, assignmentRef: firestore.DocumentReference, athleteId: string, buildUpdates: (data: Record<string, unknown>) => Record<string, unknown> | null): Promise<{assignment: Record<string, unknown>; updates: Record<string, unknown> | null}>;
