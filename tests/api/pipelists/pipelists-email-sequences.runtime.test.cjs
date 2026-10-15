const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
function load(file, mocks = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name), console, Date, Intl, process: { env: { NODE_ENV: 'production', CONTEXT: 'production', SITE_ID: 'synthetic-site-id', SITE_NAME: 'synthetic-site', URL: 'https://fitwithpulse.ai', BREVO_WEBHOOK_SECRET: 'test-secret', BREVO_API_KEY: 'mock-provider-key' } }, AbortSignal, ...globals });
  return module.exports;
}
const sequenceUtils = load('src/utils/pipelistsEmailSequence.ts');
const runtime = load('src/utils/pipelistsRuntime.ts', { '../generated/pipelists-deployment.json': { production: true, siteId: 'synthetic-site-id', siteName: 'synthetic-site', url: 'https://fitwithpulse.ai' } });
const transportPolicy = load('src/utils/pipelistsTransportPolicy.ts');
const lib = load('netlify/functions/lib/pipelistsEmailSequences.ts', { '../../../src/utils/pipelistsRuntime': runtime, '../../../src/utils/pipelistsTransportPolicy': transportPolicy, '../../../src/utils/pipelistsEmailSequence': sequenceUtils, '../utils/emailSequenceHelpers': { sendBrevoTransactionalEmail: () => { throw Error('Never send a real email in tests'); } } });
function database() {
  const records = new Map();
  const ref = path => ({ id: path.split('/').pop(), path, collection: id => collection(`${path}/${id}`), get: async () => snapshot(path), set: async data => records.set(path, { ...records.get(path), ...data }), update: async data => records.set(path, { ...records.get(path), ...data }) });
  const snapshot = path => ({ exists: records.has(path), data: () => records.get(path), ref: ref(path) });
  const emptyQuery = { where: () => emptyQuery, limit: () => emptyQuery, get: async () => ({ docs: [], empty: true }) };
  const collection = path => ({ ...emptyQuery, doc: id => ref(`${path}/${id}`) });
  let queue = Promise.resolve();
  return { records, collection, runTransaction(fn) {
    const result = queue.then(async () => {
      const writes = [];
      const value = await fn({ get: async r => snapshot(r.path), set: (r, data) => writes.push(() => records.set(r.path, structuredClone(data))), update: (r, data) => writes.push(() => records.set(r.path, { ...records.get(r.path), ...structuredClone(data) })) });
      writes.forEach(write => write()); return value;
    }); queue = result.catch(() => {}); return result;
  } };
}
function setup() {
  const db = database();
  const list = { id: 'school-list', templateKey: 'contacts', items: [{ id: 'school', title: 'Test school', weeklyLogs: [] }] };
  db.records.set('simpbudget-users/owner/pipeLists/state', { lists: [structuredClone(list)] });
  db.records.set('pipeListProtectedShares/owner-school-list', { ownerUid: 'owner', listId: 'school-list', list });
  return db;
}
function draft() { return { audience: 'coaches', fromEmail: 'tre@fitwithpulse.ai', toEmail: 'test@example.com', steps: [0,4,7].map((delayDays,i) => ({ id: `email-${i+1}`, delayDays, subject: `Email ${i+1}`, body: 'Hello Coach', sentAt: '', messageId: '' })) }; }
const input = (action, version, sequence) => ({ action, expectedVersion: version, listId: 'school-list', itemId: 'school', ...(sequence ? { sequence } : {}) });
test('explicit first send advances once and records the next date in both stores', async () => {
  const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  let calls = 0;
  const send = async () => { calls++; return { success: true, messageId: 'message-1' }; };
  await Promise.all([lib.dispatchSequence(db, seq.id, new Date(), send), lib.dispatchSequence(db, seq.id, new Date(), send)]);
  assert.equal(calls, 1);
  const current = db.records.get(`${lib.COLLECTION}/${seq.id}`);
  assert.equal(current.nextStepIndex, 1); assert.equal(current.status, 'active');
  assert.equal(current.nextSendAt, lib.addEasternDays(current.steps[0].sentAt, 4));
  for (const lead of [db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].items[0], db.records.get('pipeListProtectedShares/owner-school-list').list.items[0]]) {
    assert.equal(lead.dueDate, lib.easternDate(new Date(current.nextSendAt))); assert.equal(lead.weeklyLogs.length, 1);
  }
});
test('suppression and ambiguous failure stop future delivery without blind retries', async () => {
  for (const send of [async () => ({ success: true, skipped: true, suppressed: true }), async () => { throw Error('timeout'); }]) {
    const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
    const result = await lib.dispatchSequence(db, seq.id, new Date(), send);
    assert.equal(result.status, 'error'); assert.equal(result.nextStepIndex, 0);
    assert.equal(await lib.dispatchSequence(db, seq.id, new Date(), () => { throw Error('must not retry'); }), null);
    await assert.rejects(lib.mutateSequence(db, 'owner', input('resume', result.version)), /Only a paused/);
  }
});
test('pause blocks delivery and resume schedules a future send', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  seq = await lib.mutateSequence(db, 'owner', input('pause', seq.version));
  assert.equal(await lib.dispatchSequence(db, seq.id, new Date(), () => { throw Error('paused'); }), null);
  const now = new Date(); seq = await lib.mutateSequence(db, 'owner', input('resume', seq.version), now);
  assert.ok(seq.nextSendAt > now.toISOString());
});
test('draft/version/ownership checks prevent accidental activation and lost edits', async () => {
  const db = setup(); const bad = draft(); bad.steps[2].body = 'Here is [Insert Links]';
  await assert.rejects(lib.mutateSequence(db, 'owner', input('send', 0, bad)), /placeholders/);
  await lib.mutateSequence(db, 'owner', input('save', 0, bad));
  await assert.rejects(lib.mutateSequence(db, 'owner', input('save', 0, draft())), /changed/);
  await assert.rejects(lib.mutateSequence(db, 'other', input('send', 0, draft())), /could not be verified/);
});
test('deleted canonical lead never sends and sent steps cannot be rewritten', async () => {
  const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].deletedAt = 'today';
  await lib.dispatchSequence(db, seq.id, new Date(), () => { throw Error('must not send'); });
  assert.equal(db.records.get(`${lib.COLLECTION}/${seq.id}`).status, 'error');
  const existing = { ...draft() }; existing.steps[0].sentAt = '2026-09-30T12:00:00Z';
  const edited = draft(); edited.steps[0].body = 'Changed';
  assert.throws(() => lib.validateDraft(edited, existing), /Sent emails cannot/);
});
test('calendar days preserve Eastern time through daylight saving', () => {
  assert.equal(lib.addEasternDays('2026-10-30T14:00:00.000Z', 4), '2026-11-03T15:00:00.000Z');
});
test('API requires verified owner identity and rejects other methods', async () => {
  const api = load('src/pages/api/pipelists/email-sequence.ts', {
    '../../../utils/pipelistsRuntime': runtime,
    '../../../../netlify/functions/utils/getSimpBudgetServiceAccount': { getSimpBudgetAuth: async () => ({ verifyIdToken: async token => ({ uid: 'other', email: token }) }), getSimpBudgetFirestore: async () => { throw Error('not authorized'); } },
    '../../../../netlify/functions/lib/pipelistsEmailSequences': lib,
  }).default;
  for (const [method, token, expected] of [['POST', null, 401], ['POST', 'other@example.com', 403], ['DELETE', null, 405]]) {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await api({ method, headers: token ? { host: 'fitwithpulse.ai', authorization: `Bearer ${token}` } : { host: 'fitwithpulse.ai' } }, res); assert.equal(res.code, expected);
  }
});
test('editing interval, pausing, and resuming keep the lead due date synchronized', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: true, messageId: 'first' }));
  const edit = structuredClone(seq); edit.steps[1].delayDays = 9;
  seq = await lib.mutateSequence(db, 'owner', input('save', seq.version, edit));
  assert.equal(seq.nextSendAt, lib.addEasternDays(seq.steps[0].sentAt, 9));
  const due = () => db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].dueDate;
  assert.equal(due(), lib.easternDate(new Date(seq.nextSendAt)));
  seq = await lib.mutateSequence(db, 'owner', input('pause', seq.version)); assert.equal(due(), '');
  seq = await lib.mutateSequence(db, 'owner', input('resume', seq.version)); assert.equal(due(), lib.easternDate(new Date(seq.nextSendAt)));
});
test('a timed-out durable claim stops instead of retrying the provider', async () => {
  const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  db.records.get(`${lib.COLLECTION}/${seq.id}`).attempt = { index: 0, startedAt: '2000-01-01T00:00:00Z' };
  await lib.dispatchSequence(db, seq.id, new Date(), () => { throw Error('must not retry'); });
  assert.equal(db.records.get(`${lib.COLLECTION}/${seq.id}`).status, 'error');
});
test('personally removed lead and tampered stored sender cannot dispatch', async () => {
  for (const kind of ['removed', 'sender']) {
    const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
    if (kind === 'removed') db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].items = [];
    else db.records.get(`${lib.COLLECTION}/${seq.id}`).fromEmail = 'unapproved@example.com';
    await lib.dispatchSequence(db, seq.id, new Date(), () => { throw Error('must not send'); });
    assert.equal(db.records.get(`${lib.COLLECTION}/${seq.id}`).status, 'error');
  }
});
test('formatted email safely includes resource links and sender signature', () => {
  const html = lib.emailHtml('Hi Coach\nhttps://example.com/resource\n<script>alert(1)</script>', 'tre@fitwithpulse.ai');
  assert.match(html, /href="https:\/\/example.com\/resource"/);
  assert.match(html, /Tremaine Grant/); assert.match(html, /mailto:tre@fitwithpulse.ai/); assert.doesNotMatch(html, /<script>/);
});
test('GET and POST deny missing or non-owner tokens before any datastore access', async () => {
  let datastoreCalls = 0;
  const api = load('src/pages/api/pipelists/email-sequence.ts', {
    '../../../utils/pipelistsRuntime': runtime,
    '../../../../netlify/functions/utils/getSimpBudgetServiceAccount': { getSimpBudgetAuth: async () => ({ verifyIdToken: async () => ({ uid: 'someone', email: 'someone@example.com' }) }), getSimpBudgetFirestore: async () => { datastoreCalls++; throw Error('must not reach datastore'); } },
    '../../../../netlify/functions/lib/pipelistsEmailSequences': lib,
  }).default;
  for (const method of ['GET', 'POST']) for (const token of ['', 'not-owner']) {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json() {} };
    await api({ method, headers: token ? { host: 'fitwithpulse.ai', authorization: `Bearer ${token}` } : { host: 'fitwithpulse.ai' }, query: { listId: 'school-list', itemId: 'school' }, body: input('send', 0, draft()) }, res);
    assert.equal(res.code, token ? 403 : 401);
  }
  assert.equal(datastoreCalls, 0);
});
test('future steps remain unsent, then second and third progress to completion exactly once', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft())); let calls = 0;
  const send = async () => ({ success: true, messageId: `message-${++calls}` });
  seq = await lib.dispatchSequence(db, seq.id, new Date(), send);
  assert.equal(await lib.dispatchSequence(db, seq.id, new Date(), send), null); assert.equal(calls, 1);
  seq = await lib.dispatchSequence(db, seq.id, new Date(seq.nextSendAt), send); assert.equal(seq.nextStepIndex, 2);
  seq = await lib.dispatchSequence(db, seq.id, new Date(seq.nextSendAt), send); assert.equal(seq.status, 'completed'); assert.equal(seq.nextSendAt, ''); assert.equal(seq.nextStepIndex, 3);
  assert.equal(await lib.dispatchSequence(db, seq.id, new Date('2030-01-01'), send), null); assert.equal(calls, 3);
  assert.equal(db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].dueDate, '');
});
test('delivery failures clear only the sequence-owned due date and personal webhook issues stop dispatch', async () => {
  for (const customDate of ['', '2030-02-03']) {
    const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
    if (customDate) db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].dueDate = customDate;
    await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: false, error: 'provider failed' }));
    assert.equal(db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].dueDate, customDate);
  }
  const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].items[0].emailStatus = 'unsubscribed';
  await lib.dispatchSequence(db, seq.id, new Date(), () => { throw Error('must not send'); });
  assert.equal(db.records.get(`${lib.COLLECTION}/${seq.id}`).status, 'error');
});
test('school outreach activity stays in ordinary logs, including synced events', () => {
  const sync = load('src/utils/pipelistsEmailEventSync.ts');
  const log = sync.buildSyncedEmailEventLog({ item: { id: 'school', contactEmails: ['test@example.com'], lastEmailType: 'school-outreach' }, status: 'opened', messageId: 'sent', eventAt: new Date().toISOString() });
  assert.equal(log.type, 'update'); assert.match(log.summary, /School Outreach/);
  const webhook = fs.readFileSync(path.join(root, 'netlify/functions/brevo-email-webhook.ts'), 'utf8');
  assert.match(webhook, /type: \['general-update', 'school-outreach'\]\.includes\(args.emailType \|\| ''\) \? 'update' : 'metrics'/);
});
test('scheduler selects only due active records and bounds the delivery batch', async () => {
  const called = [];
  const records = [{ id: 'paused', status: 'paused', nextSendAt: '2000-01-01' }, { id: 'future', status: 'active', nextSendAt: '2099-01-01' }, ...[1,2,3,4].map(id => ({ id: `due-${id}`, status: 'active', nextSendAt: '2000-01-01' }))];
  const db = { collection: () => ({ where: (field, op, value) => ({ get: async () => ({ docs: records.filter(r => r[field] === value).map(r => ({ id: r.id, data: () => r })) }) }) }) };
  const scheduler = load('netlify/functions/pipelists-email-sequences.ts', { '../../src/utils/pipelistsRuntime': runtime, './utils/getSimpBudgetServiceAccount': { getSimpBudgetFirestore: async () => db }, './lib/pipelistsEmailSequences': { COLLECTION: lib.COLLECTION, dispatchSequence: async (_, id) => { called.push(id); return { id }; } } });
  await scheduler.handler({});
  assert.deepEqual(called.sort(), ['due-1', 'due-2', 'due-3']);
});
test('shortening an active interval into the past requires pause and resume', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: true, messageId: 'first' }));
  const edit = structuredClone(seq); edit.steps[1].delayDays = 1;
  await assert.rejects(lib.mutateSequence(db, 'owner', input('save', seq.version, edit), new Date(lib.addEasternDays(seq.steps[0].sentAt, 2))), /Pause the sequence/);
});
const tracking = load('netlify/functions/lib/pipelistsEmailSequenceTracking.ts');
function trackingEvent(seq, index, event, at, extras = {}) { return { sequenceId: seq.id, stepId: seq.steps[index].id, ownerUid: 'owner', listId: 'school-list', itemIds: ['school'], email: seq.toEmail, messageId: seq.steps[index].messageId || 'first', event, eventAt: at, authenticated: true, ...extras }; }
test('delivered/opened/clicked events sync protected + personal custom recipient and preserve due dates', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: true, messageId: 'first' }));
  const date = seq.nextSendAt; const at = new Date(Date.parse(seq.steps[0].sentAt) + 1000).toISOString();
  for (const event of ['delivered', 'opened', 'click']) await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, event, at, { link: event === 'click' ? 'https://example.com' : undefined }));
  await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'opened', at));
  const saved = db.records.get(`${lib.COLLECTION}/${seq.id}`);
  assert.equal(saved.steps[0].tracking.status, 'clicked'); assert.equal(saved.steps[0].tracking.openCount, 1); assert.equal(saved.steps[0].tracking.clickCount, 1); assert.equal(saved.version, seq.version);
  for (const item of [db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].items[0], db.records.get('pipeListProtectedShares/owner-school-list').list.items[0]]) { assert.equal(item.emailStatus, 'clicked'); assert.equal(item.emailOpenCount, 1); assert.equal(item.dueDate, lib.easternDate(new Date(date))); }
  const forged = structuredClone(saved); forged.steps[0].tracking.openCount = 100;
  const updated = await lib.mutateSequence(db, 'owner', input('save', saved.version, forged)); assert.equal(updated.steps[0].tracking.openCount, 1);
});
test('early webhook survives send finalization and old-step events never replace current lead status', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => {
    await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'opened', new Date().toISOString()));
    return { success: true, messageId: 'first' };
  });
  assert.equal(seq.steps[0].tracking.status, 'opened');
  const prior = seq;
  seq = await lib.dispatchSequence(db, seq.id, new Date(seq.nextSendAt), async () => ({ success: true, messageId: 'second' }));
  await tracking.trackSequenceEvent(db, trackingEvent(prior, 0, 'click', new Date().toISOString(), { link: 'https://example.com/old' }));
  const item = db.records.get('pipeListProtectedShares/owner-school-list').list.items[0];
  assert.equal(item.lastEmailMessageId, 'second'); assert.equal(item.emailStatus, 'sent'); assert.equal(item.emailOpenCount, 0);
  const saved = db.records.get(`${lib.COLLECTION}/${seq.id}`); assert.equal(saved.steps[0].tracking.status, 'clicked');
});
test('tracking rejects unauthenticated, wrong recipient/message/lead and preserves stronger out-of-order status', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: true, messageId: 'first' }));
  const at = new Date().toISOString();
  for (const extra of [{ authenticated: false }, { email: 'wrong@example.com' }, { messageId: 'wrong' }, { itemIds: ['wrong'] }]) assert.equal(await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'opened', at, extra)), false);
  await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'opened', at));
  await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'delivered', seq.steps[0].sentAt));
  assert.equal(db.records.get(`${lib.COLLECTION}/${seq.id}`).steps[0].tracking.status, 'opened');
});
test('actual Brevo webhook routes school outreach into exact-step tracking with replay protection', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: true, messageId: 'first' }));
  const firestore = () => db; firestore.FieldValue = { increment: value => value };
  const webhook = load('netlify/functions/brevo-email-webhook.ts', { '../../src/utils/pipelistsRuntime': runtime, './config/firebase': { admin: { firestore } }, './utils/getSimpBudgetServiceAccount': { getSimpBudgetFirestore: async () => db }, './utils/mixpanelAnalytics': { MACRA_MIXPANEL_EVENTS: {}, safeTrackMacraWebOfferEvent: async () => {} }, '../../src/lib/equityEmailDelivery': {}, './lib/pipelistsEmailSequenceTracking': tracking });
  const body = JSON.stringify({ event: 'opened', email: seq.toEmail, 'message-id': 'first', ts_event: Math.floor(Date.now()/1000), id: 1234, 'X-Mailin-custom': JSON.stringify({ pipeListsOwnerUid: 'owner', pipeListsListId: 'school-list', pipeListsItemIds: ['school'], pipeListsEmailType: 'school-outreach', pipeListsSequenceId: seq.id, pipeListsSequenceStepId: seq.steps[0].id }) });
  for (let i=0;i<2;i++) { const res = await webhook.handler({ httpMethod: 'POST', headers: { 'x-brevo-secret': 'test-secret' }, body }); assert.equal(res.statusCode, 200, res.body); }
  assert.equal(db.records.get(`${lib.COLLECTION}/${seq.id}`).steps[0].tracking.openCount, 1);
});
test('provider refresh merges with webhook dedupe and never changes the workflow', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: true, messageId: 'first' }));
  const at = new Date().toISOString(); await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'opened', at, { eventId: 55 }));
  await tracking.refreshSequenceTracking(db, seq, 'mock-key', async () => ({ ok: true, status: 200, json: async () => ({ events: [{ event: 'opened', date: at, messageId: 'first', email: seq.toEmail }, { event: 'clicks', date: at, messageId: 'first', email: seq.toEmail, link: 'https://example.com' }] }) }));
  const saved = db.records.get(`${lib.COLLECTION}/${seq.id}`); assert.equal(saved.steps[0].tracking.openCount, 1); assert.equal(saved.steps[0].tracking.clickCount, 1); assert.equal(saved.nextSendAt, seq.nextSendAt); assert.equal(saved.version, seq.version);
  await assert.rejects(tracking.refreshSequenceTracking(db, seq, 'mock-key', async () => ({ ok: false, status: 503 })), /refresh failed/);
});
test('tracking shows last open, parses event status, and protects newer unrelated mail', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: true, messageId: 'first' }));
  const early = new Date(Date.parse(seq.steps[0].sentAt) + 1000).toISOString(), later = new Date(Date.parse(early) + 1000).toISOString();
  await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'opened', early));
  await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'opened', later));
  const item = db.records.get('pipeListProtectedShares/owner-school-list').list.items[0];
  assert.equal(item.lastEmailOpenedAt, later); assert.match(item.weeklyLogs.at(-1).notes, /Status: Opened/);
  item.lastEmailMessageId = 'new-general-email'; item.lastEmailSentAt = new Date(Date.parse(later) + 5000).toISOString(); item.emailStatus = 'delivered';
  await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'click', later, { link: 'https://example.com/new' }));
  const savedItem = db.records.get('pipeListProtectedShares/owner-school-list').list.items[0];
  assert.equal(savedItem.lastEmailMessageId, 'new-general-email'); assert.equal(savedItem.emailStatus, 'delivered');
  assert.equal(db.records.get(`${lib.COLLECTION}/${seq.id}`).steps[0].tracking.status, 'clicked');
});
test('CC/BCC normalize with To priority, validate, and stay immutable after sending', () => {
  const input = { ...draft(), ccEmails: [' Copy@example.com ', 'TEST@example.com', 'copy@example.com'], bccEmails: ['hidden@example.com', 'COPY@example.com'] };
  const normalized = lib.validateDraft(input);
  assert.deepEqual([...normalized.ccEmails], ['copy@example.com']); assert.deepEqual([...normalized.bccEmails], ['hidden@example.com']);
  for (const bad of ['bad', 'a,b@example.com', 'a;b@example.com']) {
    assert.throws(() => lib.validateDraft({ ...draft(), ccEmails: [bad] }), /valid CC/);
    assert.throws(() => lib.validateDraft({ ...draft(), toEmail: bad }), /valid recipient/);
  }
  const legacy = draft(); legacy.steps[0].sentAt = new Date().toISOString();
  assert.deepEqual([...lib.validateDraft(legacy, legacy).ccEmails], []);
  assert.throws(() => lib.validateDraft(input, legacy), /cannot change/);
});
test('successful send copies the envelope and adds only To plus CC to both contact lists', async () => {
  const db = setup();
  db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].items[0].contactEmails = ['existing@example.com', 'COPY@example.com'];
  db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].contactEmails = ['protected@example.com'];
  let seq = await lib.mutateSequence(db, 'owner', input('send', 0, { ...draft(), ccEmails: ['Copy@example.com'], bccEmails: ['hidden@example.com'] }));
  let payload;
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async args => { payload = args; return { success: true, messageId: 'first' }; });
  assert.deepEqual(payload.cc.map(c => c.email), ['copy@example.com']); assert.deepEqual(payload.bcc.map(c => c.email), ['hidden@example.com']); assert.equal(payload.checkAllRecipientSuppression, true);
  for (const item of [db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].items[0], db.records.get('pipeListProtectedShares/owner-school-list').list.items[0]]) {
    assert.ok(item.contactEmails.includes('test@example.com')); assert.ok(item.contactEmails.includes('copy@example.com')); assert.ok(!item.contactEmails.includes('hidden@example.com'));
    assert.match(item.weeklyLogs[0].notes, /Cc: copy@example.com/); assert.doesNotMatch(JSON.stringify(item), /hidden@example.com/);
  }
});
test('failed or suppressed sends do not add To/CC contacts', async () => {
  for (const result of [{ success: false, error: 'provider down' }, { success: true, suppressed: true, skipped: true }]) {
    const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, { ...draft(), ccEmails: ['copy@example.com'], bccEmails: ['hidden@example.com'] }));
    await lib.dispatchSequence(db, seq.id, new Date(), async () => result);
    assert.equal(db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].contactEmails, undefined);
  }
});
test('CC/BCC and ambiguous provider events never count as primary-recipient tracking', async () => {
  const db = setup(); let seq = await lib.mutateSequence(db, 'owner', input('send', 0, { ...draft(), ccEmails: ['copy@example.com'], bccEmails: ['hidden@example.com'] }));
  seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: true, messageId: 'first' }));
  const at = new Date().toISOString();
  for (const email of ['copy@example.com', 'hidden@example.com']) assert.equal(await tracking.trackSequenceEvent(db, trackingEvent(seq, 0, 'opened', at, { email })), false);
  await tracking.refreshSequenceTracking(db, seq, 'mock-key', async () => ({ ok: true, status: 200, json: async () => ({ events: [{ event: 'opened', date: at, messageId: 'first' }, { event: 'opened', date: at, messageId: 'first', email: 'hidden@example.com' }] }) }));
  assert.equal(db.records.get(`${lib.COLLECTION}/${seq.id}`).steps[0].tracking.openCount, 0);
  assert.doesNotMatch(JSON.stringify(db.records.get('pipeListProtectedShares/owner-school-list')), /hidden@example.com/);
});
test('opt-in envelope suppression checks copied recipients before provider send', async () => {
  for (const suppressed of ['copy@example.com', 'hidden@example.com']) {
    const checked = []; let providerCalls = 0;
    const helper = load('netlify/functions/utils/emailSequenceHelpers.ts', {
      './getServiceAccount': { getFirestore: async () => ({}), initAdmin: () => ({}) },
      './emailSafety': { normalizeEmailAddress: s => s.toLowerCase(), DEFAULT_EMAIL_LOCK_STALE_MS: 1000 },
      './emailSuppression': { shouldSuppressTransactionalEmail: async ({ toEmail }) => { checked.push(toEmail); return { suppressed: toEmail === suppressed, reason: 'unsubscribed' }; } },
    }, { fetch: async () => { providerCalls++; throw Error('Provider must not be called'); } });
    const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, { ...draft(), ccEmails: ['copy@example.com'], bccEmails: ['hidden@example.com'] }));
    const result = await lib.dispatchSequence(db, seq.id, new Date(), helper.sendBrevoTransactionalEmail);
    assert.equal(result.status, 'error'); assert.ok(checked.includes(suppressed)); assert.equal(providerCalls, 0);
    assert.equal(db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].contactEmails, undefined);
  }
});


