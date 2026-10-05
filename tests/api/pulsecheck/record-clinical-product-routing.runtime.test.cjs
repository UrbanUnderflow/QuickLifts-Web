const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
function fixture(productBrand, clinicianAvailable = true) {
  const writes = [], emails = [], queries = [];
  const db = { collection(name) {
    const query = { where(field, op, value) { queries.push([name, field, value]); return query; }, limit() { return query; },
      async get() { return name === 'pulsecheck-clinical-escalations' ? { empty: true, docs: [] } : { docs: clinicianAvailable ? [{ id: 'clinician-membership', data: () => ({ userId: 'clinician', email: 'clinician@example.test', role: 'clinician', status: 'active' }) }] : [] }; },
      doc(id) { return { id, async get() { return { exists: true, data: () => name === 'pulsecheck-teams' ? { organizationId: 'org', displayName: 'Team' } : name === 'pulsecheck-organizations' ? { productBrand } : { displayName: 'Athlete' } }; }, async set(data) { writes.push({ name, id, data }); } }; },
      async add(data) { writes.push({ name, data }); return { id: 'new-escalation' }; },
    }; return query;
  } };
  const firestore = () => db;
  firestore.FieldValue = { serverTimestamp: () => 'timestamp' };
  const mocks = {
    'config/firebase.js': { headers: {}, initializeFirebaseAdmin() {}, getFirebaseAdminApp() {}, admin: { firestore, auth: () => ({ verifyIdToken: async () => ({ uid: 'athlete' }) }) } },
    'utils/sendBrevoTransactionalEmail.js': { buildEmailDedupeKey: () => 'dedupe', sendBrevoTransactionalEmail: async (message) => { emails.push(message); return { success: true }; } },
    'utils/sendTwilioSms.js': { sendTwilioSms: async () => { throw new Error('Unexpected SMS'); } },
  };
  for (const [file, exports] of Object.entries(mocks)) {
    const filename = path.join(root, 'netlify/functions', file);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  }
  const filename = path.join(root, 'netlify/functions/record-clinical-escalation.js');
  delete require.cache[filename];
  const { handler } = require(filename);
  const request = (extra = {}) => handler({ httpMethod: 'POST', headers: { authorization: 'Bearer test' }, body: JSON.stringify({ athleteUserId: 'athlete', teamId: 'team', tier: 3, signalSource: 'check-in', triggeredBySource: 'athlete', ...extra }) });
  return { request, writes, emails, queries };
}
test('PulseCheck handler activates crisis wall and returns 988 without clinician lookup or email', async () => {
  const f = fixture('pulsecheck', false);
  const response = await f.request({ productBrand: 'athleticmind' });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.supportRoute, 'hotline');
  assert.equal(body.hotlineResource.phone, '988');
  assert.equal(body.providerConfirmed, false);
  assert.equal(body.crisisWallActivated, true);
  assert.equal(f.emails.length, 0);
  assert.equal(f.queries.some(([name, field, value]) => name === 'pulsecheck-team-memberships' && field === 'role' && value === 'clinician'), false);
  assert.equal(f.writes.find(w => w.name === 'pulsecheck-clinical-escalations').data.productBrand, 'pulsecheck');
  assert.ok(f.writes.some(w => w.name === 'pulsecheck-athlete-safety-state' && w.data.crisisWallActive));
});
test('AthleticMind handler still pages clinician and ignores client brand and organization override', async () => {
  const f = fixture('athleticmind');
  const response = await f.request({ productBrand: 'pulsecheck', organizationId: 'forged' });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).deliveryStatus, 'clinician_paged');
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].toEmail, 'clinician@example.test');
  const record = f.writes.find(w => w.name === 'pulsecheck-clinical-escalations').data;
  assert.equal(record.organizationId, 'org');
  assert.equal(record.supportRoute, 'clinician');
});
test('AthleticMind still requires a configured clinician', async () => {
  const f = fixture('athleticmind', false);
  assert.equal((await f.request({ productBrand: 'pulsecheck' })).statusCode, 409);
  assert.equal(f.writes.length, 0);
});
