import { createHash } from 'crypto';
import { sequenceReadinessIssues, type EmailSequence, type SequenceStep } from '../../../src/utils/pipelistsEmailSequence';
import { sendBrevoTransactionalEmail } from '../utils/emailSequenceHelpers';

export const COLLECTION = 'pipeListEmailSequences';
export const OWNER_EMAIL = 'tremaine.grant@gmail.com';
const SENDERS = ['tre@fitwithpulse.ai', 'hello@fitwithpulse.ai', 'info@fitwithpulse.ai'];
type StoredSequence = EmailSequence & { attempt?: { index: number; startedAt: string } | null };
type DB = FirebaseFirestore.Firestore;
export class SequenceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function sequenceId(uid: string, listId: string, itemId: string) {
  return createHash('sha256').update(JSON.stringify([uid, listId, itemId])).digest('hex');
}
export function requireId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || value.includes('/')) throw new SequenceError(400, 'Invalid list or lead.');
  return value;
}
export function easternDate(date: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(v => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
// Calendar-day intervals preserve the local send hour when daylight saving changes.
export function addEasternDays(iso: string, days: number): string {
  const parts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(v => [v.type, Number(v.value)]));
  const p = parts(new Date(iso));
  const target = Date.UTC(p.year, p.month - 1, p.day + days, p.hour, p.minute, p.second);
  let guess = target;
  for (let i = 0; i < 3; i++) { const q = parts(new Date(guess)); guess += target - Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute, q.second); }
  return new Date(guess).toISOString();
}
export function validateDraft(input: any, existing?: StoredSequence): Pick<EmailSequence, 'audience' | 'fromEmail' | 'toEmail' | 'ccEmails' | 'bccEmails' | 'steps'> {
  if (!input || !['athletic-directors', 'coaches', 'medical'].includes(input.audience)) throw new SequenceError(400, 'Select an email sequence.');
  const fromEmail = String(input.fromEmail || 'tre@fitwithpulse.ai').trim().toLowerCase();
  const toEmail = String(input.toEmail || '').trim().toLowerCase();
  if (!SENDERS.includes(fromEmail)) throw new SequenceError(400, 'Select an approved From address.');
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(toEmail) || toEmail.length > 254) throw new SequenceError(400, 'Enter a valid recipient email.');
  const seen = new Set([toEmail]);
  const copies = (value: unknown): string[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 50) throw new SequenceError(400, 'Use up to 50 email recipients total.');
    const result: string[] = [];
    for (const entry of value) {
      const email = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
      if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) || email.length > 254) throw new SequenceError(400, 'Enter valid CC and BCC email addresses.');
      if (!seen.has(email)) { seen.add(email); result.push(email); }
    }
    return result;
  };
  const ccEmails = copies(input.ccEmails), bccEmails = copies(input.bccEmails);
  if (seen.size > 50) throw new SequenceError(400, 'Use up to 50 email recipients total.');
  if (!Array.isArray(input.steps) || input.steps.length !== 3) throw new SequenceError(400, 'The sequence requires three emails.');
  const steps = input.steps.map((s: any, i: number): SequenceStep => {
    if (!s || typeof s.subject !== 'string' || typeof s.body !== 'string' || s.subject.length > 180 || s.body.length > 12000 || !Number.isInteger(s.delayDays) || s.delayDays < (i ? 1 : 0) || s.delayDays > 365) throw new SequenceError(400, 'Check the email subject, message, and interval.');
    const old = existing?.steps[i];
    if (old?.sentAt && (s.subject !== old.subject || s.body !== old.body || s.delayDays !== old.delayDays)) throw new SequenceError(400, 'Sent emails cannot be edited.');
    return { id: old?.id || `email-${i + 1}`, delayDays: i ? s.delayDays : 0, subject: s.subject, body: s.body, sentAt: old?.sentAt || '', messageId: old?.messageId || '', ...(old?.tracking ? { tracking: old.tracking } : {}) };
  });
  if (existing?.steps.some(s => s.sentAt) && (existing.toEmail !== toEmail || JSON.stringify([...(existing.ccEmails || [])].sort()) !== JSON.stringify([...ccEmails].sort()) || JSON.stringify([...(existing.bccEmails || [])].sort()) !== JSON.stringify([...bccEmails].sort()) || existing.audience !== input.audience)) throw new SequenceError(400, 'The recipient and sequence cannot change after sending starts.');
  return { audience: input.audience, fromEmail, toEmail, ccEmails, bccEmails, steps };
}
export function requireReady(sequence: Pick<EmailSequence, 'steps'>) {
  const issues = sequenceReadinessIssues(sequence.steps);
  if (issues.length) {
    const details = issues.map(issue => `Day ${issue.day} / Email ${issue.stepIndex + 1} ${issue.field === 'subject' ? 'subject' : 'message'}: ${issue.empty ? 'add text' : issue.placeholders.join(', ')}`).join('; ');
    throw new SequenceError(400, `Complete these fields or placeholders before automatic follow-ups: ${details}`);
  }
}
async function readLead(db: DB, tx: FirebaseFirestore.Transaction, uid: string, listId: string, itemId?: string) {
  const stateRef = db.collection('simpbudget-users').doc(uid).collection('pipeLists').doc('state');
  const protectedRef = db.collection('pipeListProtectedShares').doc(`${uid}-${listId}`);
  const [state, protectedDoc] = await Promise.all([tx.get(stateRef), tx.get(protectedRef)]);
  const lists = state.data()?.lists || [];
  const personalList = lists.find((l: any) => l.id === listId && !l.deletedAt);
  if (!personalList) throw new SequenceError(404, 'This list no longer exists.');
  if (itemId && !personalList.items?.some((item: any) => item.id === itemId && !item.deletedAt)) throw new SequenceError(404, 'This lead no longer exists in the list.');
  const protectedList = protectedDoc.data()?.list;
  const list = protectedList?.id === listId ? protectedList : personalList;
  if (protectedDoc.exists && protectedDoc.data()?.ownerUid && protectedDoc.data()?.ownerUid !== uid) throw new SequenceError(403, 'You do not own this list.');
  const item = itemId ? list.items?.find((i: any) => i.id === itemId && !i.deletedAt) : null;
  if (itemId && !item) throw new SequenceError(404, 'This lead no longer exists.');
  return { stateRef, protectedRef, lists, list, item, protectedList, personalItem: personalList.items?.find((item: any) => item.id === itemId) };
}
async function clearScheduledDueDate(db: DB, tx: FirebaseFirestore.Transaction, s: StoredSequence) {
  if (!s.nextSendAt) return;
  const lead = await readLead(db, tx, s.ownerUid, s.listId, s.itemId).catch(() => null);
  if (!lead) return;
  const scheduledDate = easternDate(new Date(s.nextSendAt));
  const clear = (list: any) => ({ ...list, items: list.items.map((item: any) => item.id === s.itemId && item.dueDate === scheduledDate ? { ...item, dueDate: '' } : item) });
  tx.update(lead.stateRef, { lists: lead.lists.map((list: any) => list.id === s.listId ? clear(list) : list) });
  if (lead.protectedList) tx.update(lead.protectedRef, { list: clear(lead.protectedList) });
}
export async function readSequences(db: DB, uid: string, listId: string, itemId?: string) {
  await db.runTransaction(tx => readLead(db, tx, uid, listId, itemId));
  if (itemId) {
    const data = (await db.collection(COLLECTION).doc(sequenceId(uid, listId, itemId)).get()).data();
    return data ? { ...data, ccEmails: data.ccEmails || [], bccEmails: data.bccEmails || [] } : null;
  }
  const snapshot = await db.collection(COLLECTION).where('ownerUid', '==', uid).get();
  return snapshot.docs.map(d => ({ ...d.data(), ccEmails: d.data().ccEmails || [], bccEmails: d.data().bccEmails || [] } as FirebaseFirestore.DocumentData)).filter(s => s.listId === listId);
}
export async function mutateSequence(db: DB, uid: string, input: any, now = new Date()): Promise<StoredSequence> {
  const listId = requireId(input.listId), itemId = requireId(input.itemId);
  if (!['save', 'send', 'pause', 'resume'].includes(input.action) || !Number.isInteger(input.expectedVersion)) throw new SequenceError(400, 'Invalid sequence action or version.');
  const ref = db.collection(COLLECTION).doc(sequenceId(uid, listId, itemId));
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const lead = await readLead(db, tx, uid, listId, itemId);
    const old = snap.data() as StoredSequence | undefined;
    if ((old?.version || 0) !== input.expectedVersion) throw new SequenceError(409, 'This sequence changed. Reload before saving.');
    if (old?.attempt) throw new SequenceError(409, 'An email is being sent or needs delivery review. Reload shortly.');
    const timestamp = now.toISOString();
    const draft = input.sequence ? validateDraft(input.sequence, old) : old;
    if (!draft) throw new SequenceError(400, 'Prepare the sequence first.');
    const next: StoredSequence = { id: ref.id, ownerUid: uid, listId, itemId, status: 'draft', nextStepIndex: 0, nextSendAt: '', version: 0, lastError: '', createdAt: timestamp, updatedAt: timestamp, ...old, audience: draft.audience, fromEmail: draft.fromEmail, toEmail: draft.toEmail, ccEmails: draft.ccEmails || [], bccEmails: draft.bccEmails || [], steps: draft.steps };
    if (input.action === 'send') {
      if (next.status !== 'draft' || next.nextStepIndex !== 0) throw new SequenceError(409, 'This sequence has already started.');
      requireReady(next); next.status = 'active'; next.nextSendAt = timestamp;
    } else if (input.action === 'pause') {
      if (next.status !== 'active') throw new SequenceError(409, 'Only an active sequence can be paused.');
      next.status = 'paused'; next.nextSendAt = '';
    } else if (input.action === 'resume') {
      if (next.status !== 'paused') throw new SequenceError(409, 'Only a paused sequence can resume. Delivery errors require review.');
      requireReady(next); next.status = 'active';
      const prior = next.steps[next.nextStepIndex - 1];
      next.nextSendAt = addEasternDays(timestamp, prior ? next.steps[next.nextStepIndex].delayDays : 1);
    } else if (next.status === 'active') {
      requireReady(next);
      const prior = next.steps[next.nextStepIndex - 1];
      if (prior) {
        next.nextSendAt = addEasternDays(prior.sentAt, next.steps[next.nextStepIndex].delayDays);
        if (next.nextSendAt <= timestamp && next.nextSendAt !== old?.nextSendAt) throw new SequenceError(400, 'That interval makes the next email overdue. Pause the sequence before shortening it, then resume to schedule from today.');
      }
    }
    next.version = (old?.version || 0) + 1; next.updatedAt = timestamp;
    if (old?.status === 'active' || next.status === 'active' || next.status === 'paused') {
      const dueDate = next.nextSendAt ? easternDate(new Date(next.nextSendAt)) : '';
      const updateList = (list: any) => ({ ...list, items: list.items.map((item: any) => item.id === itemId ? { ...item, dueDate, updatedAt: timestamp } : item) });
      tx.update(lead.stateRef, { lists: lead.lists.map((list: any) => list.id === listId ? updateList(list) : list) });
      if (lead.protectedList) tx.update(lead.protectedRef, { list: updateList(lead.protectedList), updatedAt: timestamp });
    }
    tx.set(ref, next);
    return next;
  });
}
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function emailHtml(body: string, sender: string) {
  const text = escapeHtml(body).replace(/(https?:\/\/[^\s<>]+)/g, url => `<a href="${url}">${url}</a>`).replace(/\n/g, '<br>');
  return `<div>${text}<p><strong>Tremaine Grant</strong><br>Founder &amp; CEO · <a href="https://pulseintelligencelabs.com">Pulse Intelligence Labs</a><br><a href="mailto:${escapeHtml(sender)}">${escapeHtml(sender)}</a></p></div>`;
}
export async function dispatchSequence(db: DB, id: string, now = new Date(), send = sendBrevoTransactionalEmail): Promise<StoredSequence | null> {
  const ref = db.collection(COLLECTION).doc(id);
  const claimed = await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const s = snap.data() as StoredSequence | undefined;
    if (!s || s.status !== 'active' || !s.nextSendAt || s.nextSendAt > now.toISOString()) return null;
    if (s.attempt) {
      if (now.getTime() - new Date(s.attempt.startedAt).getTime() > 15 * 60000) {
        await clearScheduledDueDate(db, tx, s);
        tx.update(ref, { status: 'error', lastError: 'Delivery outcome is uncertain. Check Brevo before any further send.', nextSendAt: '', updatedAt: now.toISOString(), version: s.version + 1 });
      }
      return null;
    }
    try {
      const lead = await readLead(db, tx, s.ownerUid, s.listId, s.itemId);
      if (['unsubscribed', 'unsubscribe', 'blocked', 'hard_bounce', 'spam', 'invalid_email', 'error'].some(status => [lead.item.emailStatus, lead.personalItem?.emailStatus].includes(status))) throw new Error('The contact has an email delivery issue. Review before continuing.');
      validateDraft(s, s);
      requireReady(s);
    } catch (error) {
      await clearScheduledDueDate(db, tx, s);
      tx.update(ref, { status: 'error', nextSendAt: '', lastError: (error as Error).message, version: s.version + 1 }); return null;
    }
    const next = { ...s, attempt: { index: s.nextStepIndex, startedAt: now.toISOString() }, version: s.version + 1, updatedAt: now.toISOString() };
    tx.set(ref, next); return next;
  });
  if (!claimed) return null;
  const step = claimed.steps[claimed.nextStepIndex];
  const key = `pipelists-sequence:${id}:${step.id}`;
  let result;
  try {
    result = await send({ toEmail: claimed.toEmail, cc: (claimed.ccEmails || []).map(email => ({ email })), bcc: (claimed.bccEmails || []).map(email => ({ email })), checkAllRecipientSuppression: true, subject: step.subject, htmlContent: emailHtml(step.body, claimed.fromEmail), sender: { email: claimed.fromEmail, name: claimed.fromEmail === 'tre@fitwithpulse.ai' ? 'Tremaine Grant' : 'Pulse' }, preserveSenderEmail: true, replyTo: { email: claimed.fromEmail }, tags: ['pipelists', 'school-outreach'], headers: { 'X-Mailin-custom': JSON.stringify({ pipeListsOwnerUid: claimed.ownerUid, pipeListsListId: claimed.listId, pipeListsItemIds: [claimed.itemId], pipeListsEmailType: 'school-outreach', pipeListsSequenceId: id, pipeListsSequenceStepId: step.id, pipeListsEmailBatchId: key, pipeListsEmailRecordId: key }) }, idempotencyKey: key, idempotencyMetadata: { feature: 'PipeLists school outreach', sequenceId: id, stepId: step.id }, bypassDailyRecipientLimit: true, failClosedOnSuppressionError: true });
  } catch (error) { result = { success: false, error: `Delivery outcome is uncertain: ${(error as Error).message}` }; }
  const sentAt = new Date().toISOString();
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref); const current = snap.data() as StoredSequence;
    if (current.attempt?.index !== claimed.nextStepIndex) throw new SequenceError(409, 'The delivery claim changed.');
    const next = { ...current, version: current.version + 1, updatedAt: sentAt, attempt: null };
    const earlyMessageId = current.steps[claimed.nextStepIndex].messageId;
    const mismatchedMessage = earlyMessageId && result.messageId && earlyMessageId.replace(/^<|>$/g, '') !== result.messageId.replace(/^<|>$/g, '');
    if (!result.success || result.suppressed || result.skipped || !result.messageId || mismatchedMessage) {
      await clearScheduledDueDate(db, tx, current);
      next.status = 'error'; next.nextSendAt = ''; next.lastError = result.error || result.suppressionReason || 'Email was not confirmed sent. Review delivery before continuing.';
      tx.set(ref, next); return next;
    }
    const lead = await readLead(db, tx, current.ownerUid, current.listId, current.itemId).catch(() => null);
    next.steps = current.steps.map((s, i) => i === claimed.nextStepIndex ? { ...s, sentAt, messageId: result.messageId!, tracking: s.tracking || { status: 'sent', openCount: 0, clickCount: 0, lastEventAt: sentAt } } : s);
    next.nextStepIndex += 1; next.lastError = '';
    next.status = next.nextStepIndex === next.steps.length ? 'completed' : 'active';
    next.nextSendAt = next.status === 'active' ? addEasternDays(sentAt, next.steps[next.nextStepIndex].delayDays) : '';
    if (!lead) { next.status = 'error'; next.nextSendAt = ''; next.lastError = 'Email sent, but the lead was removed. Follow-ups stopped.'; }
    if (lead) {
      const updateList = (list: any) => ({ ...list, items: list.items.map((item: any) => item.id !== current.itemId ? item : { ...item, contactEmails: [...new Set([...(Array.isArray(item.contactEmails) ? item.contactEmails : []), current.toEmail, ...(current.ccEmails || [])].map((email: string) => email.trim().toLowerCase()).filter(Boolean))], dueDate: next.nextSendAt ? easternDate(new Date(next.nextSendAt)) : '', emailStatus: next.steps[claimed.nextStepIndex].tracking?.status || 'sent', lastEmailEvent: next.steps[claimed.nextStepIndex].tracking?.status || 'sent', emailOpenCount: next.steps[claimed.nextStepIndex].tracking?.openCount || 0, emailClickCount: next.steps[claimed.nextStepIndex].tracking?.clickCount || 0, lastEmailOpenedAt: next.steps[claimed.nextStepIndex].tracking?.openedAt || '', lastEmailDeliveredAt: next.steps[claimed.nextStepIndex].tracking?.deliveredAt || '', lastEmailClickedAt: next.steps[claimed.nextStepIndex].tracking?.clickedAt || '', lastEmailClickedLink: next.steps[claimed.nextStepIndex].tracking?.lastClickedLink || '', lastEmailIssueAt: next.steps[claimed.nextStepIndex].tracking?.lastIssueAt || '', lastEmailSentAt: sentAt, lastEmailMessageId: result.messageId, lastEmailType: 'school-outreach', updatedAt: sentAt, weeklyLogs: [...(item.weeklyLogs || []), { id: key, type: 'update', summary: `School outreach sent to ${current.toEmail}.`, notes: `From: ${current.fromEmail}\nTo: ${current.toEmail}${current.ccEmails?.length ? `\nCc: ${current.ccEmails.join(', ')}` : ''}\nSubject: ${step.subject}\nMessage ID: ${result.messageId}\n\nMessage:\n${step.body}`, createdAt: sentAt, weekOf: easternDate(new Date(sentAt)), systemAction: 'email-sent', relatedItemId: current.itemId }] }) });
      tx.update(lead.stateRef, { lists: lead.lists.map((l: any) => l.id === current.listId ? updateList(l) : l) });
      if (lead.protectedList) tx.update(lead.protectedRef, { list: updateList(lead.protectedList), updatedAt: sentAt });
    }
    tx.set(ref, next); return next;
  });
}