test('readiness identifies the follow-up field without blaming the completed first email', () => {
  const sequence = draft();
  sequence.steps[1].body = 'Hi [Name] at {{School}}';
  sequence.steps[2].subject = '';
  const issues = sequenceUtils.sequenceReadinessIssues(sequence.steps);
  assert.equal(issues.length, 2);
  assert.equal(issues[0].stepIndex, 1);
  assert.equal(issues[0].day, 5);
  assert.equal(issues[0].field, 'body');
  assert.equal(issues[0].placeholders.join(', '), '[Name], {{School}}');
  assert.equal(issues[1].day, 12);
  assert.equal(issues[1].empty, true);
  assert.throws(() => lib.requireReady(sequence), error => /Email 2 message/.test(error.message) && /Email 3 subject/.test(error.message) && !/Email 1/.test(error.message));
  sequence.steps[1].body = 'Hi Robert at Morgan State';
  sequence.steps[2].subject = 'Checking in';
  assert.equal(sequenceUtils.sequenceReadinessIssues(sequence.steps).length, 0);
  assert.doesNotThrow(() => lib.requireReady(sequence));
});

test('confirmed school sends move early leads in both stores without regressing later stages', async () => {
  for (const stage of ['identified', 'outreach-queued', 'cold-email-sent', 'engaged', 'meeting-scheduled', 'contract-signed', 'closed-lost-paused']) {
    const db = setup();
    const leads = () => [db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].items[0], db.records.get('pipeListProtectedShares/owner-school-list').list.items[0]];
    leads().forEach(lead => { lead.stage = stage; });
    let seq = await lib.mutateSequence(db, 'owner', input('save', 0, draft()));
    leads().forEach(lead => assert.equal(lead.stage, stage));
    seq = await lib.mutateSequence(db, 'owner', input('send', seq.version, draft()));
    seq = await lib.dispatchSequence(db, seq.id, new Date(), async () => ({ success: true, messageId: 'first' }));
    leads().forEach(lead => assert.equal(lead.stage, ['identified', 'outreach-queued'].includes(stage) ? 'cold-email-sent' : stage));
    leads().forEach(lead => { lead.stage = 'engaged'; });
    await lib.dispatchSequence(db, seq.id, new Date(seq.nextSendAt), async () => ({ success: true, messageId: 'follow-up' }));
    leads().forEach(lead => assert.equal(lead.stage, 'engaged'));
  }
});
test('unconfirmed school sends leave the pipeline stage unchanged', async () => {
  for (const result of [{ success: false, error: 'failed' }, { success: true, skipped: true, suppressed: true }, { success: true }]) {
    const db = setup();
    db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].items[0].stage = 'outreach-queued';
    db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].stage = 'outreach-queued';
    const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
    await lib.dispatchSequence(db, seq.id, new Date(), async () => result);
    assert.equal(db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].items[0].stage, 'outreach-queued');
    assert.equal(db.records.get('pipeListProtectedShares/owner-school-list').list.items[0].stage, 'outreach-queued');
  }
});

