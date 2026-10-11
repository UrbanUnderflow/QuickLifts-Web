const test = require('node:test');
const assert = require('node:assert/strict');
const sharing = require('../../../netlify/functions/lib/journal-sharing');
const policy = require('../../../src/content/consents/athleticmind-processing-v1.json');
const T = Date.parse('2026-10-10T00:00:00Z'), uid = 'athlete';
const entryId = 'abcdefab-1234-4234-9234-abcdefabcdef';
const base = `pulsecheck-evidence-journals/${uid}`;
function fixture() {
  const decision = { decision: 'accepted', version: policy.version, signedName: 'Synthetic Athlete', decidedAt: new Date(T).toISOString(), document: structuredClone(policy) };
  const rows = new Map([
    ['pulsecheck-teams/team', { status: 'active', organizationId: 'org' }],
    ['pulsecheck-organizations/org', { status: 'active', productBrand: 'athleticmind' }],
    [`pulsecheck-team-memberships/team_${uid}`, { userId: uid, teamId: 'team', organizationId: 'org', role: 'athlete', status: 'active', athleteOnboarding: { productConsentAccepted: true, requiredConsents: [structuredClone(policy)], consentDecisions: { [policy.id]: decision } } }],
    [`pulsecheck-team-memberships/team_${uid}/consent-events/accept`, { actorUserId: uid, recordedAt: T + 1, decisions: { [policy.id]: structuredClone(decision) } }],
    [`${base}/entries/${entryId}`, { id: entryId, moment: 'Synthetic private entry', action: null, createdAt: T + 2000, updatedAt: T + 2000 }],
  ]);
  const txReads = []; let beforeTransaction;
  const snapshot = (path, records) => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => structuredClone(records.get(path)) });
  const collection = (path, filters = [], max = Infinity) => ({ path,
    doc(id) { const key = `${path}/${id}`; return { path: key, read: records => snapshot(key, records), get: async () => snapshot(key, rows), collection: name => collection(`${key}/${name}`) }; },
    where(field, op, value) { assert.equal(op, '=='); return collection(path, [...filters, [field, value]], max); },
    limit(limit) { return collection(path, filters, limit); },
    read(records) { return { docs: [...records.keys()].filter(key => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1 && filters.every(([field, value]) => records.get(key)[field] === value)).slice(0, max).map(key => snapshot(key, records)) }; },
    async get() { return this.read(rows); },
  });
  const db = { collection, async runTransaction(callback) {
    if (beforeTransaction) { const hook = beforeTransaction; beforeTransaction = null; hook(); }
    const copy = new Map([...rows.entries()].map(([key, value]) => [key, structuredClone(value)]));
    const result = await callback({ get: async ref => { txReads.push(ref.path); return ref.read(copy); }, set: (ref, value) => copy.set(ref.path, structuredClone(value)), create: (ref, value) => { assert.equal(copy.has(ref.path), false); copy.set(ref.path, structuredClone(value)); } });
    rows.clear(); for (const [key, value] of copy) rows.set(key, value); return result;
  } };
  const entry = () => rows.get(`${base}/entries/${entryId}`);
  const share = (extra = {}) => sharing.setJournalSharing(db, uid, { action: 'share', entryId, entryRevision: sharing.journalEntryRevision(entry()), teamId: 'team', disclosureVersion: sharing.AM_VERSION, accepted: true, ...extra }, T + 3000);
  return { rows, db, entry, share, txReads, before: callback => { beforeTransaction = callback; } };
}
test('sharing binds exact current signed consent and revision inside the same transaction', async () => {
  const f = fixture();
  const result = await f.share({ entryId: entryId.toUpperCase() });
  assert.equal(result.sharing.entryId, entryId);
  assert.equal(result.sharing.processingConsentEventId, 'accept');
  assert.ok(f.txReads.includes(`pulsecheck-team-memberships/team_${uid}/consent-events`));
  assert.equal((await sharing.authorizedJournalAnalysis(f.db, uid, entryId.toUpperCase(), T + 4000)).trustedSource.kind, 'journal');
  assert.equal((await sharing.journalSharingState(f.db, uid, entryId.toUpperCase(), T + 4000)).entryRevision, sharing.journalEntryRevision(f.entry()));
  f.entry().moment = 'Changed writing';
  await assert.rejects(sharing.authorizedJournalAnalysis(f.db, uid, entryId, T + 4000), error => error.status === 403);
  await assert.rejects(f.share({ entryRevision: result.entryRevision }), error => error.status === 409);
});
test('invalid disclosure, wrong scope and concurrent base-consent withdrawal cannot grant journal access', async () => {
  for (const extra of [{ accepted: false }, { disclosureVersion: 'old' }, { teamId: 'another' }]) {
    const f = fixture(); await assert.rejects(f.share(extra)); assert.equal(f.rows.has(`${base}/sharing/${entryId}`), false);
  }
  const f = fixture();
  f.before(() => { f.rows.get(`pulsecheck-team-memberships/team_${uid}`).athleteOnboarding.productConsentAccepted = false; });
  await assert.rejects(f.share(), error => error.status === 403);
  assert.equal(f.rows.has(`${base}/sharing/${entryId}`), false);
});
test('scope changes and unsharing retain immutable text-free withdrawals in the former program scope', async () => {
  const f = fixture(), first = await f.share();
  const personal = await f.share({ teamId: null, disclosureVersion: sharing.PERSONAL_VERSION });
  assert.equal(personal.sharing.organizationId, null);
  const events = [...f.rows.entries()].filter(([path]) => path.startsWith(`${base}/sharing-events/`)).map(([, value]) => value);
  assert.equal(events.length, 1); assert.equal(events[0].teamId, 'team');
  assert.equal(events[0].permissionEventId, first.sharing.permissionEventId);
  assert.equal(JSON.stringify(events).includes(f.entry().moment), false);
  await sharing.setJournalSharing(f.db, uid, { action: 'unshare', entryId }, T + 4000);
  await assert.rejects(sharing.authorizedJournalAnalysis(f.db, uid, entryId, T + 4000), error => error.status === 403);
});
test('future preference is newly accepted, versioned, future-only and cannot override a direct choice', async () => {
  const f = fixture();
  const preference = await sharing.setJournalSharing(f.db, uid, { action: 'preference', enabled: true, teamId: null, disclosureVersion: sharing.PERSONAL_VERSION, accepted: true }, T + 1000);
  assert.ok(preference.futurePreference.preferenceVersion);
  assert.equal((await sharing.applyFutureJournalSharing(f.db, uid, { ...f.entry(), createdAt: T }, T + 3000)), null);
  assert.equal((await sharing.applyFutureJournalSharing(f.db, uid, f.entry(), T + 3000)).sharing.status, 'shared');
  await assert.rejects(sharing.applyFutureJournalSharing(f.db, uid, f.entry(), T + 4000), error => error.status === 409);
});
test('same-millisecond preference change and forged entry creation time are rejected transactionally', async () => {
  for (const change of ['preference', 'createdAt']) {
    const f = fixture();
    await sharing.setJournalSharing(f.db, uid, { action: 'preference', enabled: true, teamId: null, disclosureVersion: sharing.PERSONAL_VERSION, accepted: true }, T + 1000);
    const snapshot = structuredClone(f.entry());
    f.before(() => {
      if (change === 'preference') f.rows.get(`${base}/preferences/nora-sharing`).preferenceVersion = 'new-same-ms-version';
      else f.entry().createdAt = T;
    });
    await assert.rejects(sharing.applyFutureJournalSharing(f.db, uid, snapshot, T + 3000), error => error.status === 409);
    assert.equal(f.rows.has(`${base}/sharing/${entryId}`), false);
  }
});
test('deleted and soft-deleted entries cannot be shared or analyzed and malformed IDs fail closed', async () => {
  for (const mutation of [f => f.rows.delete(`${base}/entries/${entryId}`), f => { f.entry().deletedAt = T + 3000; }]) {
    const f = fixture(); await f.share(); mutation(f);
    await assert.rejects(sharing.authorizedJournalAnalysis(f.db, uid, entryId, T + 4000), error => error.status === 403);
    await assert.rejects(sharing.setJournalSharing(f.db, uid, { action: 'share', entryId, teamId: null, disclosureVersion: sharing.PERSONAL_VERSION, accepted: true }, T + 4000), error => error.status === 404);
  }
  const f = fixture();
  for (const id of ['../another', '', 123]) await assert.rejects(sharing.journalSharingState(f.db, uid, id), error => error.status === 400);
});

