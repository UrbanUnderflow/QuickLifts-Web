const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
const owner = { uid: 'synthetic-owner', email: 'tremaine.grant@gmail.com' };
const production = { NODE_ENV: 'production', CONTEXT: 'production', SITE_ID: 'synthetic-site-id', SITE_NAME: 'synthetic-site', URL: 'https://fitwithpulse.ai' };
const deployment = { production: true, siteId: production.SITE_ID, siteName: production.SITE_NAME, url: production.URL };
function load(file, mocks = {}, globals = {}, env = production) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module, exports: module.exports, process: { env }, console: { error() {}, warn() {} }, URL,
    require: name => { if (!(name in mocks)) throw Error(`Unmocked dependency: ${name}`); return typeof mocks[name] === 'function' ? mocks[name]() : mocks[name]; }, ...globals,
  });
  return module.exports;
}
const policy = load('src/utils/pipelistsTransportPolicy.ts');
function harness({ template = 'contacts', protectedTemplate, protectedOwner = owner.uid, protectedListId = 'owned-list', user = owner, env = production, dbFailure = false } = {}) {
  const statePath = `simpbudget-users/${owner.uid}/pipeLists/state`;
  const protectedPath = `pipeListProtectedShares/${owner.uid}-owned-list`;
  const records = new Map([[statePath, { lists: [{ id: 'owned-list', name: 'Stored contacts', templateKey: template, items: [] }] }]]);
  if (protectedTemplate !== undefined) records.set(protectedPath, { ownerUid: protectedOwner, listId: protectedListId, list: { id: protectedListId, name: 'Protected contacts', templateKey: protectedTemplate, items: [] } });
  const calls = { auth: 0, db: 0, reads: [], sends: [], helperLoads: 0 };
  const ref = key => ({ path: key, collection: id => collection(`${key}/${id}`) });
  const collection = key => ({ doc: id => ref(`${key}/${id}`) });
  const db = { collection, runTransaction: async fn => fn({ get: async ref => { calls.reads.push(ref.path); return { exists: records.has(ref.path), data: () => records.get(ref.path) }; } }) };
  const api = load('src/pages/api/pipelists/send-contact-email.ts', {
    '../../../utils/pipelistsRuntime': load('src/utils/pipelistsRuntime.ts', { '../generated/pipelists-deployment.json': deployment }, {}, env),
    '../../../utils/pipelistsTransportPolicy': policy,
    '../../../../netlify/functions/utils/getSimpBudgetServiceAccount': { getSimpBudgetFirestore: async () => { calls.db++; if (dbFailure) throw Error('Synthetic unavailable store'); return db; } },
    '../../../../netlify/functions/utils/emailSequenceHelpers': () => {
      calls.helperLoads++;
      return { buildEmailDedupeKey: parts => parts.join(':'), sendBrevoTransactionalEmail: async payload => { calls.sends.push(payload); return { success: true, messageId: 'synthetic-message' }; } };
    },
  }, { fetch: async () => { calls.auth++; return { ok: true, json: async () => ({ users: user ? [{ localId: user.uid, email: user.email }] : [] }) }; } }, env).default;
  const body = { provider: 'pulse-brevo', fromEmail: 'tre@fitwithpulse.ai', emailType: 'general-update', toEmails: ['recipient@example.com'], subject: 'Synthetic update', message: 'Synthetic message', listId: 'owned-list', listName: 'Untrusted request name', batchId: 'synthetic-batch' };
  async function request(changes = {}, { method = 'POST', headers = { host: 'fitwithpulse.ai', authorization: 'Bearer synthetic-token' } } = {}) {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await api({ method, headers, body: { ...body, ...changes } }, res);
    return res;
  }
  return { records, statePath, protectedPath, calls, request };
}

test('direct sender authenticates before any list lookup or transport initialization', async () => {
  for (const user of [null, { uid: 'different-owner', email: 'other@example.com' }]) {
    const h = harness({ user }); const res = await h.request();
    assert.equal(res.code, user ? 403 : 401);
    assert.equal(h.calls.db, 0); assert.equal(h.calls.helperLoads, 0); assert.equal(h.calls.sends.length, 0);
  }
  const h = harness(); const res = await h.request({}, { headers: { host: 'fitwithpulse.ai' } });
  assert.equal(res.code, 401); assert.equal(h.calls.auth, 0); assert.equal(h.calls.db, 0);
});

test('university identity in either stored copy blocks spoofed direct-send metadata', async () => {
  for (const options of [{ template: 'university-pilot' }, { template: 'contacts', protectedTemplate: 'university-pilot' }, { template: 'university-pilot', protectedTemplate: 'investor-metrics' }]) {
    for (const emailType of ['metrics-update', 'general-update', 'anything-else']) {
      const h = harness(options);
      const res = await h.request({ emailType, listName: 'Investor updates', templateKey: 'investor-metrics', ownerUid: 'forged-owner' });
      assert.equal(res.code, 403); assert.match(res.body.error, /manual-only/);
      assert.equal(h.calls.helperLoads, 0); assert.equal(h.calls.sends.length, 0);
      assert.ok(h.calls.reads.every(key => key.includes(owner.uid)));
    }
  }
});