function existingUniversitySequence(db, { status = 'active', attempt = null, personal = true, protectedList = true } = {}) {
  if (personal) db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].templateKey = 'university-pilot';
  if (protectedList) db.records.get('pipeListProtectedShares/owner-school-list').list.templateKey = 'university-pilot';
  const sequence = {
    ...draft(), id: lib.sequenceId('owner', 'school-list', 'school'), ownerUid: 'owner', listId: 'school-list', itemId: 'school',
    status, nextStepIndex: 0, nextSendAt: status === 'active' ? '2026-01-01T12:00:00.000Z' : '',
    version: 3, lastError: '', createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z', attempt,
  };
  db.records.set(`${lib.COLLECTION}/${sequence.id}`, structuredClone(sequence));
  return sequence;
}

test('university sequence creation, saves, send and resume reject before datastore writes', async () => {
  for (const location of ['personal', 'protectedList', 'both']) {
    for (const action of ['save', 'send', 'resume']) {
      const db = setup();
      existingUniversitySequence(db, { status: 'paused', personal: location !== 'protectedList', protectedList: location !== 'personal' });
      const before = structuredClone([...db.records]);
      await assert.rejects(lib.mutateSequence(db, 'owner', input(action, 3, draft())), error => error.status === 403 && /manual-only/.test(error.message));
      assert.deepEqual([...db.records], before);
    }
    const db = setup();
    const seq = existingUniversitySequence(db, { personal: location !== 'protectedList', protectedList: location !== 'personal' });
    db.records.delete(`${lib.COLLECTION}/${seq.id}`);
    const before = structuredClone([...db.records]);
    await assert.rejects(lib.mutateSequence(db, 'owner', input('save', 0, draft())), /manual-only/);
    assert.deepEqual([...db.records], before);
  }
});