test('sharing HTTP API authenticates before reads and allowlists owner, scope and future guards', async () => {
  const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
  const source = fs.readFileSync(path.resolve(__dirname, '../../../src/pages/api/evidence-journal/sharing.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [], module = { exports: {} };
  const helpers = { journalSharingState: async (...args) => { calls.push(args); return {}; }, setJournalSharing: async (...args) => { calls.push(args); return {}; }, authorizedJournalAnalysis: async () => { throw Object.assign(new Error('Denied'), { status: 403 }); } };
  new Function('require', 'module', 'exports', code)(name => name.endsWith('journal-sharing') ? helpers : { authorizeLinearAthlete: async () => { throw new Error('unauthenticated'); } }, module, module.exports);
  const response = () => ({ code: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(code) { this.code=code; return this; }, json(value) { this.value=value; return this; } });
  let res = response();
  await module.exports.default({ method: 'GET', query: { entryId }, headers: {} }, res);
  assert.equal(res.code, 401); assert.equal(calls.length, 0);
  const handler = module.exports.createJournalSharingHandler({ authorize: async () => ({ uid, db: 'trusted-db' }), now: () => T, fetch: async () => { throw new Error('Unauthorized analysis must not call downstream chat'); } });
  res = response();
  await handler({ method: 'POST', headers: {}, body: { action: 'share', entryId, athleteId: 'other', userId: 'other', entryRevision: 'requested', teamId: 'team', disclosureVersion: sharing.AM_VERSION, accepted: true, expectedPreferenceUpdatedAt: 1, expectedPreferenceVersion: 'forged', now: 1, processingConsentEventId: 'forged' } }, res);
  assert.equal(res.code, 200);
  assert.equal(calls[0][0], 'trusted-db'); assert.equal(calls[0][1], uid); assert.equal(calls[0][3], T);
  for (const field of ['athleteId','userId','expectedPreferenceUpdatedAt','expectedPreferenceVersion','now','processingConsentEventId']) assert.equal(calls[0][2][field], undefined);
  res = response(); await handler({ method: 'POST', headers: {}, body: { action: 'analyze', entryId } }, res);
  assert.equal(res.code, 403); assert.match(res.headers['Cache-Control'], /no-store/);
});

test('Firestore transaction adapter supports real consent queries and scoped receipt writes', { skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8188' }, async () => {
  const { Firestore } = require('@google-cloud/firestore');
  const db = new Firestore({ projectId: 'demo-journal-sharing-transactions' });
  try {
    const f = fixture();
    await db.recursiveDelete(db.collection('pulsecheck-evidence-journals'));
    for (const [path, value] of f.rows) await db.doc(path).set(value);
    const result = await sharing.setJournalSharing(db, uid, { action: 'share', entryId, entryRevision: sharing.journalEntryRevision(f.entry()), teamId: 'team', disclosureVersion: sharing.AM_VERSION, accepted: true }, T + 3000);
    assert.equal(result.sharing.teamId, 'team');
    assert.equal((await sharing.authorizedJournalAnalysis(db, uid, entryId, T + 4000)).trustedSource.kind, 'journal');
    await sharing.setJournalSharing(db, uid, { action: 'share', entryId, entryRevision: sharing.journalEntryRevision(f.entry()), teamId: null, disclosureVersion: sharing.PERSONAL_VERSION, accepted: true }, T + 5000);
    const events = await db.collection(`${base}/sharing-events`).get();
    assert.equal(events.size, 1); assert.equal(events.docs[0].data().teamId, 'team');
  } finally { await db.terminate(); }
});
