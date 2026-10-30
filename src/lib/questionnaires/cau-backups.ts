import { createHash, randomUUID } from 'crypto';
import { COLLECTION, QUESTIONNAIRE_VERSION, splitSubmission } from './cau';
import { baselineHealthContext } from './cau-health';
import { resolveBaselineConnection } from './auntedna-connection';
import { submitAuntEdnaBaseline, type BaselineReceipt } from './auntedna-partner';
import { teamBaselineReviewId } from './team-baseline-review';

const LEASE_MS = 90_000;
export const HEALTH_BACKUP_KIND = 'health_backup';
export type BackupMetadata = {
  id: string; athleteId: string; athleteName: string; organizationId: string; teamId: string;
  teamName: string; organizationName: string; createdAt: string; deliveryStatus: 'pending' | 'verified' | 'blocked' | 'retryable' | 'processing';
  lastAttemptAt: string | null; verifiedAt: string | null; backupRetained: boolean; canDelete: boolean;
  deliveryIssue: 'connection_not_configured' | 'authorization_changed' | 'route_changed' | 'provider_unconfirmed' | null;
  receipt: { baselineId: string; athleteId: string; receivedAt: string; requestId: string } | null;
};
export class BackupError extends Error {
  constructor(message: string, public statusCode = 409) { super(message); }
}
export const healthBackupId = (uid: string, submissionId: string) =>
  `health_backup_${createHash('sha256').update(JSON.stringify([uid, submissionId])).digest('hex')}`;

function readOnlyTransactionDatabase(db: any, tx: any) {
  const wrap = (reference: any): any => ({
    get: () => tx.get(reference),
    doc: (id: string) => wrap(reference.doc(id)),
    collection: (name: string) => wrap(reference.collection(name)),
    orderBy: (...args: any[]) => wrap(reference.orderBy(...args)),
    limit: (count: number) => wrap(reference.limit(count)),
  });
  return { collection: (name: string) => wrap(db.collection(name)) };
}
function authorizationFingerprint(context: Awaited<ReturnType<typeof baselineHealthContext>>) {
  return createHash('sha256').update(JSON.stringify(context.healthDocuments.map(document => ({
    document, decision: context.decisions[document.id],
  })))).digest('hex');
}
function assignmentScope(assignment: any) {
  return Object.fromEntries(['scope', 'teamId', 'teamMembershipId', 'organizationId', 'reviewId', 'environment', 'universityCode']
    .filter(key => assignment[key] !== undefined).map(key => [key, assignment[key]]));
}
async function currentAuthorization(db: any, tx: any, uid: string, assignment: any, expectedOrganizationId?: string) {
  if ((await tx.get(db.collection('account-closure-jobs').doc(uid))).exists) throw new BackupError('This athlete account is unavailable.');
  const context = await baselineHealthContext(readOnlyTransactionDatabase(db, tx), uid, assignment);
  if (!context.eligible || !context.healthSharingAllowed || context.healthAuthorizationRequired
    || expectedOrganizationId !== undefined && context.organizationId !== expectedOrganizationId
    || assignment.reviewId && teamBaselineReviewId(uid, context.memberId, context.member) !== assignment.reviewId) {
    throw new BackupError('The team membership or health authorization has changed.');
  }
  return context;
}