test('due university sequences never claim, deliver, or rewrite queue and review evidence', async () => {
  for (const location of ['personal', 'protectedList', 'both']) for (const attempt of [null, { index: 0, startedAt: '2000-01-01T00:00:00Z' }]) {
    const db = setup();
    const seq = existingUniversitySequence(db, { attempt, personal: location !== 'protectedList', protectedList: location !== 'personal' });
    const before = structuredClone([...db.records]);
    let calls = 0;
    assert.equal(await lib.dispatchSequence(db, seq.id, new Date(), async () => { calls++; throw Error('No provider calls'); }), null);
    assert.equal(calls, 0);
    assert.deepEqual([...db.records], before);
  }
  const db = setup(); const seq = existingUniversitySequence(db);
  db.records.get('simpbudget-users/owner/pipeLists/state').lists = [];
  db.records.get('pipeListProtectedShares/owner-school-list').list.items = [];
  const before = structuredClone([...db.records]);
  assert.equal(await lib.dispatchSequence(db, seq.id, new Date(), () => { throw Error('No provider calls'); }), null);
  assert.deepEqual([...db.records], before);
});

test('university sequences stay readable and pausable without allowing pause to save a draft', async () => {
  const db = setup(); const seq = existingUniversitySequence(db);
  const current = await lib.readSequences(db, 'owner', 'school-list', 'school');
  assert.equal(current.id, seq.id);
  await assert.rejects(lib.mutateSequence(db, 'owner', input('pause', 3, draft())), /manual-only/);
  const paused = await lib.mutateSequence(db, 'owner', input('pause', 3));
  assert.equal(paused.status, 'paused'); assert.equal(paused.nextSendAt, '');
  assert.deepEqual(paused.steps, seq.steps);
  await assert.rejects(lib.mutateSequence(db, 'owner', input('resume', paused.version)), /manual-only/);
});

