import type { firestore } from 'firebase-admin';
import { DashboardAccessError, validTeamId } from '../coach-dashboard/access';
import { digest, eligible, loadInbox, rootFor, scope, transactionReads, transportReady } from './service';
import { assembleTimeline, retryableTextStates, timestampMs, type MessageChannel } from './timeline';

const teams = (db: firestore.Firestore, teamId: string) => rootFor(db).collection('teams').doc(teamId);
const threadRef = (db: firestore.Firestore, teamId: string, uid: string, athleteId: string) => teams(db, teamId).collection('inbox-threads').doc(digest([uid, athleteId]));
const requestRef = (db: firestore.Firestore, teamId: string, uid: string, id: string) => teams(db, teamId).collection('inbox-requests').doc(digest([uid, id]));
const messageIdFor = (uid: string, teamId: string, requestId: string, athleteId: string) => digest(['inbox', uid, teamId, requestId, athleteId]);
const canonicalConversationId = (org: string, team: string, coach: string, athlete: string) => `pcv2_${[org, team, coach, athlete].join('~')}`;

export function validateUnifiedSend(body: any) {
  if (!body || !validTeamId(body.requestId) || typeof body.text !== 'string' || !body.text.trim() || body.text.trim().length > 1200 ||
    !Array.isArray(body.athleteIds) || !body.athleteIds.length || body.athleteIds.length > 25 || !body.athleteIds.every(validTeamId) || new Set(body.athleteIds).size !== body.athleteIds.length ||
    !Array.isArray(body.channels) || !body.channels.length || body.channels.length > 2 || new Set(body.channels).size !== body.channels.length || body.channels.some((channel: unknown) => channel !== 'app' && channel !== 'sms')) {
    throw new DashboardAccessError(400, 'Choose 1–25 athletes, at least one channel, and a message up to 1,200 characters.');
  }
  return { requestId: body.requestId as string, text: body.text.trim() as string, athleteIds: [...body.athleteIds].sort() as string[], channels: [...body.channels].sort() as MessageChannel[] };
}

function validConversation(data: any, uid: string, teamId: string, orgId: string, athleteId?: string) {
  return data?.coachId === uid && data.teamId === teamId && data.organizationId === orgId && validTeamId(data.athleteId) && (!athleteId || data.athleteId === athleteId) &&
    Array.isArray(data.participantIds) && data.participantIds.length === 2 && [...data.participantIds].sort().join('|') === [uid, data.athleteId].sort().join('|');
}
async function conversations(db: firestore.Firestore, uid: string, teamId: string, orgId: string) {
  const rows = await db.collection('coach-athlete-conversations').where('coachId', '==', uid).where('teamId', '==', teamId).where('organizationId', '==', orgId).get();
  return rows.docs.filter(row => validConversation(row.data(), uid, teamId, orgId)).map(row => ({ id: row.id, ...row.data() } as any));
}
async function textAvailability(db: firestore.Firestore, uid: string, teamId: string, athleteId: string, mode: unknown) {
  const entry = await eligible(db, uid, teamId, athleteId);
  const phone = entry.contact.phone;
  const reason = !entry.eligible ? (!phone || !/^\+[1-9]\d{9,14}$/.test(phone) ? 'A valid phone number is needed.' : 'This athlete has paused texts or opted out.') : !transportReady(mode) ? 'Texting setup is pending. App messages are available.' : null;
  return { ...entry, reason };
}

