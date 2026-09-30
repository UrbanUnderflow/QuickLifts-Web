import { createHash } from 'crypto';
import type { EmailSequence, SequenceTracking } from '../../../src/utils/pipelistsEmailSequence';
const COLLECTION = 'pipeListEmailSequences';
const issues = new Set(['soft_bounce', 'hard_bounce', 'blocked', 'spam', 'unsubscribed', 'invalid_email', 'error', 'deferred']);
const messageKey = (value: string) => String(value || '').trim().replace(/^<|>$/g, '');
export function reduceSequenceTracking(old: SequenceTracking | undefined, event: string, at: string, link?: string): SequenceTracking {
  const status = event === 'request' ? 'sent' : event === 'click' ? 'clicked' : event === 'unsubscribe' ? 'unsubscribed' : event;
  const next: SequenceTracking = { status: 'sent', openCount: 0, clickCount: 0, ...old };
  const rank: Record<string, number> = { sent: 1, delivered: 2, opened: 3, clicked: 4 };
  if (issues.has(status) || (!issues.has(next.status) && (rank[status] || 0) >= (rank[next.status] || 0))) next.status = status;
  next.lastEventAt = !next.lastEventAt || at > next.lastEventAt ? at : next.lastEventAt;
  if (status === 'delivered' && (!next.deliveredAt || at < next.deliveredAt)) next.deliveredAt = at;
  if (status === 'opened') { next.openCount = (next.openCount || 0) + 1; if (!next.openedAt || at >= next.openedAt) next.openedAt = at; }
  if (status === 'clicked') { next.clickCount = (next.clickCount || 0) + 1; if (!next.clickedAt || at >= next.clickedAt) { next.clickedAt = at; next.lastClickedLink = link || ''; } }
  if (issues.has(status)) next.lastIssueAt = !next.lastIssueAt || at > next.lastIssueAt ? at : next.lastIssueAt;
  return next;
}
export async function trackSequenceEvent(db: FirebaseFirestore.Firestore, args: {
  sequenceId: string; stepId: string; ownerUid: string; listId: string; itemIds: string[];
  email: string; messageId: string; event: string; eventAt: string; eventId?: string | number; link?: string; authenticated: boolean;
}) {
  if (!args.authenticated || !args.sequenceId || args.sequenceId.includes('/') || !args.messageId || !args.eventAt || Number.isNaN(Date.parse(args.eventAt))) return false;
  const ref = db.collection(COLLECTION).doc(args.sequenceId);
  const dedupe = createHash('sha256').update(JSON.stringify([messageKey(args.messageId), args.event, Math.floor(Date.parse(args.eventAt) / 1000), args.link || ''])).digest('hex');
  const eventRef = ref.collection('events').doc(dedupe);
  return db.runTransaction(async tx => {
    const [snapshot, previousEvent] = await Promise.all([tx.get(ref), tx.get(eventRef)]);
    if (previousEvent.exists) return false;
    const sequence = snapshot.data() as (EmailSequence & { attempt?: { index: number; startedAt: string } }) | undefined;
    if (!sequence || sequence.ownerUid !== args.ownerUid || sequence.listId !== args.listId || !args.itemIds.includes(sequence.itemId) || sequence.toEmail.toLowerCase() !== args.email.trim().toLowerCase()) return false;
    const index = sequence.steps.findIndex(step => step.id === args.stepId);
    const step = sequence.steps[index];
    if (!step) return false;
    const claimed = sequence.attempt?.index === index;
    if (step.messageId ? messageKey(step.messageId) !== messageKey(args.messageId) : !claimed) return false;
    const earliest = step.sentAt || sequence.attempt?.startedAt;
    if (!earliest || Date.parse(args.eventAt) < Date.parse(earliest) - 60000) return false;
    const tracking = reduceSequenceTracking(step.tracking, args.event, args.eventAt, args.link);
    const stateRef = db.collection('simpbudget-users').doc(sequence.ownerUid).collection('pipeLists').doc('state');
    const protectedRef = db.collection('pipeListProtectedShares').doc(`${sequence.ownerUid}-${sequence.listId}`);
    const [state, protectedDoc] = await Promise.all([tx.get(stateRef), tx.get(protectedRef)]);
    const steps = sequence.steps.map((value, i) => i === index ? { ...value, messageId: value.messageId || args.messageId, tracking } : value);
    // Event-only updates do not change the workflow version. Draft saves re-read and preserve tracking.
    tx.update(ref, { steps });
    tx.set(eventRef, { event: args.event, eventAt: args.eventAt, messageId: args.messageId, stepId: args.stepId, providerEventId: String(args.eventId || '') });
    const latestIndex = Math.max(...sequence.steps.map((s, i) => s.sentAt || s.messageId || sequence.attempt?.index === i ? i : -1));
    const isLatest = index === latestIndex;
    const updateList = (list: any) => ({ ...list, items: (list.items || []).map((item: any) => {
      if (item.id !== sequence.itemId || item.deletedAt) return item;
      const statusLabel = args.event === 'request' ? 'Sent' : args.event === 'click' ? 'Clicked' : args.event.charAt(0).toUpperCase() + args.event.slice(1).replace(/_/g, ' ');
      const log = { id: `sequence-event-${dedupe}`, type: 'update', summary: `School Outreach ${args.event === 'click' ? 'clicked' : args.event} · email ${index + 1}.`, notes: `To: ${sequence.toEmail}\nSubject: ${step.subject}\nStatus: ${statusLabel}\nMessage ID: ${args.messageId}${args.link ? `\nLink: ${args.link}` : ''}`, createdAt: args.eventAt, weekOf: args.eventAt.slice(0, 10), systemAction: 'email-sent', relatedItemId: sequence.itemId };
      const sentTime = Date.parse(step.sentAt || sequence.attempt?.startedAt || '');
      const itemTime = Date.parse(item.lastEmailSentAt || '');
      const sameMessage = messageKey(item.lastEmailMessageId) === messageKey(args.messageId);
      const mayUpdateLead = isLatest && (!item.lastEmailMessageId || sameMessage || (Number.isFinite(sentTime) && Number.isFinite(itemTime) && sentTime > itemTime));
      const latestFields = mayUpdateLead ? { emailStatus: tracking.status, lastEmailEvent: tracking.status, lastEmailMessageId: args.messageId, lastEmailType: 'school-outreach', lastEmailEventAt: tracking.lastEventAt, emailOpenCount: tracking.openCount || 0, emailClickCount: tracking.clickCount || 0, lastEmailDeliveredAt: tracking.deliveredAt || '', lastEmailOpenedAt: tracking.openedAt || '', lastEmailClickedAt: tracking.clickedAt || '', lastEmailClickedLink: tracking.lastClickedLink || '', lastEmailIssueAt: tracking.lastIssueAt || '' } : {};
      return { ...item, ...latestFields, weeklyLogs: args.event === 'request' ? (item.weeklyLogs || []) : [...(item.weeklyLogs || []), log] };
    }) });
    const lists = state.data()?.lists;
    if (Array.isArray(lists)) tx.update(stateRef, { lists: lists.map((list: any) => list.id === sequence.listId ? updateList(list) : list) });
    const protectedList = protectedDoc.data()?.list;
    if (protectedList?.id === sequence.listId && (!protectedDoc.data()?.ownerUid || protectedDoc.data()?.ownerUid === sequence.ownerUid)) tx.update(protectedRef, { list: updateList(protectedList) });
    return true;
  });
}