test('university delivery uncertainty remains inspectable and existing tracking review is available', async () => {
  const db = setup(); const seq = existingUniversitySequence(db, { status: 'error', attempt: { index: 0, startedAt: '2026-01-01T12:00:00.000Z' } });
  seq.lastError = 'Delivery outcome is uncertain. Check Brevo before any further send.';
  db.records.set(`${lib.COLLECTION}/${seq.id}`, structuredClone(seq));
  let refreshCalls = 0;
  const api = load('src/pages/api/pipelists/email-sequence.ts', {
    '../../../utils/pipelistsRuntime': runtime,
    '../../../../netlify/functions/utils/getSimpBudgetServiceAccount': { getSimpBudgetAuth: async () => ({ verifyIdToken: async () => ({ uid: 'owner', email: lib.OWNER_EMAIL }) }), getSimpBudgetFirestore: async () => db },
    '../../../../netlify/functions/lib/pipelistsEmailSequences': lib,
    '../../../../netlify/functions/lib/pipelistsEmailSequenceTracking': { refreshSequenceTracking: async (_, current) => { assert.equal(current.id, seq.id); refreshCalls++; } },
  }).default;
  for (const method of ['GET', 'POST']) {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await api({ method, headers: { host: 'fitwithpulse.ai', authorization: 'Bearer verified-owner' }, query: { listId: 'school-list', itemId: 'school' }, body: { action: 'refresh-tracking', listId: 'school-list', itemId: 'school' } }, res);
    assert.equal(res.code, 200); assert.equal(res.body.sequence.lastError, seq.lastError);
    assert.deepEqual(res.body.sequence.attempt, seq.attempt);
  }
  assert.equal(refreshCalls, 1);
  assert.deepEqual(db.records.get(`${lib.COLLECTION}/${seq.id}`), seq);
});