test('explicit school outreach is blocked even when its submitted list is unrelated', async () => {
  const h = harness({ template: 'investor-metrics' });
  const res = await h.request({ emailType: 'school-outreach' });
  assert.equal(res.code, 403); assert.equal(h.calls.helperLoads, 0);
});

test('missing, unknown, deleted or ambiguous personal lists fail closed', async () => {
  const cases = [
    h => h.records.delete(h.statePath),
    h => { h.records.get(h.statePath).lists = []; },
    h => { h.records.get(h.statePath).lists[0].deletedAt = '2026-01-01'; },
    h => { h.records.get(h.statePath).lists.push({ ...h.records.get(h.statePath).lists[0] }); },
    h => { h.records.get(h.statePath).lists.push({ ...h.records.get(h.statePath).lists[0], deletedAt: '2026-01-01' }); },
    h => { delete h.records.get(h.statePath).lists[0].templateKey; },
    h => { h.records.get(h.statePath).lists[0].templateKey = 'unknown-template'; },
  ];
  for (const change of cases) {
    const h = harness(); change(h); const res = await h.request();
    assert.ok([403, 404].includes(res.code)); assert.equal(h.calls.helperLoads, 0); assert.equal(h.calls.sends.length, 0);
  }
  for (const listId of ['', undefined, 'another-list', 'owner/foreign', 'x'.repeat(121)]) {
    const h = harness(); const res = await h.request({ listId });
    assert.ok([400, 404].includes(res.code)); assert.equal(h.calls.sends.length, 0);
  }
});

test('protected ownership, identity and template must be verifiable', async () => {
  for (const options of [
    { protectedOwner: 'foreign-owner' }, { protectedOwner: null }, { protectedListId: 'foreign-list' }, { protectedTemplate: '' }, { protectedTemplate: 'unknown-template' },
  ]) {
    const h = harness({ protectedTemplate: 'contacts', ...options });
    const res = await h.request(); assert.equal(res.code, 403); assert.equal(h.calls.helperLoads, 0);
  }
  const h = harness({ protectedTemplate: 'contacts' });
  delete h.records.get(h.protectedPath).ownerUid;
  assert.equal((await h.request()).code, 403); assert.equal(h.calls.sends.length, 0);
  const missingListId = harness({ protectedTemplate: 'contacts' });
  delete missingListId.records.get(missingListId.protectedPath).listId;
  assert.equal((await missingListId.request()).code, 403); assert.equal(missingListId.calls.sends.length, 0);
});

test('list read failures stop before transport with a retryable verification error', async () => {
  const h = harness({ dbFailure: true }); const res = await h.request();
  assert.equal(res.code, 503); assert.match(res.body.error, /No email was sent/); assert.equal(h.calls.helperLoads, 0);
});

test('owned non-university sends preserve investor and contact behavior using stored list metadata', async () => {
  for (const template of ['vc', 'grant', 'pitch', 'contract', 'partner', 'investor-metrics', 'contacts', 'task']) {
    const h = harness({ template }); const res = await h.request({ emailType: template === 'investor-metrics' ? 'metrics-update' : 'general-update', ownerUid: 'forged-owner' });
    assert.equal(res.code, 200); assert.equal(res.body.sentCount, 1); assert.equal(h.calls.sends.length, 1);
    const payload = h.calls.sends[0]; const metadata = JSON.parse(payload.headers['X-Mailin-custom']);
    assert.equal(metadata.pipeListsOwnerUid, owner.uid); assert.equal(metadata.pipeListsListName, 'Stored contacts');
    assert.equal(payload.preserveSenderEmail, true); assert.equal(payload.bypassDailyRecipientLimit, true);
    assert.equal(payload.toEmail, 'recipient@example.com'); assert.equal(payload.subject, 'Synthetic update');
  }
  const h = harness({ template: 'contacts', protectedTemplate: 'investor-metrics' });
  assert.equal((await h.request()).code, 200);
  assert.equal(JSON.parse(h.calls.sends[0].headers['X-Mailin-custom']).pipeListsListName, 'Protected contacts');
});

test('direct sender non-production and foreign hosts fail before auth, Firestore or email helper loads', async () => {
  for (const env of [{ NODE_ENV: 'development', CONTEXT: 'production' }, { NODE_ENV: 'production', CONTEXT: 'deploy-preview' }, {}]) {
    const h = harness({ env }); const res = await h.request();
    assert.equal(res.code, 503); assert.equal(h.calls.auth, 0); assert.equal(h.calls.db, 0); assert.equal(h.calls.helperLoads, 0);
  }
  for (const host of ['localhost:3000', 'example.com', 'fitwithpulse.ai.evil.example']) {
    const h = harness(); const res = await h.request({}, { headers: { host, authorization: 'Bearer synthetic-token' } });
    assert.equal(res.code, 503); assert.equal(h.calls.auth, 0); assert.equal(h.calls.db, 0); assert.equal(h.calls.helperLoads, 0);
  }
});