/** Call before any transaction writes. The caller creates this document atomically with completion. */
export async function prepareHealthBackup(db: any, tx: any, options: {
  uid: string; input: any; assignment: any; recordIds: string[]; verifiedPhone?: string;
}) {
  const { uid, input, assignment, recordIds } = options;
  const context = await currentAuthorization(db, tx, uid, assignment);
  const id = healthBackupId(uid, input.submissionId);
  const reference = db.collection(COLLECTION).doc(id);
  const previous = await tx.get(reference);
  const payload = splitSubmission(input, { verifiedPhone: options.verifiedPhone }).auntEdna;
  if (previous.exists) {
    const record = previous.data();
    if (record.externalId !== uid || record.submissionId !== input.submissionId
      || record.kind !== HEALTH_BACKUP_KIND || record.backupRetained === false
      || JSON.stringify(record.payload) !== JSON.stringify(payload)) {
      throw new BackupError('A different submission is already saved. Reopen the baseline.');
    }
    return { id, reference, record, create: false };
  }
  const record = {
    kind: HEALTH_BACKUP_KIND, version: 1, questionnaireVersion: QUESTIONNAIRE_VERSION,
    externalId: uid, submissionId: input.submissionId, athleteName: payload.identity.name,
    organizationId: context.organizationId, teamId: assignment.teamId || '', teamName:context.team?.displayName || context.team?.name || '', organizationName:context.organization?.displayName || context.organization?.name || '',
    assignment: assignmentScope(assignment), authorizationFingerprint: authorizationFingerprint(context),
    payload, recordIds: [...new Set(recordIds)], createdAt: new Date().toISOString(),
    deliveryStatus: 'pending', backupRetained: true, attempts: 0,
  };
  return { id, reference, record, create: true };
}

function validReceipt(record: any): record is { receipt: BaselineReceipt } & Record<string, any> {
  const receipt = record.receipt;
  return record.deliveryStatus === 'verified' && receipt?.externalId === record.externalId
    && receipt?.submissionId === record.submissionId && typeof receipt?.created === 'boolean'
    && ['baselineId', 'athleteId', 'requestId', 'receivedAt'].every(key => typeof receipt?.[key] === 'string' && receipt[key].length > 0)
    && Number.isFinite(Date.parse(receipt.receivedAt));
}
export function backupMetadata(id: string, record: any, now = Date.now()): BackupMetadata {
  const verified = validReceipt(record), liveLease = record.lease?.expiresAt > now;
  return { id, athleteId: record.externalId, athleteName: record.athleteName || '',
    organizationId: record.organizationId || '', teamId: record.teamId || '', teamName:record.teamName || '', organizationName:record.organizationName || '', createdAt: record.createdAt,
    deliveryStatus: liveLease ? 'processing' : verified ? 'verified' : (record.lease || record.deliveryStatus==='verified')?'retryable':record.deliveryStatus,
    lastAttemptAt: record.lastAttemptAt || null, verifiedAt: record.verifiedAt || null,
    backupRetained: record.backupRetained !== false, deliveryIssue: record.deliveryIssue || null,
    canDelete: verified && record.backupRetained !== false && !liveLease,
    receipt: verified ? { baselineId: record.receipt.baselineId, athleteId: record.receipt.athleteId,
      receivedAt: record.receipt.receivedAt, requestId: record.receipt.requestId } : null };
}
export async function readHealthBackup(db: any, id: string) {
  const snapshot = await db.collection(COLLECTION).doc(id).get();
  if (!snapshot.exists || snapshot.data()?.kind !== HEALTH_BACKUP_KIND) throw new BackupError('Backup not found.', 404);
  return backupMetadata(id, snapshot.data());
}

function submissionFromPayload(record: any) {
  if (record.questionnaireVersion !== QUESTIONNAIRE_VERSION || !record.payload) throw new BackupError('This saved questionnaire version needs review.');
  const payload = record.payload;
  const input = { name: payload.identity?.name, email: payload.identity?.email,
    submissionId: record.submissionId, completedSections: { performance: true, health: true },
    answers: Object.fromEntries(Object.entries(payload.fields || {}).filter(([, field]: any) => field.state === 'local')
      .map(([id, field]: any) => [id, field.value])) };
  // The original provider payload is immutable, including skipped/conditional fields.
  if (JSON.stringify(splitSubmission(input, { verifiedPhone: payload.identity?.verification === 'phone_verified' ? payload.identity?.phone : undefined }).auntEdna) !== JSON.stringify(payload)) throw new BackupError('The saved backup needs review before sending.');
  return input;
}

