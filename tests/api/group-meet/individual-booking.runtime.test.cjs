const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '../../../src/lib');
const transpile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const ruleSource = transpile('groupMeetBooking.ts');
const serverSource = transpile('groupMeetBookingServer.ts');
const clone = value => value === undefined ? undefined : structuredClone(value);

function setup(options = {}) {
  let now = Date.parse('2026-09-28T08:00:00Z');
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const profile = { enabled: true, slug: 'host', name: 'Host', description: '', timezone: 'UTC',
    durations: [15, 30, 60], days: [1,2,3,4,5], startMinutes: 540, endMinutes: 1020,
    bufferMinutes: 15, minNoticeHours: 0, horizonDays: 7 };
  const store = new Map([['groupMeetBookingSettings/host', clone(profile)]]);
  if (options.admin) store.set('admin/host@example.test', {});
  const authChecks = [];
  const events = new Map();
  const calls = [];
  const snapshot = key => ({ id: key.split('/').at(-1), ref: ref(key), exists: store.has(key), data: () => clone(store.get(key)) });
  const ref = key => ({ key, id: key.split('/').at(-1), get: async () => snapshot(key) });
  const query = (name, filters = [], max = Infinity) => ({
    where: (field, op, value) => query(name, [...filters, { field, op, value }], max),
    limit: n => query(name, filters, n),
    doc: id => ref(`${name}/${id}`),
    get: async () => {
      const docs = [...store.keys()].filter(key => key.startsWith(`${name}/`)).map(snapshot)
        .filter(doc => filters.every(f => f.op === '==' ? doc.data()[f.field] === f.value : doc.data()[f.field] >= f.value)).slice(0, max);
      return { docs, empty: docs.length === 0 };
    },
  });
  let tail = Promise.resolve();
  const db = { doc: ref, collection: query, runTransaction: callback => {
    const result = tail.then(async () => {
      const writes = [];
      const value = await callback({ get: target => target.get(),
        set: (r, data) => writes.push(() => store.set(r.key, clone(data))),
        update: (r, data) => writes.push(() => store.set(r.key, { ...store.get(r.key), ...clone(data) })),
        delete: r => writes.push(() => store.delete(r.key)),
      });
      writes.forEach(write => write());
      return value;
    });
    tail = result.catch(() => {});
    return result;
  } };
  const response = (status, data = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
  let lostResponse = options.lostResponse;
  const fetch = async (url, args) => {
    const body = args.body ? JSON.parse(args.body) : undefined;
    calls.push({ url, method: args.method, body });
    if (url.endsWith('/freeBusy')) {
      if (options.freeBusyResponse) return response(options.freeBusyStatus || 200, options.freeBusyResponse);
      return response(200, { calendars: { primary: { busy: options.busy || [] } } });
    }
    const id = decodeURIComponent(new URL(url).pathname.split('/events/')[1] || '');
    if (args.method === 'GET' && new URL(url).pathname.endsWith('/events'))
      return response(200, { items: [...events.values(), ...(options.extraEvents || [])], timeZone: options.calendarTimezone || 'UTC' });
    if (args.method === 'GET') return events.has(id) ? response(200, events.get(id)) : response(404);
    if (options.writeStatus) return response(options.writeStatus);
    if (args.method === 'DELETE') { events.delete(id); return response(204); }
    const event = { ...(events.get(id) || {}), ...body, id: body.id || id, hangoutLink: 'https://meet.google.com/test-room' };
    events.set(event.id, event);
    if (lostResponse) { lostResponse = false; throw Error('connection lost after provider accepted event'); }
    return response(200, event);
  };
  const rules = { exports: {} };
  vm.runInNewContext(ruleSource, { module: rules, exports: rules.exports, Date: Clock, Intl });
  const server = { exports: {} };
  vm.runInNewContext(serverSource, { module: server, exports: server.exports, Date: Clock, Intl, fetch,
    AbortSignal, URLSearchParams, process: { env: options.env || {} }, console, require: name => {
      if (name === './groupMeetBooking') return rules.exports;
      if (name === './firebase-admin') return { getFirebaseAdminApp: dev => ({ firestore: () => db,
        auth: () => ({ verifyIdToken: async (token, revoked) => {
          authChecks.push({ dev, token, revoked });
          if (options.invalidAuth) throw Error('invalid token');
          return { email: 'host@example.test' };
        } }),
      }) };
      if (name === './googleCalendar') return { getGoogleCalendarId: () => 'primary', getGoogleCalendarAuth: async () => ({ accessToken: 'test-token' }) };
      return require(name);
    },
  });
  return { api: server.exports, profile, store, calls, events, authChecks, advance: ms => now += ms,
    input: (overrides = {}) => ({ name: 'Guest', email: 'guest@example.test', start: '2026-09-28T10:00:00.000Z', duration: 30, requestId: 'request-0000000000000001', ...overrides }) };
}
const errorStatus = status => error => error.status === status;
const calendarWrites = s => s.calls.filter(c => /\/events/.test(c.url) && c.method !== 'GET');

test('concurrent requests with different durations cannot reserve the same time', async () => {
  const s = setup();
  const results = await Promise.allSettled([
    s.api.createIndividualBooking(s.profile, s.input()),
    s.api.createIndividualBooking(s.profile, s.input({ duration: 60, requestId: 'request-0000000000000002' })),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal(s.events.size, 1);
});

test('idempotent retries reuse event and token and reject altered request payloads', async () => {
  const s = setup();
  const first = await s.api.createIndividualBooking(s.profile, s.input());
  const second = await s.api.createIndividualBooking(s.profile, s.input());
  assert.equal(second.managementToken, first.managementToken);
  assert.equal(calendarWrites(s).length, 1);
  assert.match(calendarWrites(s)[0].body.id, /^b[a-f0-9]{64}$/);
  assert.equal(calendarWrites(s)[0].body.attendees[0].email, 'guest@example.test');
  assert.match(calendarWrites(s)[0].url, /sendUpdates=all/);
  await assert.rejects(s.api.createIndividualBooking(s.profile, s.input({ duration: 60 })), errorStatus(409));
});

test('uncertain provider success is reconciled without issuing another insert', async () => {
  const s = setup({ lostResponse: true });
  await assert.rejects(s.api.createIndividualBooking(s.profile, s.input()), errorStatus(503));
  assert.equal(s.events.size, 1);
  const saved = [...s.store.entries()].find(([key]) => key.startsWith('groupMeetBookings/'))[1];
  assert.equal(saved.status, 'pending');
  assert.equal(saved.operation.leaseUntil, 0);
  const available = await s.api.listBookingSlots(s.profile, 30);
  assert.ok(!available.some(slot => slot.start === s.input().start));
  const recovered = await s.api.createIndividualBooking(s.profile, s.input());
  assert.equal(recovered.status, 'scheduled');
  assert.equal(recovered.managementToken, saved.managementToken);
  assert.equal(calendarWrites(s).length, 1);
});

test('cancellation is idempotent and cancelled meetings cannot reschedule', async () => {
  const s = setup();
  const booking = await s.api.createIndividualBooking(s.profile, s.input());
  assert.equal((await s.api.changeIndividualBooking(booking.managementToken, { action: 'cancel' })).status, 'cancelled');
  await s.api.changeIndividualBooking(booking.managementToken, { action: 'cancel' });
  assert.equal(s.calls.filter(c => c.method === 'DELETE').length, 1);
  assert.equal(s.events.size, 0);
  await assert.rejects(s.api.changeIndividualBooking(booking.managementToken, { action: 'reschedule', start: '2026-09-28T12:00:00.000Z', duration: 30 }), errorStatus(409));
});

test('past meetings cannot be cancelled and invalid management links reveal no record', async () => {
  const s = setup();
  const booking = await s.api.createIndividualBooking(s.profile, s.input());
  s.advance(3 * 3600000);
  await assert.rejects(s.api.changeIndividualBooking(booking.managementToken, { action: 'cancel' }), errorStatus(409));
  await assert.rejects(s.api.findBooking('bad-token'), errorStatus(404));
  await assert.rejects(s.api.findBooking('a'.repeat(64)), errorStatus(404));
  assert.equal(s.events.size, 1);
});

test('rescheduling updates the existing event and frees the original reservation', async () => {
  const s = setup();
  const booking = await s.api.createIndividualBooking(s.profile, s.input());
  const eventId = [...s.events.keys()][0];
  const changed = await s.api.changeIndividualBooking(booking.managementToken,
    { action: 'reschedule', start: '2026-09-28T12:00:00.000Z', duration: 60 });
  assert.equal(changed.start, '2026-09-28T12:00:00.000Z');
  assert.equal(changed.end, '2026-09-28T13:00:00.000Z');
  assert.equal(changed.managementToken, booking.managementToken);
  assert.equal(s.events.size, 1);
  assert.equal(s.events.get(eventId).start.dateTime, changed.start);
  assert.equal(s.calls.filter(c => c.method === 'PATCH').length, 1);
  const available = await s.api.listBookingSlots(s.profile, 30);
  assert.ok(available.some(slot => slot.start === booking.start));
  assert.ok(!available.some(slot => slot.start === changed.start));
});

test('disabled booking profile blocks new reservations but still allows cancellation', async () => {
  const s = setup();
  const booking = await s.api.createIndividualBooking(s.profile, s.input());
  await s.api.saveBookingProfile({ ...s.profile, enabled: false });
  await assert.rejects(s.api.requirePublicProfile('host'), errorStatus(404));
  await assert.rejects(s.api.createIndividualBooking(s.profile, s.input({ start: '2026-09-28T12:00:00.000Z', requestId: 'request-0000000000000002' })), errorStatus(409));
  await assert.rejects(s.api.changeIndividualBooking(booking.managementToken, { action: 'reschedule', start: '2026-09-28T12:00:00.000Z', duration: 30 }), errorStatus(409));
  assert.equal((await s.api.changeIndividualBooking(booking.managementToken, { action: 'cancel' })).status, 'cancelled');
});

for (const [name, freeBusyResponse] of [
  ['missing calendar', {}], ['calendar error', { calendars: { primary: { errors: [{ reason: 'notFound' }], busy: [] } } }],
  ['invalid date', { calendars: { primary: { busy: [{ start: 'bad', end: 'bad' }] } } }],
]) test(`calendar availability fails closed for ${name}`, async () => {
  const s = setup({ freeBusyResponse });
  await assert.rejects(s.api.listBookingSlots(s.profile, 30), errorStatus(503));
  await assert.rejects(s.api.createIndividualBooking(s.profile, s.input()), errorStatus(503));
  assert.equal(calendarWrites(s).length, 0);
});

test('provider busy conflict rejects booking and releases its reservation', async () => {
  const s = setup({ busy: [{ start: '2026-09-28T10:00:00Z', end: '2026-09-28T11:00:00Z' }] });
  await assert.rejects(s.api.createIndividualBooking(s.profile, s.input()), errorStatus(409));
  assert.equal([...s.store.keys()].filter(key => key.startsWith('groupMeetBookings/')).length, 0);
  assert.equal(calendarWrites(s).length, 0);
});

test('persistent write throttle enforces the limit independently from reads and stores no raw IP', async () => {
  const s = setup();
  const req = { headers: { 'x-nf-client-connection-ip': '192.0.2.55' }, socket: { remoteAddress: '127.0.0.1' } };
  for (let n = 0; n < 20; n++) await s.api.limitBookingRequests(req, true);
  await assert.rejects(s.api.limitBookingRequests(req, true), errorStatus(429));
  await s.api.limitBookingRequests(req, false);
  assert.ok(!JSON.stringify([...s.store]).includes('192.0.2.55'));
  s.advance(600000);
  await s.api.limitBookingRequests(req, true);
});

test('rescheduling can overlap its own event and ignores transparent, cancelled, and declined events', async () => {
  const event = { start: { dateTime: '2026-09-28T10:00:00Z' }, end: { dateTime: '2026-09-28T11:00:00Z' } };
  const s = setup({ extraEvents: [
    { ...event, id: 'transparent', transparency: 'transparent' },
    { ...event, id: 'cancelled', status: 'cancelled' },
    { ...event, id: 'declined', attendees: [{ self: true, responseStatus: 'declined' }] },
  ] });
  const booking = await s.api.createIndividualBooking(s.profile, s.input());
  const available = await s.api.listRescheduleSlots(booking.managementToken, 30);
  assert.ok(available.some(slot => slot.start === '2026-09-28T10:15:00.000Z'));
  const result = await s.api.changeIndividualBooking(booking.managementToken,
    { action: 'reschedule', start: '2026-09-28T10:15:00.000Z', duration: 30 });
  assert.equal(result.start, '2026-09-28T10:15:00.000Z');
});

for (const [name, event] of [
  ['another timed event', { id: 'other', start: { dateTime: '2026-09-28T10:15:00Z' }, end: { dateTime: '2026-09-28T11:00:00Z' } }],
  ['an all-day event', { id: 'all-day', start: { date: '2026-09-28' }, end: { date: '2026-09-29' } }],
]) test(`rescheduling retains the busy block from ${name}`, async () => {
  const s = setup({ extraEvents: [event] });
  const booking = await s.api.createIndividualBooking(s.profile, s.input());
  const available = await s.api.listRescheduleSlots(booking.managementToken, 30);
  assert.ok(!available.some(slot => slot.start === '2026-09-28T10:15:00.000Z'));
  await assert.rejects(s.api.changeIndividualBooking(booking.managementToken,
    { action: 'reschedule', start: '2026-09-28T10:15:00.000Z', duration: 30 }), errorStatus(409));
  assert.equal(s.calls.filter(c => c.method === 'PATCH').length, 0);
});

test('definitive provider rejection releases the reservation for a corrected new request', async () => {
  const options = { writeStatus: 400 };
  const s = setup(options);
  await assert.rejects(s.api.createIndividualBooking(s.profile, s.input()), errorStatus(503));
  assert.equal([...s.store.keys()].filter(key => key.startsWith('groupMeetBookings/')).length, 0);
  options.writeStatus = 0;
  assert.equal((await s.api.createIndividualBooking(s.profile, s.input())).status, 'scheduled');
});

test('saved request recovers through its original slug after pause and rename', async () => {
  const s = setup({ lostResponse: true });
  await assert.rejects(s.api.createIndividualBooking(s.profile, s.input()), errorStatus(503));
  await s.api.saveBookingProfile({ ...s.profile, enabled: false, slug: 'renamed-host' });
  const resolved = await s.api.resolveCreateProfile('host', s.input());
  const result = await s.api.createIndividualBooking(resolved, s.input());
  assert.equal(result.status, 'scheduled');
  assert.equal(calendarWrites(s).length, 1);
  await assert.rejects(s.api.resolveCreateProfile('host', s.input({ requestId: 'request-0000000000000002' })), errorStatus(404));
  await assert.rejects(s.api.resolveCreateProfile('unrelated-host', s.input()), errorStatus(404));
});

test('management retry reconciles a pending write and becomes an idempotent no-op', async () => {
  const s = setup({ lostResponse: true });
  await assert.rejects(s.api.createIndividualBooking(s.profile, s.input()), errorStatus(503));
  const pending = [...s.store.entries()].find(([key]) => key.startsWith('groupMeetBookings/'))[1];
  assert.equal(s.api.safeBooking(pending).pendingAction.action, 'create');
  const result = await s.api.changeIndividualBooking(pending.managementToken, { action: 'retry' });
  assert.equal(result.status, 'scheduled');
  assert.equal(result.pendingAction, null);
  await s.api.changeIndividualBooking(pending.managementToken, { action: 'retry' });
  assert.equal(calendarWrites(s).length, 1);
});

test('admin authorization rejects missing, invalid, non-admin, and dev-mode identities', async () => {
  for (const headers of [ {}, { authorization: 'Basic token' },
    { authorization: 'Bearer token', 'x-force-dev-firebase': 'true' },
    { authorization: 'Bearer token', 'x-force-dev-firebase': '1' },
    { authorization: 'Bearer token', 'x-pulsecheck-firebase-mode': 'dev' },
    { authorization: 'Bearer token', 'x-pulsecheck-dev-firebase': 'true' },
  ]) {
    const s = setup({ admin: true });
    assert.equal(await s.api.requireBookingAdmin({ headers }), null);
    assert.equal(s.authChecks.length, 0);
  }
  for (const options of [{ invalidAuth: true, admin: true }, { admin: false }]) {
    const s = setup(options);
    assert.equal(await s.api.requireBookingAdmin({ headers: { authorization: 'Bearer token', host: 'localhost:3000' } }), null);
  }
  const s = setup({ admin: true });
  assert.equal((await s.api.requireBookingAdmin({ headers: { authorization: 'Bearer token' } })).email, 'host@example.test');
  assert.deepEqual(s.authChecks, [{ dev: false, token: 'token', revoked: true }]);
});

test('E2E environment refuses all real calendar requests before contacting Google', async () => {
  const s = setup({ env: { NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE: 'true' } });
  await assert.rejects(s.api.listBookingSlots(s.profile, 30), errorStatus(503));
  assert.equal(s.calls.length, 0);
});


test('confirmation and private management expose the persisted invite email without adding it to public profile', async () => {
  const s = setup();
  const input = s.input({ email: 'Guest.Name@Example.Test' });
  const confirmed = await s.api.createIndividualBooking(s.profile, input);
  const { record } = await s.api.findBooking(confirmed.managementToken);
  assert.equal(record.email, 'guest.name@example.test');
  assert.equal(confirmed.email, record.email);
  assert.equal(s.api.safeBooking(record).email, record.email);
  assert.equal((await s.api.createIndividualBooking(s.profile, input)).email, record.email);
  assert.equal(calendarWrites(s)[0].body.attendees[0].email, record.email);
  assert.equal(Object.hasOwn(s.api.safeBooking(record), 'calendarId'), false);
  assert.equal(Object.hasOwn(s.api.safeBooking(record), 'eventId'), false);
  const rules = { exports: {} };
  vm.runInNewContext(ruleSource, { module: rules, exports: rules.exports, Date, Intl });
  const publicProfile = rules.exports.publicBookingProfile({ ...s.profile, email: record.email });
  assert.equal(Object.hasOwn(publicProfile, 'email'), false);
  assert.equal(Object.hasOwn(publicProfile, 'managementToken'), false);
});