/** App and optional SMS work are committed together; this function never contacts a provider. */
export async function sendUnifiedMessage(db: firestore.Firestore, uid: string, teamId: string, body: unknown, mode: unknown, now = Date.now()) {
  const payload = validateUnifiedSend(body);
  const access = await scope(db, uid, teamId);
  for (const id of payload.athleteIds) await eligible(db, uid, teamId, id);
  const existingConversations = payload.channels.includes('app') ? await conversations(db, uid, teamId, access.team.organizationId) : [];
  const fingerprint = digest({ text: payload.text, athleteIds: payload.athleteIds, channels: payload.channels });
  const root = rootFor(db), team = teams(db, teamId), request = requestRef(db, teamId, uid, payload.requestId);
  return db.runTransaction(async tx => {
    const readDb = transactionReads(db, tx), fresh = await scope(readDb, uid, teamId);
    const prior = (await tx.get(request)).data();
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new DashboardAccessError(409, 'This request belongs to a different message.');
      return { requestId: prior.canonicalRequestId, duplicate: true };
    }
    const intent = team.collection('inbox-intents').doc(digest([uid, fingerprint]));
    const recent = (await tx.get(intent)).data();
    let unresolved = false;
    if (recent && now - recent.atMs >= 600000) {
      for (const athleteId of payload.athleteIds) {
        const message = (await tx.get(threadRef(db, teamId, uid, athleteId).collection('messages').doc(messageIdFor(uid, teamId, recent.requestId, athleteId)))).data();
        const job = message?.sms?.jobId ? (await tx.get(root.collection('jobs').doc(message.sms.jobId))).data() : null;
        if (['queued', 'sending', 'unknown'].includes(job?.state)) unresolved = true;
      }
    }
    // Reopening/reloading after an uncertain response must not duplicate App delivery.
    if (recent && (now - recent.atMs < 600000 || unresolved)) {
      tx.create(request, { uid, fingerprint, canonicalRequestId: recent.requestId, atMs: now });
      return { requestId: recent.requestId as string, duplicate: true };
    }
    const limit = root.collection('send-limits').doc(digest([uid, Math.floor(now / 60000)]));
    const usage = (await tx.get(limit)).data()?.count || 0;
    if (usage >= 5) throw new DashboardAccessError(429, 'Wait a minute before sending another message.');
    const plans: any[] = [], phones = new Set<string>();
    const coachProfile = (await readDb.collection('users').doc(uid).get()).data() || {};
    for (const athleteId of payload.athleteIds) {
      const availability = await textAvailability(readDb, uid, teamId, athleteId, mode);
      const id = messageIdFor(uid, teamId, payload.requestId, athleteId), thread = threadRef(db, teamId, uid, athleteId);
      const previousThread = (await tx.get(thread)).data();
      const appId = `inbox_${id}`;
      const existing = existingConversations.filter(row => row.athleteId === athleteId).sort((a, b) => a.id.localeCompare(b.id))[0];
      const conversation = db.collection('coach-athlete-conversations').doc(existing?.id || canonicalConversationId(fresh.team.organizationId, teamId, uid, athleteId));
      const appData = payload.channels.includes('app') ? (await tx.get(conversation)).data() : null;
      if (appData && !validConversation(appData, uid, teamId, fresh.team.organizationId, athleteId)) throw new DashboardAccessError(409, 'The App conversation changed. Refresh before sending.');
      const smsAvailable = payload.channels.includes('sms') && !availability.reason;
      const sender = process.env.TWILIO_FROM_NUMBER || '';
      if (smsAvailable) {
        if (phones.has(availability.contact.phone)) throw new DashboardAccessError(409, 'Athletes share a phone number. Review their identities before texting.');
        phones.add(availability.contact.phone);
        const route = (await tx.get(root.collection('routes').doc(digest([sender, availability.contact.phone])))).data();
        if (route && (route.teamId !== teamId || route.athleteId !== athleteId)) throw new DashboardAccessError(409, 'This phone belongs to another team conversation.');
      }
      plans.push({ id, athleteId, thread, previousThread, conversation, appData, appId, availability, smsAvailable, sender });
    }
    // All transaction reads finish before any writes.
    tx.create(request, { uid, fingerprint, canonicalRequestId: payload.requestId, atMs: now });
    tx.set(intent, { requestId: payload.requestId, atMs: now });
    tx.set(limit, { count: usage + 1, atMs: now });
    for (const plan of plans) {
      const { id, athleteId, thread, conversation, appData, appId, availability } = plan;
      const app = payload.channels.includes('app') ? { status: 'saved', conversationId: conversation.id, messageId: appId } : null;
      const sms = payload.channels.includes('sms') ? { status: plan.smsAvailable ? 'queued' : 'blocked', attempt: 1, jobId: plan.smsAvailable ? digest([id, 1]) : null, reason: availability.reason } : null;
      tx.set(thread, { coachId: uid, athleteId, teamId, lastMessage: payload.text, lastAtMs: now, readAtMs: plan.previousThread?.readAtMs || 0 }, { merge: true });
      tx.create(thread.collection('messages').doc(id), { id, uid, athleteId, teamId, requestId: payload.requestId, text: payload.text, atMs: now, app, sms });
      if (app) {
        if (!appData) tx.create(conversation, { coachId: uid, athleteId, teamId, organizationId: fresh.team.organizationId, participantIds: [uid, athleteId], coachName: String(coachProfile.displayName || 'Coach'), athleteName: String(availability.contact.displayName || 'Athlete'), createdAt: new Date(now), unreadCount: { [uid]: 0, [athleteId]: 1 }, lastMessage: payload.text, lastMessageId: appId, lastMessageTimestamp: new Date(now), lastMessageSenderId: uid, updatedAt: new Date(now) });
        else tx.set(conversation, { lastMessage: payload.text, lastMessageId: appId, lastMessageTimestamp: new Date(now), lastMessageSenderId: uid, updatedAt: new Date(now), unreadCount: { ...(appData.unreadCount || {}), [athleteId]: (Number(appData.unreadCount?.[athleteId]) || 0) + 1 } }, { merge: true });
        tx.create(db.collection('coach-athlete-messages').doc(appId), { conversationId: conversation.id, senderId: uid, senderType: 'coach', content: payload.text, timestamp: new Date(now), readBy: { [uid]: new Date(now) }, messageType: 'text', unifiedMessageId: id });
      }
      if (sms?.jobId) createTextJob(db, tx, { uid, teamId, athleteId, id, jobId: sms.jobId, text: payload.text, phone: availability.contact.phone, sender: plan.sender, atMs: now });
    }
    return { requestId: payload.requestId, duplicate: false };
  });
}