type ProcessDependencies = { transport?: typeof fetch; env?: Record<string, string | undefined>; now?: () => number };
/** No browser receipt or manual verification flag is accepted. Replaying the immutable submission is idempotent. */
export async function processHealthBackup(db: any, id: string, actorUid: string, dependencies: ProcessDependencies = {}) {
  const now = dependencies.now || Date.now;
  const reference = db.collection(COLLECTION).doc(id), leaseId = randomUUID();
  const claim = await db.runTransaction(async (tx: any) => {
    const snapshot = await tx.get(reference), record = snapshot.data();
    if (!snapshot.exists || record?.kind !== HEALTH_BACKUP_KIND) throw new BackupError('Backup not found.', 404);
    if (validReceipt(record)) return { metadata: backupMetadata(id, record, now()) };
    if (record.backupRetained === false || !record.payload) throw new BackupError('This backup has already been removed.');
    // A live lease fences concurrent attempts. An expired/unknown outcome can only
    // be reconciled by replaying the same immutable provider idempotency identity.
    if (record.lease && record.lease.expiresAt > now()) throw new BackupError('A verification attempt is already running. Refresh shortly.');
    let context;
    try { context = await currentAuthorization(db, tx, record.externalId, record.assignment, record.organizationId); }
    catch (error) {
      if (!(error instanceof BackupError)) throw error;
      const next = { ...record, deliveryStatus: 'blocked', deliveryIssue:'authorization_changed' }; delete next.lease;
      tx.set(reference, next); return { metadata: backupMetadata(id, next, now()) };
    }
    if (authorizationFingerprint(context) !== record.authorizationFingerprint) {
      const next = { ...record, deliveryStatus: 'blocked', deliveryIssue:'authorization_changed' }; delete next.lease;
      tx.set(reference, next); return { metadata: backupMetadata(id, next, now()) };
    }
    const connection = resolveBaselineConnection(context.organizationId, record.teamId, context.organization,
      record.assignment, dependencies.env || process.env);
    if (!connection) {
      const next = { ...record, deliveryStatus: 'blocked', deliveryIssue:'connection_not_configured' }; delete next.lease;
      tx.set(reference, next); return { metadata: backupMetadata(id, next, now()) };
    }
    const routeFingerprint = createHash('sha256').update(JSON.stringify({organizationId:context.organizationId,teamId:record.teamId,environment:connection.environment,universityCode:connection.universityCode,credentialEnv:context.organization?.auntEdnaBaselineConnection?.credentialEnv || 'AUNTEDNA_PARTNER_TEST_KEY'})).digest('hex');
    if (record.routeFingerprint && record.routeFingerprint !== routeFingerprint) {
      const next = {...record,deliveryStatus:'blocked',deliveryIssue:'route_changed'};delete next.lease;tx.set(reference,next);
      return {metadata:backupMetadata(id,next,now())};
    }
    const input = submissionFromPayload(record);
    const next = { ...record, routeFingerprint, deliveryStatus: 'pending', deliveryIssue:null, lease: { id: leaseId, expiresAt: now() + LEASE_MS },
      lastAttemptAt: new Date(now()).toISOString(), attempts: (record.attempts || 0) + 1 };
    tx.set(reference, next);
    tx.create(reference.collection('audit').doc(), { action: 'attempt', actorUid, at: next.lastAttemptAt, attempt: next.attempts });
    return { record: next, input, connection };
  });
  if (claim.metadata) return claim.metadata;
  let receipt: BaselineReceipt | null = null;
  try { receipt = await submitAuntEdnaBaseline(claim.input, claim.record.externalId, claim.connection, dependencies.transport, { verifiedPhone: claim.record.payload?.identity?.verification === 'phone_verified' ? claim.record.payload.identity.phone : undefined }); }
  catch { /* Provider/network bodies are deliberately never retained or logged. */ }
  return db.runTransaction(async (tx: any) => {
    const snapshot = await tx.get(reference), current = snapshot.data();
    if (current?.lease?.id !== leaseId) throw new BackupError('This attempt changed. Refresh its status before retrying.');
    const mirrors = receipt ? await Promise.all((current.recordIds || []).map((recordId: string) => tx.get(db.collection(COLLECTION).doc(recordId)))) : [];
    const next = { ...current, deliveryStatus: receipt ? 'verified' : 'retryable', deliveryIssue:receipt?null:'provider_unconfirmed',
      ...(receipt ? { receipt, verifiedAt: new Date(now()).toISOString() } : {}) };
    delete next.lease;
    tx.set(reference, next);
    tx.create(reference.collection('audit').doc(), { action: receipt ? 'verified' : 'unconfirmed', actorUid, at: new Date(now()).toISOString() });
    if (receipt) for (const mirror of mirrors) {
      const data = mirror.data();
      if (!mirror.exists || data.externalId !== current.externalId || data.healthBackupId !== id) continue;
      tx.set(mirror.ref, { ...data, healthDelivery: { status: 'verified', verifiedAt: next.verifiedAt },
        auntEdna: { baselineId: receipt.baselineId, athleteId: receipt.athleteId, receivedAt: receipt.receivedAt, requestId: receipt.requestId },
        auntEdnaReferences: Object.fromEntries(Object.entries(data.auntEdnaReferences || {}).map(([questionId, field]: any) => [questionId,
          { ...field, state: 'external', baselineId: receipt!.baselineId, athleteId: receipt!.athleteId }])) });
    }
    return backupMetadata(id, next, now());
  });
}

