import type { firestore } from 'firebase-admin';

export const EVIDENCE_COLLECTION = 'pulsecheck-evidence-journals';
export const validEvidenceId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export class EvidenceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const JOURNAL_TYPES = ['evidence', 'gratitude', 'freewrite', 'workout', 'food', 'injury'] as const;
export type JournalType = typeof JOURNAL_TYPES[number];
export const isJournalType = (value: unknown): value is JournalType => typeof value === 'string' && (JOURNAL_TYPES as readonly string[]).includes(value);
// Entries saved before journal types existed carry no type and are evidence.
export const journalTypeOf = (record: { type?: unknown }): JournalType => isJournalType(record?.type) ? record.type : 'evidence';
const MOMENT_LIMITS: Record<JournalType, number> = { evidence: 4000, gratitude: 4000, freewrite: 8000, workout: 4000, food: 4000, injury: 4000 };
// Food photos live in Storage under the athlete's own folder; the entry keeps only the path.
const photoPathFor = (value: unknown) => typeof value === 'string' && /^pulsecheck-journal-photos\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_.-]{1,128}$/.test(value) ? value : null;
export function parseEvidence(body: any) {
  if (!validEvidenceId(body?.entryId)) throw new EvidenceError(400, 'Provide a valid entry ID.');
  if (body.type != null && !isJournalType(body.type)) throw new EvidenceError(400, 'Choose a valid journal type.');
  const type: JournalType = body.type ?? 'evidence';
  const momentLimit = MOMENT_LIMITS[type];
  const photoStoragePath = type === 'food' ? photoPathFor(body.photoStoragePath) : null;
  if (body.photoStoragePath != null && !photoStoragePath) throw new EvidenceError(400, 'Only food entries can include a photo.');
  // A food entry can be just a photo; every other entry needs writing.
  const momentText = typeof body.moment === 'string' ? body.moment : '';
  if ((!momentText.trim() && !photoStoragePath) || momentText.length > momentLimit) throw new EvidenceError(400, `Write an entry of at most ${momentLimit.toLocaleString('en-US')} characters.`);
  if (body.effortRating != null && (type !== 'workout' || !Number.isInteger(body.effortRating) || body.effortRating < 1 || body.effortRating > 10)) throw new EvidenceError(400, 'Effort is a whole number from 1 to 10 on workout entries.');
  for (const [field, max] of [['action', 2000], ['sourceSkillName', 200]] as const) {
    if (body[field] != null && (typeof body[field] !== 'string' || body[field].length > max)) throw new EvidenceError(400, `Invalid ${field}.`);
  }
  if (body.sourceAssignmentId != null && (typeof body.sourceAssignmentId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.sourceAssignmentId))) throw new EvidenceError(400, 'Invalid source assignment.');
  if (type === 'freewrite' && body.action?.trim()) throw new EvidenceError(400, 'A free write has one field.');
  // Skills save reflections as evidence, so source de-duplication only applies there.
  if (type !== 'evidence' && (body.sourceAssignmentId || body.sourceSkillName)) throw new EvidenceError(400, 'Only evidence entries can come from a skill.');
  return {
    id: body.entryId.toLowerCase(), type, moment: momentText.trim(), action: body.action?.trim() || null,
    sourceAssignmentId: body.sourceAssignmentId || null, sourceSkillName: body.sourceSkillName?.trim() || null,
    ...(type === 'workout' ? { effortRating: body.effortRating ?? null } : {}),
    ...(type === 'food' ? { photoStoragePath } : {}),
  };
}
export const withJournalType = <T extends Record<string, any>>(record: T) => ({ ...record, type: journalTypeOf(record) });
export const evidenceEntries = (db: firestore.Firestore, uid: string) => db.collection(EVIDENCE_COLLECTION).doc(uid).collection('entries');
export async function saveEvidence(db: firestore.Firestore, uid: string, input: ReturnType<typeof parseEvidence>, now: number) {
  const ref = evidenceEntries(db, uid).doc(input.id);
  return db.runTransaction(async tx => {
    const sourceRef = input.sourceAssignmentId ? db.collection(EVIDENCE_COLLECTION).doc(uid).collection('sources').doc(input.sourceAssignmentId) : null;
    const source = sourceRef ? await tx.get(sourceRef) : null;
    if (source?.exists) {
      const previous = await tx.get(evidenceEntries(db, uid).doc(source.data()!.entryId));
      if (previous.exists) return { entry: withJournalType(previous.data()!), created: false };
    }
    const existing = await tx.get(ref);
    if (existing.exists) {
      const record = withJournalType(existing.data()!);
      if (Object.entries(input).some(([key, value]) => record[key] !== value)) throw new EvidenceError(409, 'This entry ID already belongs to a different moment.');
      return { entry: record, created: false };
    }
    const entry = { ...input, createdAt: now, revisitCount: 0, useCount: 0 };
    tx.create(ref, entry);
    if (sourceRef) tx.set(sourceRef, { entryId: input.id });
    return { entry, created: true };
  });
}
