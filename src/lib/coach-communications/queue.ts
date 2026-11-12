import { smsSender, smsProvider, sendTelnyxSms, sanitizeProviderDiagnostics, type SmsSendResult } from './provider';
import type { firestore } from 'firebase-admin';
import { validateRequest } from 'twilio';
import { DashboardAccessError, validTeamId } from '../coach-dashboard/access';
import { assertCommunicationAccountOpen, digest, eligible, rootFor, scope, transactionReads, validateSend } from './service';

const terminal = new Set(['delivered', 'failed', 'undelivered', 'canceled', 'blocked']);
const ranks: Record<string, number> = { queued: 0, sending: 1, unknown: 1, accepted: 2, sent: 3, delivered: 4, failed: 4, undelivered: 4, canceled: 4, blocked: 4 };
const messageRef = (db: firestore.Firestore, job: any, id: string) => rootFor(db).collection('teams').doc(job.teamId).collection('messages').doc(id);
const batchRef = (db: firestore.Firestore, job: any) => rootFor(db).collection('teams').doc(job.teamId).collection('batches').doc(job.batchId);

/** Atomically persist the entire group. This request never contacts the provider. */
export async function enqueueBatch(db: firestore.Firestore, uid: string, teamId: string, input: unknown, now = Date.now()) {
  const payload = validateSend(input); await scope(db, uid, teamId);
  const root = rootFor(db), batchId = digest([uid, payload.requestId]), batch = root.collection('teams').doc(teamId).collection('batches').doc(batchId);
  const fingerprint = digest(payload), prior = await batch.get();
  if (prior.exists) {
    if (prior.data()?.fingerprint !== fingerprint) throw new DashboardAccessError(409, 'This request already belongs to a different message.');
    return { batchId, queued: true, duplicate: true };
  }
  const contacts: { athleteId: string; phoneHash: string; sender: string }[] = [], phones = new Set<string>();
  for (const athleteId of payload.athleteIds) {
    const entry = await eligible(db, uid, teamId, athleteId);
    if (!entry.eligible) throw new DashboardAccessError(409, 'A recipient has no valid phone number, has paused texts, or has opted out.');
    if (phones.has(entry.contact.phone)) throw new DashboardAccessError(409, 'Recipients share a phone number. Review their identities first.');
    phones.add(entry.contact.phone);
    const from = smsSender();
    const route = await root.collection('routes').doc(digest([from, entry.contact.phone])).get();
    if (route.exists && (route.data()?.teamId !== teamId || route.data()?.athleteId !== athleteId)) throw new DashboardAccessError(409, 'This phone belongs to another team conversation.');
    contacts.push({ athleteId, phoneHash: digest(entry.contact.phone), sender: from });
  }
  const jobs = contacts.map(contact => ({ ...contact, id: digest([teamId, uid, payload.requestId, contact.athleteId]) }));
  const queued = await db.runTransaction(async tx => {
    const readDb = transactionReads(db, tx);
    await scope(readDb, uid, teamId);
    for (const contact of contacts) {
      const fresh = await eligible(readDb, uid, teamId, contact.athleteId);
      if (!fresh.eligible || digest(fresh.contact.phone) !== contact.phoneHash) throw new DashboardAccessError(409, 'Recipient permission changed.');
    }
    const existing = await tx.get(batch);
    if (existing.exists) {
      if (existing.data()?.fingerprint !== fingerprint) throw new DashboardAccessError(409, 'This request already belongs to a different message.');
      return { batchId, queued: true, duplicate: true };
    }
    const intent = root.collection('teams').doc(teamId).collection('send-intents').doc(digest([uid, payload.text, payload.athleteIds]));
    const recent = (await tx.get(intent)).data();
    if (recent?.batchId) {
      const previous = (await tx.get(root.collection('teams').doc(teamId).collection('batches').doc(recent.batchId))).data();
      if (previous && (now - recent.atMs < 600000 || Object.values(previous.states || {}).some(s => ['queued','sending','unknown'].includes(String(s))))) return { batchId: recent.batchId as string, queued: true, duplicate: true };
    }
    const limit = root.collection('send-limits').doc(digest([uid, Math.floor(now / 60000)]));
    const usage = (await tx.get(limit)).data()?.count || 0;
    if (usage >= 5) throw new DashboardAccessError(429, 'Wait a minute before starting another group send.');
    tx.set(limit, { count: usage + 1, atMs: now });
    tx.set(intent, { batchId, atMs: now });
    tx.create(batch, { uid, fingerprint, atMs: now, athleteIds: payload.athleteIds, states: Object.fromEntries(jobs.map(j => [j.id, 'queued'])) });
    for (const job of jobs) {
      const data = { ...job, teamId, uid, batchId, text: payload.text, provider: smsProvider(), state: 'queued', atMs: now };
      tx.create(root.collection('jobs').doc(job.id), data);
      tx.create(messageRef(db, data, job.id), { athleteId: job.athleteId, batchId, text: payload.text, direction: 'outgoing', status: 'queued', atMs: now, senderId: uid });
    }
    return { batchId, queued: true, duplicate: false };
  });
  return queued;
}

