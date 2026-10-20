const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../../../netlify/functions/scheduled-curriculum-reminder.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const ledgerPath = 'pulsecheck-private-users/athlete/curriculum-reminder-deliveries/2026-10-18_evening';
const snapshot = (id, data) => ({ id, exists: data != null, data: () => data });
const plain = value => JSON.parse(JSON.stringify(value));

// Execute the production handler offline. No real Firebase import, credentials,
// network API, or notification service is exposed to the VM. The shared Map's
// synchronous check-and-set models Firestore create's atomic exists precondition.
function fixture(options = {}) {
  const store = options.store || new Map();
  const sends = [];
  const creates = [];
  const state = {
    date: '2026-10-18', time: '20:00',
    memberships: [{ userId: 'athlete', role: 'athlete', status: 'active' }],
    assignments: [
      { documentId: 'protocol-doc', id: 'stale-embedded-id', actionType: 'protocol', status: 'assigned', protocolLabel: '4-7-8 Relaxation Breathing' },
      { documentId: 'sim-doc', actionType: 'simulation', status: 'assigned', simName: 'Focus rep' },
    ],
    suppressed: false, target: { token: 'offline-token', platform: 'ios' },
    userExists: true, engineEnabled: true,
    ...options,
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [`${state.date}T${state.time}:00-04:00`])); }
    static now() { return new FixedDate().getTime(); }
  }
  const db = {
    collection(name) {
      if (name === 'pulsecheck-curriculum-config') return { doc(id) {
        assert.equal(id, 'current');
        return { get: async () => snapshot(id, { engineEnabled: state.engineEnabled, notificationCadence: { middayHourLocal: 12, eveningHourLocal: 20 } }) };
      } };
      if (name === 'users') return { doc(id) {
        assert.equal(id, 'athlete');
        return { get: async () => snapshot(id, state.userExists ? {} : null) };
      } };
      if (name === 'pulsecheck-team-memberships' || name === 'pulsecheck-daily-assignments') {
        const filters = [];
        let limit = Infinity;
        const query = {
          where(...filter) { filters.push(filter); return query; },
          limit(value) { limit = value; return query; },
          async get() {
            if (name === 'pulsecheck-team-memberships') {
              return { docs: state.memberships.filter(m => filters.every(([key, operator, value]) => operator === '==' && m[key] === value)).slice(0, limit).map((m, i) => snapshot(`member-${i}`, m)) };
            }
            assert.deepEqual(filters, [['athleteId', '==', 'athlete'], ['sourceDate', '==', state.date], ['assignedBy', '==', 'curriculum-engine']]);
            return { docs: state.assignments.slice(0, limit).map(a => snapshot(a.documentId, a)) };
          },
        };
        return query;
      }
      assert.equal(name, 'pulsecheck-private-users', 'delivery claims must use the server-only subtree');
      return { doc(userId) {
        assert.equal(userId, 'athlete');
        return { collection(child) {
          assert.equal(child, 'curriculum-reminder-deliveries');
          return { doc(id) {
            const key = `${name}/${userId}/${child}/${id}`;
            return {
              async create(value) {
                creates.push(key);
                if (state.claimError) throw Object.assign(new Error('claim unavailable'), { code: 14 });
                if (store.has(key)) throw Object.assign(new Error('already exists'), { code: state.duplicateCode || 6 });
                store.set(key, plain(value));
                // Model loss of the invocation immediately after durable commit.
                if (state.crashAfterClaim) throw new Error('invocation lost after claim commit');
              },
              async set(value, settings) {
                assert.equal(settings.merge, true);
                assert.ok(store.has(key), 'outcome cannot replace an absent claim');
                if (state.outcomeError) throw new Error('outcome write failed');
                store.set(key, { ...store.get(key), ...plain(value) });
              },
            };
          } };
        } };
      } };
    },
  };
  const modules = {
    './lib/organization-access': { organizationTeamIsActive: async () => { state.scopeChecks = (state.scopeChecks || 0) + 1; return state.organizationActive !== false && !(state.decommissionBeforeSend && state.scopeChecks > 1); } },
    './utils/getServiceAccount': { initAdmin: async () => {}, getFirestore: async () => db },
    './pulsecheck-notification-utils': {
      async loadPulseCheckNudgeSuppressionState(input) {
        assert.equal(input.athleteId, 'athlete');
        assert.equal(input.allowMembershipFallback, false);
        if (state.suppressionError) throw new Error('suppression unavailable');
        return { suppressed: state.suppressed };
      },
      async loadPulseCheckPushTarget(database, id) {
        assert.equal(database, db);
        assert.equal(id, 'athlete');
        return state.target;
      },
    },
    'firebase-admin': { messaging: () => ({ async send(message) {
      sends.push(plain(message));
      if (state.sendError) throw new Error('ambiguous messaging failure');
      return `offline-message-${sends.length}`;
    } }) },
  };
  function loadHandler() {
    const exports = {};
    const context = vm.createContext({
      exports, Date: FixedDate, console: { info() {}, error() {} },
      require(name) {
        assert.ok(Object.hasOwn(modules, name), `unmocked import prohibited: ${name}`);
        return modules[name];
      },
    });
    vm.runInContext(compiled, context, { filename: sourcePath, timeout: 1000 });
    return async () => JSON.parse((await exports.handler()).body);
  }
  return { state, store, sends, creates, run: loadHandler(), loadHandler };
}

