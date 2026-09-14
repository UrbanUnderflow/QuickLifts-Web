import type { firestore } from 'firebase-admin';
export function hasProtectedLinearState(db: firestore.Firestore, athleteId: string): Promise<boolean>;
export function commitLegacyGeneration(db: firestore.Firestore, athleteId: string, write: (tx: firestore.Transaction) => void | Promise<void>): Promise<boolean>;
