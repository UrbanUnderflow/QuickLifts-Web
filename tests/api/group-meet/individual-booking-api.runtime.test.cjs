const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
function transpile(relative, dependencies) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unmocked dependency: ${name}`);
  } }, { filename: relative });
  return exports;
}
const rules = transpile('src/lib/groupMeetBooking.ts', {});
const profile = { ...rules.DEFAULT_BOOKING_PROFILE, enabled: true };
function response() {
  return { statusCode: 200, headers: {}, payload: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }, end() { return this; } };
}
function runtime(route, overrides = {}) {
  const calls = [];
  const record = { name: 'Guest', status: 'scheduled', start: '2026-10-01T14:00:00.000Z', end: '2026-10-01T14:30:00.000Z' };
  const server = {
    requireBookingAdmin: async () => ({ email: 'admin@example.com' }),
    getBookingProfile: async () => profile,
    saveBookingProfile: async value => calls.push(['save', value]),
    requirePublicProfile: async slug => { calls.push(['public', slug]); return profile; },
    resolveCreateProfile: async (slug, body) => { calls.push(['resolve', slug, body]); return profile; },
    limitBookingRequests: async (_req, write) => { calls.push(['limit', write]); },
    listBookingSlots: async (...args) => { calls.push(['slots', ...args]); return []; },
    createIndividualBooking: async (...args) => { calls.push(['create', ...args]); return record; },
    findBooking: async token => { calls.push(['find', token]); return { ref: 'ref', record }; },
    safeBooking: value => value,
    refreshBookingMeetingLink: async (_ref, value) => value,
    listRescheduleSlots: async (...args) => { calls.push(['rescheduleSlots', ...args]); return []; },
    changeIndividualBooking: async (...args) => { calls.push(['change', ...args]); return record; },
    bookingApiError: (res, error) => res.status(error.status || 503).json({ error: error.message }),
    ...overrides,
  };
  const result = transpile(`src/pages/api/${route}.ts`, {
    '../../../../lib/groupMeetBooking': rules,
    '../../../../lib/groupMeetBookingServer': server,
    '../../../../lib/googleCalendar': { getGoogleCalendarSetupStatus: async () => ({ ready: true }) },
  });
  return { handler: result.default, calls };
}
const adminRoute = 'admin/group-meet/booking';
const publicRoute = 'group-meet/book/[slug]';
const privateRoute = 'group-meet/booking/[token]';

test('unauthorized admin PUT cannot validate or mutate settings', async () => {
  const { handler, calls } = runtime(adminRoute, { requireBookingAdmin: async () => null });
  const res = response();
  await handler({ method: 'PUT', headers: {}, body: null }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(calls.length, 0);
});

test('admin rejects invalid settings before saving', async () => {
  const { handler, calls } = runtime(adminRoute);
  const res = response();
  await handler({ method: 'PUT', headers: {}, body: { ...profile, durations: [] } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

for (const [route, allow] of [[adminRoute, 'GET, PUT'], [publicRoute, 'GET, POST'], [privateRoute, 'GET, POST']]) {
  test(`${route} rejects unsupported methods before side effects`, async () => {
    const { handler, calls } = runtime(route);
    const res = response();
    await handler({ method: 'DELETE', headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, allow);
    assert.equal(calls.length, 0);
  });
}

test('public GET exposes only public profile and ignores environment selectors', async () => {
  const { handler, calls } = runtime(publicRoute);
  const res = response();
  await handler({ method: 'GET', headers: { 'x-force-dev-firebase': 'true' }, query: { slug: 'tremaine', duration: '30', forceDevFirebase: 'true', calendarId: 'attacker' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.deepEqual(Object.keys(res.payload.profile).sort(), ['description', 'durations', 'name', 'slug', 'timezone']);
  const slots = calls.find(call => call[0] === 'slots');
  assert.equal(slots.length, 3);
  assert.equal(slots[1], profile);
  assert.equal(slots[2], 30);
});

test('public paused page errors preserve status and do not fetch slots', async () => {
  const { handler, calls } = runtime(publicRoute, { requirePublicProfile: async () => { throw new rules.BookingError('Unavailable', 404); } });
  const res = response();
  await handler({ method: 'GET', headers: {}, query: { slug: 'tremaine' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(calls.some(call => call[0] === 'slots'), false);
});

test('create retry uses reconciliation resolver when page is paused or renamed', async () => {
  const paused = { ...profile, enabled: false, slug: 'new-slug' };
  const body = { requestId: 'existing-idempotency-key', name: 'Guest' };
  const { handler, calls } = runtime(publicRoute, {
    requirePublicProfile: async () => { throw new Error('New bookings are paused'); },
    resolveCreateProfile: async (slug, input) => { assert.equal(slug, 'old-slug'); assert.equal(input, body); return paused; },
  });
  const res = response();
  await handler({ method: 'POST', headers: {}, query: { slug: 'old-slug' }, body }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.find(call => call[0] === 'create')[1], paused);
});

test('private GET is uncached and refreshes confirmation without creating a booking', async () => {
  let refreshed = false;
  const { handler, calls } = runtime(privateRoute, { refreshBookingMeetingLink: async (_ref, record) => { refreshed = true; return { ...record, meetLink: 'https://meet.google.com/example' }; } });
  const res = response();
  await handler({ method: 'GET', headers: {}, query: { token: 'private-token' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.equal(refreshed, true);
  assert.equal(res.payload.booking.meetLink, 'https://meet.google.com/example');
  assert.equal(calls.some(call => ['create', 'change'].includes(call[0])), false);
});

test('private reschedule availability uses token-scoped slots', async () => {
  const { handler, calls } = runtime(privateRoute);
  const res = response();
  await handler({ method: 'GET', headers: {}, query: { token: 'private-token', slots: '1', duration: '60' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.find(call => call[0] === 'rescheduleSlots'), ['rescheduleSlots', 'private-token', 60]);
  assert.equal(calls.some(call => call[0] === 'find'), false);
});

test('rate-limit rejection stops public create before profile or provider work', async () => {
  const { handler, calls } = runtime(publicRoute, { limitBookingRequests: async () => { throw new rules.BookingError('Too many requests', 429); } });
  const res = response();
  await handler({ method: 'POST', headers: {}, query: { slug: 'tremaine' }, body: {} }, res);
  assert.equal(res.statusCode, 429);
  assert.equal(calls.length, 0);
});