const normalizeEvent = (raw: unknown) => {
  const value = String(raw || '');
  if (['unique_opened', 'uniqueOpened', 'proxy_open', 'unique_proxy_open', 'uniqueProxyOpen'].includes(value)) return 'opened';
  if (['clicks', 'clicked'].includes(value)) return 'click';
  if (['sent', 'requests'].includes(value)) return 'request';
  if (value === 'unsubscribed') return 'unsubscribe';
  if (value === 'softBounce') return 'soft_bounce';
  if (value === 'hardBounce') return 'hard_bounce';
  if (value === 'invalid') return 'invalid_email';
  return ['request', 'delivered', 'opened', 'click', 'unsubscribe', ...issues].includes(value) ? value : '';
};
export async function refreshSequenceTracking(db: FirebaseFirestore.Firestore, sequence: EmailSequence, apiKey: string, fetchEvents: typeof fetch = fetch) {
  if (!apiKey) throw new Error('Brevo is not configured. Tracking could not be refreshed.');
  const deadline = Date.now() + 18000;
  const checkDeadline = () => { if (Date.now() >= deadline) throw new Error('Tracking was partially refreshed. Some events remain unconfirmed; refresh again shortly.'); };
  const outcomes = await Promise.allSettled(sequence.steps.filter(s => s.sentAt && s.messageId).map(async step => {
    const response = await fetchEvents(`https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodeURIComponent(step.messageId)}&limit=100&sort=desc`, { headers: { Accept: 'application/json', 'api-key': apiKey }, signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return;
    if (!response.ok) throw new Error(`Brevo tracking refresh failed (${response.status}). Try refreshing again shortly.`);
    const payload = await response.json();
    for (const event of Array.isArray(payload.events) ? payload.events.slice(0, 100) : []) {
      checkDeadline();
      const eventType = normalizeEvent(event.event);
      const raw = event.ts_event || event.ts_epoch || event.ts || event.date;
      const date = new Date(typeof raw === 'number' && raw < 1e12 ? raw * 1000 : raw);
      if (!eventType || Number.isNaN(date.getTime())) continue;
      // The provider query is scoped to this message; reject explicit mismatches in its response.
      const messageId = String(event.messageId || event['message-id'] || step.messageId);
      const email = String(event.email || sequence.toEmail);
      await trackSequenceEvent(db, { sequenceId: sequence.id, stepId: step.id, ownerUid: sequence.ownerUid, listId: sequence.listId, itemIds: [sequence.itemId], email, messageId, event: eventType, eventAt: date.toISOString(), eventId: event.id, link: event.link, authenticated: true });
    }
  }));
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failure) throw failure.reason;
}