test('five memberships, including removed, produce one reminder with the real assignment document id', async () => {
  const f = fixture({ memberships: [
    { userId: 'athlete', role: 'athlete', status: 'removed' },
    { userId: 'athlete', role: 'athlete', status: 'active' },
    { userId: 'athlete', role: 'athlete' },
    { userId: 'athlete', role: 'athlete', status: 'active' },
    { userId: 'athlete', role: 'athlete' },
  ] });
  const { summary } = await f.run();
  assert.equal(f.sends.length, 1);
  assert.equal(summary.skippedInactiveMembership, 1);
  assert.equal(summary.skippedDuplicateMembership, 3);
  assert.equal(summary.candidates, 1);
  assert.equal(summary.sentEvening, 1);
  assert.deepEqual(f.creates, [ledgerPath]);
  assert.equal(f.store.get(ledgerPath).assignmentId, 'protocol-doc');
  assert.equal(f.sends[0].data.assignmentId, 'protocol-doc');
  assert.equal(f.sends[0].notification.title, "Today's protocol");
  assert.equal(f.sends[0].apns.headers['apns-collapse-id'], 'curriculum-2026-10-18-evening');
  assert.equal(f.sends[0].data.reminderId, f.sends[0].apns.headers['apns-collapse-id']);
});

test('inactive statuses and revocation/archive/delete markers do not send or claim', async () => {
  const rows = ['removed', 'inactive', 'pending', 'revoked', 'archived', 'deleted'].map(status => ({ status }));
  rows.push({ status: 'active', revokedAt: '2026-10-01' }, { archivedAt: '2026-10-01' }, { deletedAt: '2026-10-01' }, { revoked: true });
  const f = fixture({ memberships: rows.map(row => ({ userId: 'athlete', role: 'athlete', ...row })) });
  const { summary } = await f.run();
  assert.equal(summary.skippedInactiveMembership, rows.length);
  assert.equal(f.sends.length, 0);
  assert.equal(f.creates.length, 0);
});

test('legacy membership without a status remains eligible', async () => {
  const f = fixture({ memberships: [{ userId: 'athlete', role: 'athlete' }] });
  await f.run();
  assert.equal(f.sends.length, 1);
});

for (const [time, expected] of [['19:30', 0], ['19:59', 0], ['20:00', 1], ['20:29', 1], ['20:30', 0]]) {
  test(`forward-only evening window at ${time} sends ${expected}`, async () => {
    const f = fixture({ time });
    await f.run();
    assert.equal(f.sends.length, expected);
    assert.equal(f.store.size, expected);
  });
}

test('sequential and concurrent repeats retain a single send', async () => {
  for (const concurrent of [false, true]) {
    const f = fixture();
    if (concurrent) await Promise.all([f.run(), f.run(), f.run()]);
    else { await f.run(); await f.run(); await f.run(); }
    assert.equal(f.sends.length, 1);
    assert.equal(f.store.size, 1);
  }
});