function createTextJob(db: firestore.Firestore, tx: firestore.Transaction, value: { uid: string; teamId: string; athleteId: string; id: string; jobId: string; text: string; phone: string; sender: string; atMs: number }) {
  const { uid, teamId, athleteId, id, jobId, text, phone, sender, atMs } = value;
  const batchId = `inbox_${jobId}`, body = `${text}\nReply STOP to opt out.`;
  tx.create(teams(db, teamId).collection('batches').doc(batchId), { uid, athleteIds: [athleteId], states: { [jobId]: 'queued' }, atMs });
  tx.create(rootFor(db).collection('jobs').doc(jobId), { uid, teamId, athleteId, batchId, text: body, phoneHash: digest(phone), sender, state: 'queued', atMs, unifiedMessageId: id });
  tx.create(teams(db, teamId).collection('messages').doc(jobId), { senderId: uid, athleteId, batchId, text: body, direction: 'outgoing', status: 'queued', atMs, unifiedMessageId: id });
}

export async function retryUnifiedText(db: firestore.Firestore, uid: string, teamId: string, athleteId: string, messageId: string, mode: unknown, now = Date.now()) {
  if (!validTeamId(athleteId) || !validTeamId(messageId)) throw new DashboardAccessError(400, 'Choose a message to retry.');
  return db.runTransaction(async tx => {
    const readDb = transactionReads(db, tx);
    const availability = await textAvailability(readDb, uid, teamId, athleteId, mode);
    const ref = threadRef(db, teamId, uid, athleteId).collection('messages').doc(messageId), current = (await tx.get(ref)).data();
    if (!current || current.uid !== uid || current.teamId !== teamId || current.athleteId !== athleteId || !current.sms) throw new DashboardAccessError(404, 'This text is unavailable.');
    const job = current.sms.jobId ? (await tx.get(rootFor(db).collection('jobs').doc(current.sms.jobId))).data() : null;
    const status = job?.state || current.sms.status;
    if (!retryableTextStates.has(status)) throw new DashboardAccessError(409, 'This text is queued, sent, or uncertain. Refresh to check its status.');
    if (availability.reason) throw new DashboardAccessError(409, availability.reason);
    const sender = process.env.TWILIO_FROM_NUMBER || '';
    const route = (await tx.get(rootFor(db).collection('routes').doc(digest([sender, availability.contact.phone])))).data();
    if (route && (route.teamId !== teamId || route.athleteId !== athleteId)) throw new DashboardAccessError(409, 'This phone belongs to another team conversation.');
    const limit = rootFor(db).collection('send-limits').doc(digest([uid, Math.floor(now / 60000)]));
    const usage = (await tx.get(limit)).data()?.count || 0;
    if (usage >= 5) throw new DashboardAccessError(429, 'Wait a minute before retrying this text.');
    const attempt = (Number(current.sms.attempt) || 1) + 1, jobId = digest([messageId, attempt]);
    tx.set(limit, { count: usage + 1, atMs: now });
    tx.set(ref, { sms: { status: 'queued', attempt, jobId, reason: null } }, { merge: true });
    createTextJob(db, tx, { uid, teamId, athleteId, id: messageId, jobId, text: current.text, phone: availability.contact.phone, sender, atMs: now });
    return { queued: true };
  });
}