function unverifiedSequenceIdentities() {
  return [
    db => { delete db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].templateKey; },
    db => { db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].templateKey = 'unknown'; },
    db => { const lists = db.records.get('simpbudget-users/owner/pipeLists/state').lists; lists.push({ ...lists[0] }); },
    db => { const lists = db.records.get('simpbudget-users/owner/pipeLists/state').lists; lists.push({ ...lists[0], deletedAt: '2026-01-01' }); },
    db => { delete db.records.get('pipeListProtectedShares/owner-school-list').list.templateKey; },
    db => { db.records.get('pipeListProtectedShares/owner-school-list').list.templateKey = 'unknown'; },
    db => { delete db.records.get('pipeListProtectedShares/owner-school-list').ownerUid; },
    db => { db.records.get('pipeListProtectedShares/owner-school-list').ownerUid = 'foreign'; },
    db => { delete db.records.get('pipeListProtectedShares/owner-school-list').listId; },
    db => { db.records.get('pipeListProtectedShares/owner-school-list').list.id = 'foreign-list'; },
    db => { db.records.get('pipeListProtectedShares/owner-school-list').list.deletedAt = '2026-01-01'; },
    db => { delete db.records.get('pipeListProtectedShares/owner-school-list').list; },
    db => { db.records.get('simpbudget-users/owner/pipeLists/state').lists = []; },
  ];
}