test('independent VM instances sharing Firestore claims cannot resend', async () => {
  const store = new Map();
  const first = fixture({ store });
  const second = fixture({ store, duplicateCode: 'already-exists' });
  await Promise.all([first.run(), second.run()]);
  await second.loadHandler()();
  assert.equal(first.sends.length + second.sends.length, 1);
  assert.equal(store.size, 1);
});

test('next local day and midday have independent allowances', async () => {
  const f = fixture({ time: '12:00' });
  await f.run();
  f.state.time = '20:00';
  await f.run();
  f.state.date = '2026-10-19';
  await f.run();
  assert.equal(f.sends.length, 3);
  assert.deepEqual(f.sends.map(m => m.data.cadence), ['midday', 'evening', 'evening']);
  assert.equal(f.store.size, 3);
  assert.equal(new Set(f.sends.map(m => m.data.reminderId)).size, 3);
});

test('changing an assignment cannot reset the same day cadence limit', async () => {
  const f = fixture();
  await f.run();
  f.state.assignments = [{ documentId: 'replacement-protocol', actionType: 'protocol', status: 'assigned', protocolLabel: 'Replacement' }];
  await f.run();
  assert.equal(f.sends.length, 1);
  assert.equal(f.store.size, 1);
});

test('ambiguous send failure preserves its claim and prevents retry delivery', async () => {
  const f = fixture({ sendError: true });
  const { summary } = await f.run();
  assert.equal(summary.failed, 1);
  assert.equal(f.store.get(ledgerPath).status, 'send_failed');
  f.state.sendError = false;
  await f.loadHandler()();
  assert.equal(f.sends.length, 1);
});

test('loss of invocation after claim commit cannot cause a later resend', async () => {
  const f = fixture({ crashAfterClaim: true });
  await f.run();
  assert.equal(f.store.get(ledgerPath).status, 'claimed');
  f.state.crashAfterClaim = false;
  await f.loadHandler()();
  assert.equal(f.sends.length, 0);
});

test('failed outcome recording still retains the durable claim', async () => {
  const f = fixture({ outcomeError: true });
  await f.run();
  assert.equal(f.store.get(ledgerPath).status, 'claimed');
  f.state.outcomeError = false;
  await f.loadHandler()();
  assert.equal(f.sends.length, 1);
});

test('claim-storage failure fails closed before messaging', async () => {
  const f = fixture({ claimError: true });
  const { summary } = await f.run();
  assert.equal(summary.failed, 1);
  assert.equal(f.sends.length, 0);
  assert.equal(f.store.size, 0);
});

for (const [reason, options] of [
  ['suppressed athlete', { suppressed: true }],
  ['suppression lookup rejection', { suppressionError: true }],
  ['ownership-aware target resolver rejects target', { target: null }],
  ['missing token', { target: { platform: 'ios' } }],
  ['missing user', { userExists: false }],
  ['completed and archived assignments', { assignments: [
    { documentId: 'completed', actionType: 'protocol', status: 'completed' },
    { documentId: 'archived', actionType: 'simulation', status: 'archived' },
  ] }],
  ['no midday simulation', { time: '12:00', assignments: [{ documentId: 'protocol', actionType: 'protocol', status: 'assigned' }] }],
  ['disabled engine', { engineEnabled: false }],
]) {
  test(`${reason} skips without claiming an allowance`, async () => {
    const f = fixture(options);
    await f.run();
    assert.equal(f.sends.length, 0);
    assert.equal(f.creates.length, 0);
  });
}

test('Android retains data-only messaging and the same reminder identity', async () => {
  const f = fixture({ target: { token: 'offline-android-token', platform: 'android' } });
  await f.run();
  assert.equal(f.sends.length, 1);
  assert.equal(f.sends[0].notification, undefined);
  assert.equal(f.sends[0].data.title, "Today's protocol");
  assert.equal(f.sends[0].data._pushPlatform, 'android');
  assert.equal(f.sends[0].data.reminderId, 'curriculum-2026-10-18-evening');
});

for (const options of [{ organizationActive: false }, { decommissionBeforeSend: true }]) {
  test(`decommissioned organization blocks curriculum delivery ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await f.run();
    assert.equal(f.sends.length, 0);
  });
}