async function transition(db: firestore.Firestore, id: string, state: string, providerId?: string, diagnostics?: unknown) {
  const safeDiagnostics = sanitizeProviderDiagnostics(diagnostics);
  const diagnosticUpdate = safeDiagnostics ? { providerDiagnostics: safeDiagnostics } : {};
  const ref = rootFor(db).collection('jobs').doc(id);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref); if (!snapshot.exists) return;
    const job = snapshot.data()!, batch = batchRef(db, job), b = (await tx.get(batch)).data();
    const message = await tx.get(messageRef(db, job, id));
    // Drain orphaned or closed-account work without recreating erased records.
    if (state === 'blocked' && job.state === 'queued' || state === 'unknown' && job.state === 'sending') {
      tx.set(ref, { state, ...diagnosticUpdate, updatedAtMs: Date.now() }, { merge: true });
      if (message.exists) tx.set(messageRef(db, job, id), { status: state }, { merge: true });
      if (b) tx.set(batch, { states: { ...(b.states || {}), [id]: state } }, { merge: true });
      return;
    }
    if (!b || !message.exists) return;
    try {
      const readDb = transactionReads(db, tx);
      await assertCommunicationAccountOpen(readDb, job.uid);
      await assertCommunicationAccountOpen(readDb, job.athleteId);
    } catch (e) { if (e instanceof DashboardAccessError) return; throw e; }
    if (state === 'blocked' && job.state !== 'queued') return;
    if (terminal.has(job.state) || ranks[state] < ranks[job.state] || job.providerId && providerId && job.providerId !== providerId) return;
    const update = { state, ...diagnosticUpdate, ...(providerId ? { providerId } : {}), updatedAtMs: Date.now() };
    tx.set(ref, update, { merge: true });
    tx.set(messageRef(db, job, id), { status: state, ...(providerId ? { providerId } : {}) }, { merge: true });
    tx.set(batch, { states: { ...(b?.states || {}), [id]: state } }, { merge: true });
  });
}

export type Transport = (args: { to: string; body: string; jobId: string }) => Promise<SmsSendResult>;
/** One durable job can cross the provider boundary only once, including concurrent workers. */
export async function processJob(db: firestore.Firestore, id: string, send: Transport, now = Date.now()) {
  const ref = rootFor(db).collection('jobs').doc(id), snap = await ref.get();
  if (!snap.exists || snap.data()?.state !== 'queued') return;
  const job = snap.data()!;
  let entry;
  try {
    entry = await eligible(db, job.uid, job.teamId, job.athleteId);
    if (!entry.eligible || digest(entry.contact.phone) !== job.phoneHash || job.sender !== smsSender() || (job.provider || 'twilio') !== smsProvider()) throw new DashboardAccessError(409, 'Contact changed.');
  } catch (e) {
    if (e instanceof DashboardAccessError) { await transition(db, id, 'blocked'); return; }
    throw e; // Transient DB errors leave the unclaimed job queued.
  }
  const root = rootFor(db), route = root.collection('routes').doc(digest([job.sender, entry.contact.phone]));
  let claimed = false;
  try {
    claimed = await db.runTransaction(async tx => {
      const [current, binding, batch] = await Promise.all([tx.get(ref), tx.get(route), tx.get(batchRef(db, job))]);
      if (current.data()?.state !== 'queued') return false;
      if (!batch.exists || !(await tx.get(messageRef(db, job, id))).exists) throw new DashboardAccessError(409, 'Conversation removed.');
      // Recheck all authority, athlete membership and consent in the same claim transaction.
      const readDb = transactionReads(db, tx);
      const fresh = await eligible(readDb, job.uid, job.teamId, job.athleteId);
      if (!fresh.eligible || digest(fresh.contact.phone) !== job.phoneHash || binding.exists && (binding.data()?.teamId !== job.teamId || binding.data()?.athleteId !== job.athleteId)) throw new DashboardAccessError(409, 'Recipient permission changed.');
      tx.set(route, { teamId: job.teamId, athleteId: job.athleteId });
      tx.set(ref, { state: 'sending', claimedAtMs: now }, { merge: true });
      tx.set(messageRef(db, job, id), { status: 'sending' }, { merge: true });
      tx.set(batchRef(db, job), { states: { ...(batch.data()?.states || {}), [id]: 'sending' } }, { merge: true });
      return true;
    });
  } catch(e) {
    if (e instanceof DashboardAccessError) { await transition(db, id, 'blocked'); return; }
    throw e;
  }
  if (!claimed) return;
  let result: Awaited<ReturnType<Transport>>;
  try { result = await send({ to: entry.contact.phone, body: job.text, jobId: id }); }
  catch { result = { state: 'unknown', diagnostics: { failureStage: 'transport' } }; }
  await transition(db, id, result.state, result.providerId, result.diagnostics);
}

