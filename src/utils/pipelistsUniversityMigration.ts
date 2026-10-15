import { createHash } from 'crypto';

export const UNIVERSITY_STAGE_SCHEMA_VERSION = 1;
type Data = Record<string, any>;
type Stage = { id: string; label: string; probability: number; track: string; tone: string; outcome?: string };
// Missing stages receive defaults; existing labels, probabilities and custom fields
// are preserved. Touchpoint additions never advance an outreach record.
const stage = (id: string, label: string, probability: number, track = 'build', tone = 'bg-stone-100 text-stone-700 border-stone-200'): Stage => ({ id, label, probability, track, tone });
export const UNIVERSITY_MIGRATION_STAGES: Stage[] = [
  stage('identified', 'Identified', 10),
  stage('outreach-queued', 'Outreach Queued', 10, 'build', 'bg-amber-50 text-amber-700 border-amber-100'),
  ...[['cold-email-sent', 'First Email Sent'], ['call-attempted', 'Call Attempted'], ['follow-up-email-sent', 'Follow-Up Email Sent'], ['final-outreach-email-sent', 'Final Outreach Email Sent']].map(([id, label]) => stage(id, label, 15, 'build', 'bg-cyan-50 text-cyan-700 border-cyan-100')),
  stage('engaged', 'Engaged', 25, 'build', 'bg-sky-50 text-sky-700 border-sky-100'),
  stage('meeting-scheduled', 'Meeting Scheduled', 30, 'build', 'bg-indigo-50 text-indigo-700 border-indigo-100'),
  stage('proposal-sent', 'Proposal Sent', 40, 'run', 'bg-amber-50 text-amber-700 border-amber-100'),
  stage('negotiating', 'Negotiating', 60, 'run', 'bg-orange-50 text-orange-700 border-orange-100'),
  stage('pilot-agreed', 'Pilot Agreed', 80, 'build', 'bg-indigo-50 text-indigo-700 border-indigo-100'),
  stage('contract-signed', 'Contract Signed', 100, 'run', 'bg-emerald-50 text-emerald-700 border-emerald-100'),
  stage('pilot-active', 'Pilot Active', 100, 'build', 'bg-violet-50 text-violet-700 border-violet-100'),
  stage('pilot-complete', 'Pilot Complete', 100, 'build', 'bg-teal-50 text-teal-700 border-teal-100'),
  { ...stage('closed-lost-paused', 'Closed Lost / Paused', 0, 'run', 'bg-zinc-50 text-zinc-500 border-zinc-200'), outcome: 'lost' },
];
export class UniversityMigrationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function migrateUniversityList(list: Data): Data {
  if (list.templateKey !== 'university-pilot') throw new UniversityMigrationError(400, 'Only university-pilot lists can use this migration.');
  const version = list.universityStageSchemaVersion || 0;
  if (!Number.isInteger(version) || version > UNIVERSITY_STAGE_SCHEMA_VERSION) throw new UniversityMigrationError(409, 'This list uses a newer or invalid stage schema.');
  if (!Array.isArray(list.stages) || !Array.isArray(list.items)) throw new UniversityMigrationError(409, 'The saved list is incomplete. Review it before migration.');
  for (const records of [list.stages, list.items]) {
    if (records.some((entry: Data) => !entry || typeof entry.id !== 'string' || !entry.id.trim()) || new Set(records.map((entry: Data) => entry.id)).size !== records.length) throw new UniversityMigrationError(409, 'Missing or duplicate record IDs require review before migration.');
  }
  if (version === UNIVERSITY_STAGE_SCHEMA_VERSION) return list;
  const stages = UNIVERSITY_MIGRATION_STAGES.map(canonical => {
    const saved = list.stages.find((entry: Data) => entry.id === canonical.id);
    return { ...canonical, ...saved, ...(saved?.id === 'cold-email-sent' && saved.label === 'Cold Email Sent' ? { label: canonical.label } : {}) };
  });
  list.stages.forEach((saved: Data, index: number) => {
    if (stages.some(entry => entry.id === saved.id)) return;
    const next = list.stages.slice(index + 1).find((entry: Data) => stages.some(known => known.id === entry.id));
    stages.splice(next ? stages.findIndex(entry => entry.id === next.id) : stages.length, 0, { ...saved });
  });
  return { ...list, stages, items: list.items.map((item: Data) => ['won', 'closed-won'].includes(item.stage) ? { ...item, stage: 'pilot-active' } : item), universityStageSchemaVersion: UNIVERSITY_STAGE_SCHEMA_VERSION };
}

