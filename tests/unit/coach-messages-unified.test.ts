import test from 'node:test';
import assert from 'node:assert/strict';
import { sendUnifiedMessage, retryUnifiedText, loadUnifiedInbox, markUnifiedRead, validateUnifiedSend } from '../../src/lib/coach-communications/unified';
import { assembleTimeline, timestampMs } from '../../src/lib/coach-communications/timeline';
import { processJob } from '../../src/lib/coach-communications/queue';
import { COLLECTION, ROOT, tokenDigest } from '../../src/lib/coachSurveys/service';
class MemoryDB {
  data = new Map<string, any>(); queue = Promise.resolve();
  doc(path: string): any { return { path, id: path.split('/').at(-1), collection: (name: string) => this.collection(`${path}/${name}`), get: async () => this.snapshot(path) }; }
  snapshot(path: string): any { return { id: path.split('/').at(-1), ref: this.doc(path), exists: this.data.has(path), data: () => structuredClone(this.data.get(path)) }; }
  collection(path: string): any {
    const db = this;
    const build = (filters: any[] = [], order?: string, maximum = Infinity, cursor?: any): any => ({
      doc: (id: string) => db.doc(`${path}/${id}`),
      where: (key: string, op: string, value: any) => { assert.equal(op, '=='); return build([...filters, [key, value]], order, maximum, cursor); },
      orderBy: (key: string) => build(filters, key, maximum, cursor), limit: (size: number) => build(filters, order, size, cursor), startAfter: (value: any) => build(filters, order, maximum, value),
      get: async () => {
        let rows = [...db.data.entries()].filter(([key, value]) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1 && filters.every(([field, expected]) => value[field] === expected)).sort((a, b) => order ? timestampMs(b[1][order]) - timestampMs(a[1][order]) : a[0].localeCompare(b[0]));
        if (cursor) rows = rows.slice(rows.findIndex(([key]) => key === cursor.ref.path) + 1);
        return { docs: rows.slice(0, maximum).map(([key]) => db.snapshot(key)) };
      },
    }); return build();
  }
  async runTransaction(action: any) {
    const result = this.queue.then(async () => {
      const writes: any[] = [];
      const value = await action({ get: async (ref: any) => { assert.equal(writes.length, 0, 'Firestore requires all reads before writes'); return this.snapshot(ref.path); }, create: (ref: any, data: any) => { assert.equal(this.data.has(ref.path), false); writes.push([ref.path, data]); }, set: (ref: any, data: any, options: any) => writes.push([ref.path, options?.merge ? { ...this.data.get(ref.path), ...data } : data]) });
      for (const [key, data] of writes) this.data.set(key, data); return value;
    }); this.queue = result.then(() => {}, () => {}); return result;
  }
}
const root = `${COLLECTION}/coach-communications-v1`;
const now = Date.parse('2026-11-06T12:00:00Z');
const payload = { requestId: 'request-1', text: 'Meet before practice.', athleteIds: ['a', 'b'], channels: ['app', 'sms'] };
const env = { COACH_COMMUNICATIONS_SMS_ENABLED: 'true', COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED: 'true', COACH_COMMUNICATIONS_FIREBASE_MODE: 'prod', COACH_COMMUNICATIONS_WORKER_ENABLED: 'true', COACH_COMMUNICATIONS_STATUS_WEBHOOK_URL: 'https://example.test/status', COACH_COMMUNICATIONS_SMS_WEBHOOK_URL: 'https://example.test/incoming', TWILIO_ACCOUNT_SID: 'synthetic', TWILIO_AUTH_TOKEN: 'synthetic', TWILIO_FROM_NUMBER: '+12025559999' };
Object.assign(process.env, env);
function fixture() {
  const db = new MemoryDB();
  db.data.set('pulsecheck-organizations/org', { status: 'active' });
  db.data.set('pulsecheck-teams/team', { status: 'active', organizationId: 'org' });
  for (const [index, id] of ['coach', 'a', 'b'].entries()) {
    db.data.set(`users/${id}`, { displayName: `Synthetic ${id}`, phoneNumber: `+1202555010${index}` });
    db.data.set(`pulsecheck-team-memberships/team_${id}`, { userId: id, teamId: 'team', organizationId: 'org', role: id === 'coach' ? 'coach' : 'athlete', status: 'active' });
  }
  return db;
}
const entries = (db: MemoryDB, prefix: string) => [...db.data.entries()].filter(([path]) => path.startsWith(prefix));
const appRows = (db: MemoryDB) => entries(db, 'coach-athlete-messages/');
const jobs = (db: MemoryDB) => entries(db, `${root}/jobs/`);
const logical = (db: MemoryDB) => [...db.data.entries()].filter(([path]) => /inbox-threads\/[^/]+\/messages\//.test(path));

test('one atomic private fan-out creates native-compatible App delivery and one linked SMS job per athlete', async () => {
  const db = fixture(); await sendUnifiedMessage(db as any, 'coach', 'team', payload, 'prod', now);
  assert.equal(appRows(db).length, 2); assert.equal(jobs(db).length, 2); assert.equal(logical(db).length, 2);
  for (const [path, message] of appRows(db)) { assert.equal(message.senderId, 'coach'); assert.equal(message.senderType, 'coach'); assert.equal(message.content, payload.text); assert.ok(message.readBy.coach instanceof Date); const conversation = db.data.get(`coach-athlete-conversations/${message.conversationId}`); assert.equal(conversation.participantIds.length, 2); assert.equal(conversation.unreadCount[conversation.athleteId], 1); assert.ok(path.endsWith(message.unifiedMessageId)); }
  assert.ok(jobs(db).every(([, job]) => job.state === 'queued' && job.text.endsWith('Reply STOP to opt out.')));
});
test('same request, concurrent requests and reload intents cannot duplicate either delivery channel', async () => {
  const db = fixture(); const results = await Promise.all([sendUnifiedMessage(db as any, 'coach', 'team', payload, 'prod', now), sendUnifiedMessage(db as any, 'coach', 'team', payload, 'prod', now), sendUnifiedMessage(db as any, 'coach', 'team', { ...payload, requestId: 'after-reload' }, 'prod', now)]);
  assert.equal(appRows(db).length, 2); assert.equal(jobs(db).length, 2); assert.equal(results.filter(result => result.duplicate).length, 2);
  await assert.rejects(sendUnifiedMessage(db as any, 'coach', 'team', { ...payload, text: 'Different message' }, 'prod', now), /different message/);
});
test('an unresolved provider outcome remains deduplicated after the ten-minute intent window', async () => {
  const db = fixture(); await sendUnifiedMessage(db as any, 'coach', 'team', payload, 'prod', now);
  const [path, job] = jobs(db)[0]; db.data.set(path, { ...job, state: 'unknown' });
  await sendUnifiedMessage(db as any, 'coach', 'team', { ...payload, requestId: 'after-window' }, 'prod', now + 700000);
  assert.equal(appRows(db).length, 2); assert.equal(jobs(db).length, 2);
});
test('provider pending, opt-out and missing phone keep App usable without recording consent', async () => {
  for (const state of ['pending', 'stop', 'missing-phone']) {
    const db = fixture(); if (state === 'stop') db.data.set(`${COLLECTION}/${ROOT}/sms-suppressions/${tokenDigest('+12025550101')}`, { suppressed: true });
    if (state === 'missing-phone') delete db.data.get('users/a').phoneNumber;
    await sendUnifiedMessage(db as any, 'coach', 'team', { ...payload, athleteIds: ['a'] }, state === 'pending' ? 'dev' : 'prod', now);
    assert.equal(appRows(db).length, 1); assert.equal(jobs(db).length, 0); assert.equal(logical(db)[0][1].sms.status, 'blocked');
    assert.equal(entries(db, `${root}/contacts/`).length, 0); assert.equal(entries(db, `${root}/consent-events/`).length, 0);
  }
});
test('App-only and Text-only requests perform exactly the selected delivery', async () => {
  for (const channel of ['app', 'sms']) { const db = fixture(); await sendUnifiedMessage(db as any, 'coach', 'team', { ...payload, channels: [channel], athleteIds: ['a'] }, 'prod', now); assert.equal(appRows(db).length, channel === 'app' ? 1 : 0); assert.equal(jobs(db).length, channel === 'sms' ? 1 : 0); }
});
test('only a confirmed failed Text channel can retry; App delivery is never repeated', async () => {
  const db = fixture(); await sendUnifiedMessage(db as any, 'coach', 'team', { ...payload, athleteIds: ['a'] }, 'prod', now);
  const [jobPath, job] = jobs(db)[0], messageId = logical(db)[0][1].id;
  for (const state of ['queued', 'sending', 'unknown', 'accepted', 'sent', 'delivered']) { db.data.set(jobPath, { ...job, state }); await assert.rejects(retryUnifiedText(db as any, 'coach', 'team', 'a', messageId, 'prod', now + 1), /queued, sent, or uncertain/); }
  db.data.set(jobPath, { ...job, state: 'failed' });
  const results = await Promise.allSettled([retryUnifiedText(db as any, 'coach', 'team', 'a', messageId, 'prod', now + 1), retryUnifiedText(db as any, 'coach', 'team', 'a', messageId, 'prod', now + 1)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(appRows(db).length, 1); assert.equal(jobs(db).length, 2); assert.equal(logical(db).length, 1);
});
test('STOP and changed authority are rechecked on retries and by the existing queue worker', async () => {
  const db = fixture(); await sendUnifiedMessage(db as any, 'coach', 'team', { ...payload, athleteIds: ['a'] }, 'prod', now);
  const [jobPath, job] = jobs(db)[0]; let calls = 0;
  db.data.set(`${COLLECTION}/${ROOT}/sms-suppressions/${tokenDigest('+12025550101')}`, { suppressed: true });
  await processJob(db as any, jobPath.split('/').at(-1)!, async () => { calls++; return { state: 'accepted' }; }, now + 1);
  assert.equal(calls, 0); assert.equal(db.data.get(jobPath).state, 'blocked');
  await assert.rejects(retryUnifiedText(db as any, 'coach', 'team', 'a', logical(db)[0][1].id, 'prod', now + 2), /opted out/);
  db.data.get('pulsecheck-team-memberships/team_coach').status = 'removed';
  await assert.rejects(sendUnifiedMessage(db as any, 'coach', 'team', { ...payload, requestId: 'new' }, 'prod', now + 3));
});
test('restricted roster, closed account, shared phone and invalid channel requests fail before any delivery', async () => {
  for (const state of ['roster', 'closed', 'shared']) {
    const db = fixture();
    if (state === 'roster') Object.assign(db.data.get('pulsecheck-team-memberships/team_coach'), { rosterVisibilityScope: 'assigned', allowedAthleteIds: ['a'] });
    if (state === 'closed') db.data.set('account-closure-jobs/a', { status: 'closing' });
    if (state === 'shared') db.data.get('users/b').phoneNumber = '+12025550101';
    await assert.rejects(sendUnifiedMessage(db as any, 'coach', 'team', payload, 'prod', now)); assert.equal(appRows(db).length + jobs(db).length, 0);
  }
  for (const channels of [[], ['email'], ['app', 'app']]) assert.throws(() => validateUnifiedSend({ ...payload, channels }));
});
test('the inbox merges explicitly linked channels once and keeps incoming channels chronological', async () => {
  const db = fixture(); await sendUnifiedMessage(db as any, 'coach', 'team', { ...payload, athleteIds: ['a'] }, 'prod', now);
  const conversationId = appRows(db)[0][1].conversationId;
  db.data.set('coach-athlete-messages/reply', { conversationId, senderId: 'a', content: 'App reply', timestamp: new Date(now + 1), readBy: { a: new Date(now + 1) } });
  db.data.set(`${root}/teams/team/messages/sms-reply`, { athleteId: 'a', text: 'Text reply', direction: 'incoming', status: 'received', atMs: now + 2 });
  const inbox = await loadUnifiedInbox(db as any, 'coach', 'team', 'prod', 'a');
  assert.equal(inbox.messages.length, 3); assert.deepEqual(Object.keys(inbox.messages[0].channels).sort(), ['app', 'sms']); assert.deepEqual(inbox.messages.slice(1).map(row => row.text), ['App reply', 'Text reply']);
  assert.equal(inbox.recipients.find(row => row.id === 'a')?.unread, true);
  await markUnifiedRead(db as any, 'coach', 'team', 'a', now + 3);
  assert.ok(db.data.get('coach-athlete-messages/reply').readBy.coach instanceof Date);
  assert.equal((await loadUnifiedInbox(db as any, 'coach', 'team', 'prod', 'a')).recipients.find(row => row.id === 'a')?.unread, false);
});
test('identical legacy App and Text content never gets guessed to be one logical message', () => {
  const timeline = assembleTimeline([], [{ id: 'a', athleteId: 'athlete', senderId: 'coach', content: 'Same', timestamp: 1 }], [{ id: 'b', athleteId: 'athlete', direction: 'outgoing', text: 'Same', atMs: 1, status: 'sent' }], 'coach');
  assert.equal(timeline.length, 2);
});


test('the same request ID on two active teams has distinct global App and job identities', async () => {
  const db = fixture();
  db.data.set('pulsecheck-organizations/other-org', { status: 'active' });
  db.data.set('pulsecheck-teams/other-team', { status: 'active', organizationId: 'other-org' });
  for (const id of ['coach', 'a']) db.data.set(`pulsecheck-team-memberships/other-team_${id}`, { userId: id, teamId: 'other-team', organizationId: 'other-org', role: id === 'coach' ? 'coach' : 'athlete', status: 'active' });
  const input = { ...payload, athleteIds: ['a'] };
  await sendUnifiedMessage(db as any, 'coach', 'team', input, 'prod', now);
  await sendUnifiedMessage(db as any, 'coach', 'other-team', input, 'prod', now);
  assert.equal(appRows(db).length, 2); assert.equal(jobs(db).length, 2);
  assert.equal(new Set(appRows(db).map(([path]) => path)).size, 2);
  assert.equal(new Set(logical(db).map(([, row]) => row.id)).size, 2);
});
