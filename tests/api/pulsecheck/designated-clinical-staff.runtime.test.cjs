const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
function compile(file, dependencies) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(dependencies, mod, mod.exports);
  return mod.exports;
}
const validator = compile('src/lib/pulsecheck/designatedClinicalStaff.ts', require);
const valid = () => ({ primary: { name: 'Synthetic Primary', email: 'primary@example.test', phone: '+14105550123' }, backup: null, timeZone: 'America/New_York', coverage: { mode: 'scheduled', days: [1,2,3,4,5], start: '09:00', end: '17:00' }, acknowledgmentMinutes: 5 });
function fixture() {
  const rows = new Map([
    ['admin/admin@example.test', {}],
    ['pulsecheck-teams/team', { organizationId: 'org', status: 'active', escalationRoute: 'hotline' }],
    ['pulsecheck-organizations/org', { status: 'active', productBrand: 'athleticmind' }],
  ]);
  const writes = [], verified = [], modes = []; let sequence = 0, rejectToken = false;
  const snap = key => ({ id: key.split('/').at(-1), exists: rows.has(key), data: () => structuredClone(rows.get(key)) });
  const ref = key => ({ path: key, id: key.split('/').at(-1), get: async () => snap(key), collection: name => collection(`${key}/${name}`) });
  const collection = key => ({ doc: id => ref(`${key}/${id || `generated-${++sequence}`}`) });
  const db = { collection, async runTransaction(fn) { const pending = []; const result = await fn({ get: r => r.get(), set: (r,v) => pending.push([r.path,structuredClone(v)]) }); for (const [key,v] of pending) { rows.set(key,v); writes.push(key); } return result; } };
  const app = { auth: () => ({ verifyIdToken: async (...args) => { verified.push(args); if (rejectToken) throw new Error('revoked'); return { uid: 'admin-user', email: 'admin@example.test' }; } }), firestore: () => db };
  const firebase = { __esModule: true, default: { firestore: { FieldValue: { serverTimestamp: () => 123 } } }, getFirebaseAdminApp: dev => { modes.push(dev); return app; } };
  const handler = compile('src/pages/api/admin/pulsecheck/designated-clinical-staff.ts', name => name.endsWith('firebase-admin') ? firebase : name.endsWith('designatedClinicalStaff') ? validator : require(name)).default;
  const call = async (method = 'GET', body, headers = { authorization: 'Bearer good' }, query = { teamId: 'team' }) => {
    const res = { code: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(c) { this.code=c; return this; }, json(v) { this.body=v; return this; } };
    await handler({ method, body, headers, query },res); return res;
  };
  return { rows,writes,verified,modes,call, rejectToken: () => { rejectToken=true; } };
}
test('contact settings reject unauthenticated, revoked, nonadmin and closed-account access', async () => {
  const f = fixture(); assert.equal((await f.call('GET',null,{})).code,401); assert.equal(f.verified.length,0);
  f.rejectToken(); assert.equal((await f.call()).code,401);
  for (const mutate of [f=>f.rows.delete('admin/admin@example.test'),f=>f.rows.set('account-closure-jobs/admin-user',{})]) { const other=fixture(); mutate(other); assert.equal((await other.call()).code,403); assert.equal(other.writes.length,0); }
});
test('draft contact persistence is private, audited, versioned and never changes live team routing or memberships', async () => {
  const f=fixture(); const original=structuredClone(f.rows.get('pulsecheck-teams/team'));
  assert.deepEqual((await f.call()).body,{config:null});
  const r=await f.call('PUT',{teamId:'team',configuration:valid(),expectedRevision:0});
  assert.equal(r.code,200); assert.equal(r.body.config.status,'draft'); assert.equal(r.body.config.revision,1); assert.equal(r.body.config.updatedBy,'admin-user');
  assert.deepEqual(f.rows.get('pulsecheck-teams/team'),original);
  assert.ok(f.writes.every(key=>key.startsWith('pulsecheck-team-escalation-settings/team')));
  assert.ok(f.writes.some(key=>key.includes('/audit/')));
  assert.deepEqual(f.verified[0],['good',true]); assert.equal(r.headers['Cache-Control'],'no-store');
  assert.equal((await f.call()).body.config.primary.email,'primary@example.test');
  assert.equal((await f.call('PUT',{teamId:'team',configuration:valid(),expectedRevision:1})).body.config.revision,2);
});
test('stale revisions cannot overwrite another administrator changes', async () => {
  const f=fixture(); await f.call('PUT',{teamId:'team',configuration:valid(),expectedRevision:0});
  const before=f.writes.length;
  assert.equal((await f.call('PUT',{teamId:'team',configuration:valid(),expectedRevision:0})).code,409);
  assert.equal(f.writes.length,before);
});
test('invalid contacts, coverage, injected activation and malformed scope are rejected before writes', async () => {
  for (const mutate of [v=>v.primary.phone='988',v=>v.primary.email='bad',v=>v.timeZone='not-a-zone',v=>v.coverage.days=[],v=>v.coverage.start='18:00',v=>v.backup={...v.primary},v=>v.status='active',v=>v.acknowledgmentMinutes=0]) {
    const f=fixture(), configuration=valid(); mutate(configuration);
    assert.equal((await f.call('PUT',{teamId:'team',configuration,expectedRevision:0})).code,400); assert.equal(f.writes.length,0);
  }
  const f=fixture(); assert.equal((await f.call('GET',null,undefined,{teamId:'../other'})).code,400);
  assert.equal((await f.call('PUT',{teamId:'team',configuration:valid(),expectedRevision:0,activate:true})).code,400);
  assert.equal(f.writes.length,0);
});