export async function processQueue(db: firestore.Firestore, send: Transport, now = Date.now()) {
  const jobs = rootFor(db).collection('jobs');
  // A stale reservation might have reached Twilio. Never put it back on the queue.
  const stuck = await jobs.where('state', '==', 'sending').limit(5).get();
  for (const doc of stuck.docs) if (now - (doc.data().claimedAtMs || now) > 120000) await transition(db, doc.id, 'unknown');
  const pending = await jobs.where('state', '==', 'queued').limit(3).get();
  let processed = 0;
  for (const job of pending.docs) {
    if (Date.now() - now > 15000) break;
    await processJob(db, job.id, send); processed++;
  }
  return { inspected: processed };
}

/** Bounded call. Any uncertain network result stays unknown and is never resent automatically. */
export const sendQueuedSms: Transport = async ({ to, body, jobId }) => {
  if (smsProvider() === 'telnyx') return sendTelnyxSms({ to, body, jobId });
  if (smsProvider() !== 'twilio') return { state: 'failed' };
  const sid = process.env.TWILIO_ACCOUNT_SID || '', token = process.env.TWILIO_AUTH_TOKEN || '';
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: smsSender(), Body: body, StatusCallback: `${process.env.COACH_COMMUNICATIONS_STATUS_WEBHOOK_URL}?job=${jobId}` }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && /^SM[a-fA-F0-9]{32}$/.test(result.sid || '')) return { state: 'accepted', providerId: result.sid };
    return { state: response.status >= 500 || response.ok ? 'unknown' : 'failed' };
  } catch { return { state: 'unknown' }; }
  finally { clearTimeout(timeout); }
};

export function verifyStatusWebhook(jobId: unknown, form: any, signature: unknown) {
  if (!validTeamId(jobId) || typeof signature !== 'string' || !form || typeof form !== 'object' || Object.values(form).some(v => typeof v !== 'string')) return false;
  const url = process.env.COACH_COMMUNICATIONS_STATUS_WEBHOOK_URL || '', token = process.env.TWILIO_AUTH_TOKEN || '';
  if (!/^https:\/\/[^?#]+$/.test(url) || !token || form.AccountSid !== process.env.TWILIO_ACCOUNT_SID || form.From !== process.env.TWILIO_FROM_NUMBER || !/^SM[a-fA-F0-9]{32}$/.test(form.MessageSid || '') || !['accepted', 'queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'canceled'].includes(form.MessageStatus)) return false;
  return validateRequest(token, signature, `${url}?job=${jobId}`, form);
}
export async function recordDelivery(db: firestore.Firestore, id: string, form: Record<string, string>, provider = 'twilio') {
  const job = (await rootFor(db).collection('jobs').doc(id).get()).data();
  if (!job || (job.provider || 'twilio') !== provider || job.state === 'queued' || digest(form.To) !== job.phoneHash || job.sender !== form.From || job.providerId && job.providerId !== form.MessageSid) return;
  // Twilio's queued/sending statuses indicate provider acceptance, not our local queue.
  await transition(db, id, ['queued', 'sending'].includes(form.MessageStatus) ? 'accepted' : form.MessageStatus, form.MessageSid);
}

export async function cancelBatch(db: firestore.Firestore, uid: string, teamId: string, batchId: string) {
  const { membership } = await scope(db, uid, teamId);
  const { visibleAthlete } = await import('../coach-dashboard/access');
  const root = rootFor(db), batch = root.collection('teams').doc(teamId).collection('batches').doc(batchId);
  const b = (await batch.get()).data();
  if (!b || !Array.isArray(b.athleteIds) || !b.athleteIds.every((id: string) => visibleAthlete(membership, id))) throw new DashboardAccessError(403, 'This group is outside your roster access.');
  let canceled = 0;
  for (const id of Object.keys(b.states || {})) {
    const ref = root.collection('jobs').doc(id);
    const changed = await db.runTransaction(async tx => {
      const [job, current] = await Promise.all([tx.get(ref), tx.get(batch)]);
      if (!current.exists || !(await tx.get(messageRef(db, job.data() || {teamId}, id))).exists) return false;
      const fresh = await scope(transactionReads(db, tx), uid, teamId);
      if (!Array.isArray(current.data()?.athleteIds) || !current.data()!.athleteIds.every((athleteId: string) => visibleAthlete(fresh.membership, athleteId))) throw new DashboardAccessError(403, 'This group is outside your roster access.');
      if (job.data()?.state !== 'queued' || job.data()?.teamId !== teamId || job.data()?.batchId !== batchId) return false;
      tx.set(ref, { state: 'canceled', canceledBy: uid, updatedAtMs: Date.now() }, { merge: true });
      tx.set(messageRef(db, job.data(), id), { status: 'canceled' }, { merge: true });
      tx.set(batch, { states: { ...(current.data()?.states || {}), [id]: 'canceled' } }, { merge: true });
      return true;
    });
    if (changed) canceled++;
  }
  return { canceled };
}