const stableJson = (value: any): string => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && Object.getPrototypeOf(entry) === Object.prototype ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);
export function previewUniversityMigration(ownerUid: string, listId: string, personal: Data, protectedList: Data | null) {
  if (personal.id !== listId || protectedList && protectedList.id !== listId) throw new UniversityMigrationError(409, 'The saved list identity changed.');
  const before = { personal, protected: protectedList };
  const after = { personal: migrateUniversityList(personal), protected: protectedList ? migrateUniversityList(protectedList) : null };
  const fingerprint = createHash('sha256').update(stableJson({ ownerUid, listId, targetVersion: UNIVERSITY_STAGE_SCHEMA_VERSION, before })).digest('hex');
  const changes = (old: Data, next: Data) => ({
    addedStageIds: next.stages.filter((entry: Data) => !old.stages.some((prior: Data) => prior.id === entry.id)).map((entry: Data) => entry.id),
    itemStageChanges: next.items.flatMap((item: Data, index: number) => item.stage !== old.items[index].stage ? [{ itemId: item.id, from: old.items[index].stage, to: item.stage }] : []),
    fromVersion: old.universityStageSchemaVersion || 0,
    toVersion: next.universityStageSchemaVersion,
  });
  return { listId, targetVersion: UNIVERSITY_STAGE_SCHEMA_VERSION, fingerprint, changed: stableJson(before) !== stableJson(after), changes: { personal: changes(personal, after.personal), protected: protectedList && after.protected ? changes(protectedList, after.protected) : null }, before, after };
}

/** No I/O outside the caller's existing Firestore transaction. Preview performs
 * reads only. Apply requires an explicit approval of the exact preview hash.
 * The caller must authenticate the existing owner before invoking this helper.
 */
export async function universityStageMigration(db: FirebaseFirestore.Firestore, ownerUid: string, input: Data, now = new Date()) {
  if (typeof input.listId !== 'string' || !input.listId || input.listId.length > 200 || input.listId.includes('/')) throw new UniversityMigrationError(400, 'Invalid list.');
  if (!['preview', 'apply'].includes(input.action)) throw new UniversityMigrationError(400, 'Choose preview or apply.');
  if (input.action === 'apply' && (input.approved !== true || input.targetVersion !== UNIVERSITY_STAGE_SCHEMA_VERSION || typeof input.expectedFingerprint !== 'string')) throw new UniversityMigrationError(400, 'Approve the exact versioned preview before applying.');
  const stateRef = db.collection('simpbudget-users').doc(ownerUid).collection('pipeLists').doc('state');
  const protectedRef = db.collection('pipeListProtectedShares').doc(`${ownerUid}-${input.listId}`);
  return db.runTransaction(async tx => {
    const [state, protectedDoc] = await Promise.all([tx.get(stateRef), tx.get(protectedRef)]);
    const lists = state.data()?.lists;
    if (!Array.isArray(lists)) throw new UniversityMigrationError(404, 'The owner list state is unavailable.');
    const matches = lists.filter((list: Data) => list.id === input.listId);
    if (matches.length !== 1 || matches[0].deletedAt) throw new UniversityMigrationError(404, 'The list is missing or ambiguous.');
    const protectedData = protectedDoc.data();
    if (protectedDoc.exists && (protectedData?.ownerUid !== ownerUid || protectedData?.listId !== input.listId || protectedData?.list?.id !== input.listId)) throw new UniversityMigrationError(409, 'The protected copy requires ownership review.');
    const preview = previewUniversityMigration(ownerUid, input.listId, matches[0], protectedData?.list || null);
    if (input.action === 'preview') return preview;
    if (input.expectedFingerprint !== preview.fingerprint) throw new UniversityMigrationError(409, 'The list changed after preview. Preview and approve again.');
    if (!preview.changed) return { ...preview, applied: false };
    const appliedAt = now.toISOString();
    const auditRef = db.collection('pipeListStageMigrations').doc(`${ownerUid}-${input.listId}-v${UNIVERSITY_STAGE_SCHEMA_VERSION}-${preview.fingerprint}`);
    // Exact pre-migration copies support a separately reviewed rollback. Do not
    // restore them over later edits without a fresh concurrency check.
    tx.set(auditRef, { ownerUid, listId: input.listId, targetVersion: UNIVERSITY_STAGE_SCHEMA_VERSION, fingerprint: preview.fingerprint, before: preview.before, after: preview.after, appliedAt });
    tx.update(stateRef, { lists: lists.map((list: Data) => list.id === input.listId ? preview.after.personal : list), updatedAt: appliedAt });
    if (protectedDoc.exists) tx.update(protectedRef, { list: preview.after.protected, updatedAt: appliedAt });
    return { ...preview, applied: true, appliedAt };
  });
}
