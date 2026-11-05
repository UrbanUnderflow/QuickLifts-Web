import { providerConfigured } from './provider';
import { createHash } from 'crypto';
import type { firestore } from 'firebase-admin';
import { activeRecord, DashboardAccessError, loadTeamAccess, validTeamId, visibleAthlete } from '../coach-dashboard/access';
import { COLLECTION, ROOT, tokenDigest } from '../coachSurveys/service';
import { recordSmsOptOut, smsEventType, type SmsForm } from '../coachSurveys/smsOptOut';

// This existing namespace is recursively denied to clients, including the rules fallback.
export const rootFor = (db: firestore.Firestore) => db.collection(COLLECTION).doc('coach-communications-v1');
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function canCommunicate(m: Record<string, any>) {
  return Array.isArray(m.staffCapabilities)
    ? m.staffCapabilities.some((c: string) => ['admin', 'coaching'].includes(c))
    : ['team-admin', 'coach'].includes(m.role);
}
const exactPhone = (value: unknown): value is string => typeof value === 'string' && /^\+[1-9]\d{9,14}$/.test(value);
// Consent is handled externally. Missing in-app evidence is not a send gate;
// explicit withdrawals, disabled contacts and STOP remain authoritative.
export function consentAllows(c: Record<string, any>, teamId: string, athleteId: string) {
  const blocked = ['withdrawn', 'paused', 'disabled', 'denied', 'revoked', 'opted-out', 'opted_out'];
  return c.teamId === teamId && c.athleteId === athleteId && c.enabled !== false &&
    c.paused !== true && c.disabled !== true && !c.withdrawnAtMs && !c.pausedAtMs &&
    !blocked.includes(String(c.status || '').toLowerCase()) &&
    !blocked.includes(String(c.consent?.status || '').toLowerCase()) &&
    c.consent?.withdrawnAtMs == null && exactPhone(c.phone);
}
/** Server-only resolution; never copies a profile or returns its phone to inbox clients. */
export function resolveTextContact(saved: Record<string, any> | undefined, profile: Record<string, any>, teamId: string, athleteId: string): Record<string, any> {
  if (saved && (saved.teamId !== teamId || saved.athleteId !== athleteId)) return saved;
  const contact = { teamId, athleteId, displayName: String(profile.preferredName || profile.displayName || 'Athlete').slice(0,100), ...saved };
  // An existing malformed or changed contact must not silently switch recipients.
  if (saved?.phone != null && saved.phone !== '') return contact;
  const phones = [profile.phoneNumber, profile.phone].filter(value => value != null && value !== '');
  const unique = [...new Set(phones)];
  return { ...contact, phone: unique.length === 1 && exactPhone(unique[0]) ? unique[0] : null };
}
export function validateSend(body: any) {
  if (!body || !validTeamId(body.requestId) || typeof body.text !== 'string' || !body.text.trim() ||
      body.text.trim().length > 1200 || !Array.isArray(body.athleteIds) || body.athleteIds.length < 1 || body.athleteIds.length > 25 ||
      !body.athleteIds.every(validTeamId) || new Set(body.athleteIds).size !== body.athleteIds.length) {
    throw new DashboardAccessError(400, 'Choose 1–25 athletes and enter a message of up to 1,200 characters.');
  }
  return { requestId: body.requestId as string, athleteIds: [...body.athleteIds].sort() as string[], text: body.text.trim() + '\nReply STOP to opt out.' };
}
/** Reads through the same transaction so closure/deletion conflicts retry before writes. */
export function transactionReads(db: firestore.Firestore, tx: firestore.Transaction) {
  const reads = new Map<string, Promise<any>>();
  const read = (ref: any) => {
    if (!reads.has(ref.path)) reads.set(ref.path, tx.get(ref));
    return reads.get(ref.path)!;
  };
  const wrap = (ref: any): any => ({ get: () => read(ref), doc: (key: string) => wrap(ref.doc(key)), collection: (name: string) => wrap(ref.collection(name)) });
  return { collection: (name: string) => wrap(db.collection(name)) } as firestore.Firestore;
}
export async function assertCommunicationAccountOpen(db: firestore.Firestore, uid: string) {
  const [closure, profile, adminDeletion] = await Promise.all([db.collection('account-closure-jobs').doc(uid).get(), db.collection('users').doc(uid).get(), rootFor(db).collection('admin-deletions').doc(uid).get()]);
  const user = profile.data();
  if (!profile.exists || closure.exists || adminDeletion.exists || user?.accountClosureRequestedAt != null || ['closing', 'closed'].includes(user?.accountStatus) || user?.deletedAt) throw new DashboardAccessError(403, 'This account is closing or closed.');
}
export async function scope(db: firestore.Firestore, uid: string, teamId: string) {
  await assertCommunicationAccountOpen(db, uid);
  const result = await loadTeamAccess(db, uid, teamId);
  if (!result.access.participation || !canCommunicate(result.membership)) throw new DashboardAccessError(403, 'Team coaching access is required.');
  return result;
}
export async function eligible(db: firestore.Firestore, uid: string, teamId: string, athleteId: string) {
  await assertCommunicationAccountOpen(db, athleteId);
  const { membership, team } = await scope(db, uid, teamId);
  if (!visibleAthlete(membership, athleteId)) throw new DashboardAccessError(403, 'This athlete is outside your roster access.');
  const root = rootFor(db);
  const [member, contact, profile] = await Promise.all([
    db.collection('pulsecheck-team-memberships').doc(`${teamId}_${athleteId}`).get(),
    root.collection('contacts').doc(`${teamId}_${athleteId}`).get(),
    db.collection('users').doc(athleteId).get(),
  ]);
  const m = member.data() || {}, c = resolveTextContact(contact.data(), profile.data() || {}, teamId, athleteId);
  if (!member.exists || m.userId !== athleteId || m.teamId !== teamId || m.organizationId !== team.organizationId || m.role !== 'athlete' || !activeRecord(m)) throw new DashboardAccessError(403, 'This athlete is not active on this team.');
  const allowed = consentAllows(c, teamId, athleteId);
  const suppression = allowed ? await db.collection(COLLECTION).doc(ROOT).collection('sms-suppressions').doc(tokenDigest(c.phone)).get() : null;
  return { contact: c, eligible: allowed && suppression?.data()?.suppressed !== true };
}
export function transportReady(mode: unknown) {
  return mode !== 'dev' && process.env.COACH_COMMUNICATIONS_SMS_ENABLED === 'true' &&
    process.env.COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED === 'true' &&
    process.env.COACH_COMMUNICATIONS_FIREBASE_MODE === (mode === 'dev' ? 'dev' : 'prod') &&
    process.env.COACH_COMMUNICATIONS_WORKER_ENABLED === 'true' &&
    providerConfigured();
}
export async function loadInbox(db: firestore.Firestore, uid: string, teamId: string, mode: unknown, cursor?: string) {
  const { membership } = await scope(db, uid, teamId), root = rootFor(db);
  const members = await db.collection('pulsecheck-team-memberships').where('teamId', '==', teamId).get();
  const recipients = [];
  for (const doc of members.docs) {
    const m = doc.data(), id = m.userId;
    if (!validTeamId(id) || m.role !== 'athlete' || !activeRecord(m) || !visibleAthlete(membership, id)) continue;
    try {
      const { contact, eligible: allowed } = await eligible(db, uid, teamId, id);
      recipients.push({ id, name: typeof contact.displayName === 'string' ? contact.displayName.slice(0,100) : 'Athlete', eligible: allowed });
    } catch (e) { if (!(e instanceof DashboardAccessError)) throw e; }
  }
  const allowedIds = new Set(recipients.map(r => r.id));
  const messagesCollection = root.collection('teams').doc(teamId).collection('messages');
  let query = messagesCollection.orderBy('atMs', 'desc').limit(200);
  if (cursor) {
    if (!validTeamId(cursor)) throw new DashboardAccessError(400, 'Invalid inbox cursor.');
    const anchor = await messagesCollection.doc(cursor).get();
    if (!anchor.exists) throw new DashboardAccessError(400, 'Refresh the inbox to continue.');
    query = query.startAfter(anchor);
  }
  const snapshot = await query.get();
  const messages = snapshot.docs.filter(d => allowedIds.has(d.data().athleteId)).map(d => {
    const m = d.data(); return { id: d.id, athleteId: m.athleteId, text: m.text, direction: m.direction, status: m.status, atMs: m.atMs, ...(typeof m.unifiedMessageId === 'string' ? { unifiedMessageId: m.unifiedMessageId } : {}), ...(typeof m.senderId === 'string' ? { senderId: m.senderId } : {}) };
  }).reverse();
  const batchDocs = await root.collection('teams').doc(teamId).collection('batches').orderBy('atMs', 'desc').limit(20).get();
  const batches = batchDocs.docs.filter(d => Array.isArray(d.data().athleteIds) && d.data().athleteIds.every((id: string) => allowedIds.has(id))).map(d => {
    const b = d.data(); const counts: Record<string, number> = {};
    Object.values(b.states || {}).forEach(value => { const status = String(value); counts[status] = (counts[status] || 0) + 1; });
    return { id: d.id, atMs: b.atMs, recipientCount: b.athleteIds.length, counts };
  });
  return { recipients, messages, batches, ready: transportReady(mode), historyLimit: 200, nextCursor: snapshot.docs.length === 200 ? snapshot.docs[snapshot.docs.length - 1].id : null };
}
export async function receiveSms(db: firestore.Firestore, form: SmsForm) {
  // Continue processing STOP while sending is disabled, including unknown senders.
  await recordSmsOptOut(db, form);
  const root = rootFor(db), route = root.collection('routes').doc(digest([form.To, form.From]));
  await db.runTransaction(async tx => {
    const binding = await tx.get(route);
    if (!binding.exists) return;
    const { teamId, athleteId } = binding.data()!;
    if (!validTeamId(teamId) || !validTeamId(athleteId)) return;
    const [saved, profile] = await Promise.all([tx.get(root.collection('contacts').doc(`${teamId}_${athleteId}`)), tx.get(db.collection('users').doc(athleteId))]);
    const contact = resolveTextContact(saved.data(), profile.data() || {}, teamId, athleteId);
    if (contact.teamId !== teamId || contact.athleteId !== athleteId || !exactPhone(contact.phone) || contact.phone !== form.From) return;
    const readDb = transactionReads(db, tx);
    try {
      await assertCommunicationAccountOpen(readDb, athleteId);
      const { access } = await loadTeamAccess(readDb, athleteId, teamId);
      if (!access.athlete) return;
    } catch (e) { if (e instanceof DashboardAccessError) return; throw e; }
    const ref = root.collection('teams').doc(teamId).collection('messages').doc(String(form.MessageSid));
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, { athleteId, direction: 'incoming', status: 'received', text: smsEventType(form) ? `Texting preference: ${smsEventType(form)}` : String(form.Body || '').slice(0,1600), atMs: Date.now() });
  });
}