export async function listHealthBackups(db: any, limit = 50, cursor = '') {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || cursor && !/^health_backup_[a-f0-9]{64}$/.test(cursor)) throw new BackupError('Choose a valid page.', 400);
  // The dashboard query does not even read the protected payload into its result set.
  let query = db.collection(COLLECTION).where('kind', '==', HEALTH_BACKUP_KIND).select(
    'externalId','submissionId','athleteName','organizationId','teamId','teamName','organizationName',
    'createdAt','deliveryStatus','deliveryIssue','lastAttemptAt','verifiedAt','backupRetained','lease','receipt');
  if (cursor) {
    const previous = await db.collection(COLLECTION).doc(cursor).get();
    if (!previous.exists || previous.data()?.kind !== HEALTH_BACKUP_KIND) throw new BackupError('Refresh the backup list.', 400);
    query = query.startAfter(previous);
  }
  const snapshot = await query.limit(limit + 1).get();
  return { backups: snapshot.docs.slice(0, limit).map((doc: any) => backupMetadata(doc.id, doc.data())),
    nextCursor: snapshot.docs.length > limit ? snapshot.docs[limit - 1].id : null };
}
export async function deleteVerifiedHealthBackup(db: any, id: string, actorUid: string) {
  const reference = db.collection(COLLECTION).doc(id);
  return db.runTransaction(async (tx: any) => {
    const snapshot = await tx.get(reference), record = snapshot.data();
    if (!snapshot.exists || record?.kind !== HEALTH_BACKUP_KIND) throw new BackupError('Backup not found.', 404);
    if (!validReceipt(record) || record.lease?.expiresAt > Date.now()) throw new BackupError('A confirmed AuntEdna receipt is required before removing this backup.');
    if (record.backupRetained === false) return backupMetadata(id, record);
    const { payload: _payload, authorizationFingerprint: _fingerprint, lease: _lease, ...metadata } = record;
    const next = { ...metadata, backupRetained: false, removedAt: new Date().toISOString(), removedBy: actorUid };
    tx.set(reference, next);
    tx.create(reference.collection('audit').doc(), { action: 'backup_removed', actorUid, at: next.removedAt });
    return backupMetadata(id, next);
  });
}