export async function loadUnifiedInbox(db: firestore.Firestore, uid: string, teamId: string, mode: unknown, athleteId?: string, smsCursor?: string) {
  const access = await scope(db, uid, teamId), oldInbox = await loadInbox(db, uid, teamId, mode, smsCursor);
  const rows = await conversations(db, uid, teamId, access.team.organizationId);
  const recipients = [];
  for (const person of oldInbox.recipients) {
    const availability = await textAvailability(db, uid, teamId, person.id, mode);
    const thread = (await threadRef(db, teamId, uid, person.id).get()).data() || {};
    const app = rows.filter(row => row.athleteId === person.id).sort((a, b) => timestampMs(b.lastMessageTimestamp) - timestampMs(a.lastMessageTimestamp));
    const texts = oldInbox.messages.filter(row => row.athleteId === person.id);
    const latestText = texts.at(-1);
    const latest = [{ text: thread.lastMessage, at: thread.lastAtMs || 0 }, { text: app[0]?.lastMessage, at: timestampMs(app[0]?.lastMessageTimestamp) }, { text: latestText?.text, at: latestText?.atMs || 0 }].sort((a, b) => b.at - a.at)[0];
    recipients.push({ id: person.id, name: person.name, unread: app.some(row => Number(row.unreadCount?.[uid]) > 0) || texts.some(row => row.direction === 'incoming' && row.atMs > (thread.readAtMs || 0)), lastMessage: latest.text || '', lastAtMs: latest.at, textAvailable: !availability.reason, textReason: availability.reason });
  }
  recipients.sort((a, b) => b.lastAtMs - a.lastAtMs || a.name.localeCompare(b.name));
  if (!athleteId) return { recipients, messages: [], hasOlder: false, smsNextCursor: oldInbox.nextCursor };
  if (!recipients.some(row => row.id === athleteId)) throw new DashboardAccessError(403, 'This athlete is outside your active roster.');
  const app = [];
  let hasOlder = false;
  for (const conversation of rows.filter(row => row.athleteId === athleteId)) {
    const messages = await db.collection('coach-athlete-messages').where('conversationId', '==', conversation.id).orderBy('timestamp', 'desc').limit(200).get();
    hasOlder ||= messages.docs.length === 200;
    app.push(...messages.docs.map(row => ({ id: row.id, ...row.data(), athleteId })));
  }
  const logicalRows = await threadRef(db, teamId, uid, athleteId).collection('messages').orderBy('atMs', 'desc').limit(200).get();
  const logical = logicalRows.docs.map(row => ({ id: row.id, ...row.data() }));
  const sms: any[] = oldInbox.messages.filter(row => row.athleteId === athleteId);
  // Current linked delivery evidence can be older than the team's SMS history page.
  for (const row of logical as any[]) if (row.sms?.jobId && !sms.some(message => message.id === row.sms.jobId)) {
    const message = await teams(db, teamId).collection('messages').doc(row.sms.jobId).get();
    if (message.exists && message.data()?.athleteId === athleteId) sms.push({ id: message.id, ...message.data() });
  }
  return { recipients, messages: assembleTimeline(logical, app, sms, uid), hasOlder: hasOlder || logical.length === 200, smsNextCursor: oldInbox.nextCursor };
}

export async function markUnifiedRead(db: firestore.Firestore, uid: string, teamId: string, athleteId: string, now = Date.now()) {
  const access = await scope(db, uid, teamId); await eligible(db, uid, teamId, athleteId);
  const rows = (await conversations(db, uid, teamId, access.team.organizationId)).filter(row => row.athleteId === athleteId);
  const unreadMessages: firestore.QueryDocumentSnapshot[] = [];
  for (const row of rows) {
    const messages = await db.collection('coach-athlete-messages').where('conversationId', '==', row.id).orderBy('timestamp', 'desc').limit(200).get();
    unreadMessages.push(...messages.docs.filter(message => message.data().senderId === athleteId && !message.data().readBy?.[uid]));
  }
  await db.runTransaction(async tx => {
    await eligible(transactionReads(db, tx), uid, teamId, athleteId);
    const snapshots = await Promise.all(rows.map(row => tx.get(db.collection('coach-athlete-conversations').doc(row.id))));
    const messages = await Promise.all(unreadMessages.map(row => tx.get(row.ref)));
    const validIds = new Set(snapshots.filter(row => validConversation(row.data(), uid, teamId, access.team.organizationId, athleteId)).map(row => row.id));
    for (const message of messages) if (message.exists && validIds.has(message.data()?.conversationId) && message.data()?.senderId === athleteId) tx.set(message.ref, { readBy: { ...(message.data()?.readBy || {}), [uid]: new Date(now) } }, { merge: true });
    for (const row of snapshots) if (validConversation(row.data(), uid, teamId, access.team.organizationId, athleteId)) tx.set(row.ref, { unreadCount: { ...(row.data()?.unreadCount || {}), [uid]: 0 } }, { merge: true });
    tx.set(threadRef(db, teamId, uid, athleteId), { coachId: uid, teamId, athleteId, readAtMs: now }, { merge: true });
  });
  return { read: true };
}