test('sequence create, save, send and resume fail closed on unverified list identity or template', async () => {
  for (const change of unverifiedSequenceIdentities()) {
    for (const action of ['save', 'send', 'resume']) {
      const db = setup();
      const seq = await lib.mutateSequence(db, 'owner', input('save', 0, draft()));
      change(db);
      const before = structuredClone([...db.records]);
      await assert.rejects(lib.mutateSequence(db, 'owner', input(action, seq.version, draft())), error => error.status === 403 && /could not be verified/.test(error.message));
      assert.deepEqual([...db.records], before);
    }
    const db = setup(); change(db);
    await assert.rejects(lib.mutateSequence(db, 'owner', input('save', 0, draft())), /could not be verified/);
    assert.equal(db.records.has(`${lib.COLLECTION}/${lib.sequenceId('owner', 'school-list', 'school')}`), false);
  }
});

test('unverified queued sequence identity never claims, rewrites, or calls the provider', async () => {
  for (const change of unverifiedSequenceIdentities()) for (const stale of [false, true]) {
    const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
    if (stale) db.records.get(`${lib.COLLECTION}/${seq.id}`).attempt = { index: 0, startedAt: '2000-01-01T00:00:00Z' };
    change(db);
    const before = structuredClone([...db.records]);
    let calls = 0;
    assert.equal(await lib.dispatchSequence(db, seq.id, new Date(), async () => { calls++; return { success: true, messageId: 'must-not-send' }; }), null);
    assert.equal(calls, 0); assert.deepEqual([...db.records], before);
  }
});

