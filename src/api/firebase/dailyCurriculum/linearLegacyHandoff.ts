import { createHash } from 'node:crypto';
import type { firestore } from 'firebase-admin';
import { hasActiveLegacyWork } from './linearEnrollmentHandshake';
export const LEGACY_HANDOFF_COLLECTIONS = ['pulsecheck-daily-assignments', 'sim-assignments', 'mental-exercise-assignments'] as const;
type LegacyCollection = typeof LEGACY_HANDOFF_COLLECTIONS[number];
export interface LegacyReviewedReference { collection: LegacyCollection; assignmentId: string; fingerprint: string }
export interface LegacyHandoffReview { records: LegacyReviewedReference[]; linkedAssignmentId: string }
export interface LinearLegacyHandoff {
  collection: 'pulsecheck-daily-assignments'; assignmentId: string; fingerprint: string;
  skillId: 'protocol-478-breathing'; versionId: string; phase: 'learn'; sourceDate: string;
  timezone: string; enrolledAt: number; startedAt: number; status: 'pending' | 'completed_in_journey' | 'completed_from_legacy'; ledgerId: string;
  resolvedAt?: number; resolvedByAssignmentId?: string;
}
function fail(message: string): never { throw new Error(message); }
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const seconds = source.seconds ?? source._seconds, nanos = source.nanoseconds ?? source._nanoseconds;
    if (typeof seconds === 'number' && typeof nanos === 'number') return { _seconds: seconds, _nanoseconds: nanos };
    return Object.fromEntries(Object.keys(source).sort().filter(key => source[key] !== undefined).map(key => [key, canonical(source[key])]));
  }
  return value;
};
/** Full assignment content fingerprint; no assignment text is returned or stored in the review manifest. */
export const fingerprintLegacyAssignment = (collection: string, assignmentId: string, data: Record<string, unknown>): string => createHash('sha256').update(JSON.stringify(canonical({ collection, assignmentId, data }))).digest('hex');
const owned = (data: Record<string, unknown>, athleteId: string) => {
  const owners = [data.athleteId, data.athleteUserId, data.userId].filter(value => typeof value === 'string' && value);
  return owners.length > 0 && owners.every(owner => owner === athleteId);
};
const is478 = (data: Record<string, unknown>) => data.protocolId === 'protocol-478-breathing' && data.legacyExerciseId === 'breathing-478';
const key = (entry: Pick<LegacyReviewedReference, 'collection' | 'assignmentId'>) => `${entry.collection}/${entry.assignmentId}`;
export function validateLegacyHandoffReview(input: {
  review: LegacyHandoffReview; active: Array<{ collection: LegacyCollection; assignmentId: string; data: Record<string, unknown> }>;
  athleteId: string; today: string; timezone: string; versionId: string; now: number;
}) {
  const { review, active, athleteId, today, timezone, versionId, now } = input;
  if (!review || !Array.isArray(review.records) || !review.records.length || review.records.length > 1000 || typeof review.linkedAssignmentId !== 'string') fail('A reviewed active-assignment manifest and linked assignment are required.');
  if (review.records.some(record => !record || !LEGACY_HANDOFF_COLLECTIONS.includes(record.collection) || typeof record.assignmentId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(record.assignmentId) || !/^[a-f0-9]{64}$/.test(record.fingerprint))) fail('The active-assignment manifest is malformed.');
  const expected = new Map(review.records.map(record => [key(record), record]));
  if (expected.size !== review.records.length || active.length !== expected.size || new Set(active.map(key)).size !== active.length) fail('The active-assignment set changed. Review it again.');
  for (const record of active) {
    if (!owned(record.data, athleteId) || !hasActiveLegacyWork(record.data) || expected.get(key(record))?.fingerprint !== fingerprintLegacyAssignment(record.collection, record.assignmentId, record.data)) fail('An active assignment changed after review. Existing work was preserved.');
  }
  const linked = active.find(record => record.collection === 'pulsecheck-daily-assignments' && record.assignmentId === review.linkedAssignmentId);
  if (!linked || !is478(linked.data) || linked.data.status !== 'started' || linked.data.sourceDate !== today || linked.data.timezone !== timezone || linked.data.completedAt != null || typeof linked.data.startedAt !== 'number' || linked.data.startedAt <= 0 || linked.data.startedAt > now) fail('The linked assignment must be today’s started 4-7-8 practice, without a completion.');
  const historical = review.records.filter(record => key(record) !== key(linked));
  const manifestFingerprint = createHash('sha256').update(JSON.stringify([...review.records].sort((a,b)=>key(a).localeCompare(key(b))))).digest('hex');
  const legacyHandoff: LinearLegacyHandoff = { collection: 'pulsecheck-daily-assignments', assignmentId: linked.assignmentId, fingerprint: expected.get(key(linked))!.fingerprint, skillId: 'protocol-478-breathing', versionId, phase: 'learn', sourceDate: today, timezone, enrolledAt: now, startedAt: linked.data.startedAt as number, status: 'pending', ledgerId: `legacy-handoff_${createHash('sha256').update(key(linked)).digest('hex')}` };
  return { legacyHandoff, legacyReconciliation: { reviewedAt: now, manifestFingerprint, historicalActiveAssignments: historical, historyPolicy: 'preserve' as const, importedCompletionCount: 0 } };
}
/** Transaction reads only. Caller creates the enrollment atomically after this exact-set comparison. */
export async function prepareLegacyHandoff(tx: firestore.Transaction, db: firestore.Firestore, input: Omit<Parameters<typeof validateLegacyHandoffReview>[0], 'active'>) {
  const unique = new Map<string, { collection: LegacyCollection; assignmentId: string; data: Record<string, unknown> }>();
  for (const collection of LEGACY_HANDOFF_COLLECTIONS) for (const owner of ['athleteId', 'athleteUserId', 'userId']) {
    const snapshot = await tx.get(db.collection(collection).where(owner, '==', input.athleteId).limit(1001));
    if (snapshot.size > 1000) fail('Legacy history exceeds the safe review limit.');
    for (const doc of snapshot.docs) { const data = doc.data(); if (hasActiveLegacyWork(data)) unique.set(`${collection}/${doc.id}`, { collection, assignmentId: doc.id, data }); }
  }
  return validateLegacyHandoffReview({ ...input, active: [...unique.values()] });
}
/** Only a later actual legacy completion can contribute credit; initialization and timestamps alone cannot. */
export function evaluateLegacyHandoffCompletion(link: LinearLegacyHandoff, data: Record<string, unknown> | undefined, athleteId: string, now: number): { kind: 'pending' } | { kind: 'completed'; completedAt: number; ledgerId: string } {
  if (link.status !== 'pending' || !data || !owned(data, athleteId) || !is478(data) || data.sourceDate !== link.sourceDate || data.timezone !== link.timezone || data.startedAt !== link.startedAt || data.status !== 'completed' || typeof data.completedAt !== 'number' || !Number.isFinite(data.completedAt) || data.completedAt <= link.enrolledAt || data.completedAt > now) return { kind: 'pending' };
  return { kind: 'completed', completedAt: data.completedAt, ledgerId: link.ledgerId };
}

export function isPendingLegacyHandoffStarted(link: LinearLegacyHandoff, data: Record<string, unknown> | undefined, athleteId: string): boolean {
  return link.status === 'pending' && !!data && owned(data, athleteId) && is478(data) && data.sourceDate === link.sourceDate && data.timezone === link.timezone && data.startedAt === link.startedAt && data.status === 'started' && data.completedAt == null;
}
