const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const loadTs = require('./load-ts.cjs');
const repo = path.resolve(__dirname, '../../..');
const source = ts.transpileModule(fs.readFileSync(path.join(repo, 'netlify/functions/brevo-email-webhook.ts'), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText;

function setup(options = {}) {
  let saved = {
    equityDocumentId: 'founder-return', documentType: 'founder_share_return', recipientEmail: 'founder@example.test',
    messageId: '<current@brevo>', status: 'sent',
    ...options.saved,
  };
  const writes = [];
  const snapshot = (data, ref) => ({exists: Boolean(data), data: () => data, ref});
  const ref = (collection, id) => ({collection, id,
    get: async () => snapshot(collection === 'signingRequests' ? saved : null),
    set: async data => {if (collection === 'signingRequests') {writes.push(data); saved = {...saved, ...data};}},
  });
  const query = {where: () => query, limit: () => query, get: async () => ({docs: [], empty: true})};
  const db = {
    collection: name => ({...query, doc: id => ref(name, id)}),
    runTransaction: async callback => callback({
      get: async requestRef => snapshot({...saved, ...options.race}, requestRef),
      set: (requestRef, data) => {writes.push(data); saved = {...saved, ...options.race, ...data};},
    }),
  };
  const firestore = () => db;
  firestore.FieldValue = {increment: count => count};
  const module = {exports: {}};
  vm.runInNewContext(source, {
    module, exports: module.exports, Date,
    process: {env: options.withoutSecret ? {} : {BREVO_WEBHOOK_SECRET: 'verified-secret'}},
    console: {log() {}, warn() {}, error() {}},
    require: name => {
      if (name === './config/firebase') return {admin: {firestore}};
      if (name === './utils/getSimpBudgetServiceAccount') return {getSimpBudgetFirestore: async () => db};
      if (name === './utils/mixpanelAnalytics') return {MACRA_MIXPANEL_EVENTS: {}, safeTrackMacraWebOfferEvent: async () => {}};
      if (name.startsWith('../../src/lib/')) return loadTs(path.join(repo, name.replace('../../', '') + '.ts'));
      return require(name);
    },
  });
  return {
    writes, saved: () => saved,
    invoke: async (overrides = {}, headers = {'x-brevo-secret': 'verified-secret'}) => module.exports.handler({
      httpMethod: 'POST', headers,
      body: JSON.stringify({event: 'blocked', email: 'founder@example.test', 'message-id': '<current@brevo>',
        ts_event: 1790208000, reason: 'Your sender is not authorized', 'X-Mailin-custom': JSON.stringify({signingRequestId: 'req'}), ...overrides}),
    }, {}),
  };
}

test('verified matching equity failure is sticky and preserves signed contract evidence', async () => {
  const s = setup({saved: {status: 'signed', signedAt: '2026-09-23T23:00:00.000Z', signatureData: {typedName: 'Founder'}}});
  const result = await s.invoke();
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(s.writes.length, 1);
  assert.equal(s.saved().status, 'signed');
  assert.equal(s.saved().signatureData.typedName, 'Founder');
  assert.equal(s.saved().messageId, '<current@brevo>');
  assert.equal(s.saved().emailStatus, 'failed');
  assert.match(s.saved().lastEmailError, /sender is not authorized/);
  assert.equal(s.saved().emailDelivery.status, 'failed');
  assert.equal(s.saved().emailDelivery.providerEvent, 'blocked');
  assert.equal(s.saved().emailDelivery.eventAt, new Date(1790208000 * 1000).toISOString());
  assert.equal(s.saved().lastEmailEventAt.getTime(), 1790208000 * 1000);
});

test('equity callback without configured secret cannot change an equity request', async () => {
  const s = setup({withoutSecret: true});
  assert.equal((await s.invoke()).statusCode, 200);
  assert.equal(s.writes.length, 0);
});

test('configured secret must match before processing any webhook', async () => {
  const s = setup();
  assert.equal((await s.invoke({}, {'x-brevo-secret': 'wrong'})).statusCode, 401);
  assert.equal(s.writes.length, 0);
});

for (const [label, options, event] of [
  ['earlier resend', {}, {'message-id': '<old@brevo>'}],
  ['different recipient', {}, {email: 'other@example.test'}],
  ['missing message ID', {}, {'message-id': undefined}],
  ['provider callback before send ID is saved', {saved: {messageId: null}}, {}],
  ['missing saved recipient', {saved: {recipientEmail: null}}, {}],
  ['new resend during callback', {race: {messageId: '<newer@brevo>'}}, {}],
  ['recipient changed during callback', {race: {recipientEmail: 'changed@example.test'}}, {}],
]) test(`ignores ${label}`, async () => {
  const s = setup(options);
  assert.equal((await s.invoke(event)).statusCode, 200);
  assert.equal(s.writes.length, 0);
});

test('matching recipient comparison is case insensitive and delivery cannot mark contract viewed', async () => {
  const s = setup();
  assert.equal((await s.invoke({event: 'opened', email: ' FOUNDER@EXAMPLE.TEST '})).statusCode, 200);
  assert.equal(s.saved().status, 'sent');
  assert.equal(s.saved().emailDelivery.status, 'delivered');
  assert.equal(s.saved().recipientEmail, 'founder@example.test');
});

test('an older provider callback cannot replace a newer failure', async () => {
  const s = setup();
  await s.invoke({event: 'hard_bounce', ts_event: 1790208090});
  await s.invoke({event: 'delivered', ts_event: 1790208000});
  assert.equal(s.saved().emailDelivery.status, 'failed');
  assert.equal(s.saved().emailStatus, 'failed');
  assert.equal(s.saved().emailDelivery.providerEvent, 'hard_bounce');
  assert.match(s.saved().lastEmailError, /sender is not authorized/);
});

test('legacy non-equity requests retain their existing webhook behavior', async () => {
  const s = setup({withoutSecret: true, saved: {equityDocumentId: undefined, documentType: 'consulting_agreement'}});
  delete s.saved().equityDocumentId;
  assert.equal((await s.invoke({event: 'delivered', 'message-id': '<legacy-message@brevo>'})).statusCode, 200);
  assert.equal(s.saved().status, 'delivered');
  assert.equal(s.saved().messageId, '<legacy-message@brevo>');
  assert.equal(s.saved().emailDelivery, undefined);
});

test('equity callback without an unambiguous provider timestamp is not delivery evidence', async () => {
  const s = setup();
  assert.equal((await s.invoke({ts_event: undefined, date: '2026-09-23 14:00:00'})).statusCode, 200);
  assert.equal(s.writes.length, 0);
});

test('queued callbacks cannot clear a sticky failure; confirmed delivery can', async () => {
  const s = setup();
  await s.invoke({event: 'blocked', ts_event: 1790208000});
  await s.invoke({event: 'request', ts_event: 1790208010});
  assert.equal(s.saved().emailDelivery.status, 'failed');
  assert.match(s.saved().emailDelivery.unresolvedFailure.reason, /sender is not authorized/);
  await s.invoke({event: 'delivered', ts_event: 1790208020});
  assert.equal(s.saved().emailDelivery.status, 'delivered');
  assert.equal(s.saved().emailDelivery.unresolvedFailure, null);
  assert.equal(s.saved().lastEmailError, null);
  assert.equal(s.saved().status, 'sent');
});