test('known unrelated personal-only sequence delivery remains available and missing template allows read/pause only', async () => {
  for (const template of ['vc', 'grant', 'pitch', 'contract', 'partner', 'investor-metrics', 'contacts', 'task']) {
    const db = setup(); db.records.delete('pipeListProtectedShares/owner-school-list');
    db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].templateKey = template;
    const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
    let calls = 0;
    const delivered = await lib.dispatchSequence(db, seq.id, new Date(), async () => { calls++; return { success: true, messageId: 'synthetic-message' }; });
    assert.equal(calls, 1); assert.equal(delivered.nextStepIndex, 1);
  }
  const db = setup(); const seq = await lib.mutateSequence(db, 'owner', input('send', 0, draft()));
  delete db.records.get('simpbudget-users/owner/pipeLists/state').lists[0].templateKey;
  assert.equal((await lib.readSequences(db, 'owner', 'school-list', 'school')).id, seq.id);
  await assert.rejects(lib.mutateSequence(db, 'owner', input('pause', seq.version, draft())), /could not be verified/);
  const paused = await lib.mutateSequence(db, 'owner', input('pause', seq.version));
  assert.equal(paused.status, 'paused');
  await assert.rejects(lib.mutateSequence(db, 'owner', input('resume', paused.version)), /could not be verified/);
});
