const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { act } = React;

const sourcePath = path.resolve(__dirname, '../../src/components/group-meet/GroupMeetInviteAvailability.tsx');
const slot = { date: '2026-10-23', startMinutes: 600, endMinutes: 660 };
const connected = { provider: 'google', connected: true, status: 'connected' };

async function fixture(t, options = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fixture.invalid/admin/groupMeet' });
  const prior = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const state = {
    requests: [], busy: [], finishCalls: 0, closeCalls: 0, popupCalls: [], timers: new Map(),
    saveFailure: false, delaySave: false, finishFailure: false, popupBlocked: false,
    suggestions: [{ ...slot, source: 'google_calendar' }],
    invite: {
      token: 'host-token', name: 'Host', email: 'host@example.test', participantType: 'host',
      shareUrl: 'https://fixture.invalid/group-meet/host-token', responseSubmittedAt: null,
      availabilityEntries: [], peerAvailability: [], calendarImport: options.disconnected ? null : connected,
      deadlinePassed: false,
      request: { id: 'request-1', title: 'October meeting', targetMonth: '2026-10', deadlineAt: '2026-10-24T21:00:00Z', timezone: 'America/New_York', meetingDurationMinutes: 60, status: 'draft' },
    },
  };
  const response = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => JSON.parse(JSON.stringify(body)) });
  const fetch = async (url, init = {}) => {
    state.requests.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    if (url.endsWith('/connect/start')) return response({ url: 'https://accounts.google.com/synthetic-authorization' });
    if (url.endsWith('/import')) return response({ suggestions: state.suggestions, calendarImport: connected });
    if (url === '/api/group-meet/host-token' && init.method === 'POST') {
      if (state.delaySave) await new Promise(resolve => { state.releaseSave = resolve; });
      if (state.saveFailure) return response({ error: 'Availability could not be saved.' }, false);
      state.invite.availabilityEntries = JSON.parse(init.body).availabilityEntries;
      state.invite.responseSubmittedAt = '2026-10-19T12:00:00Z';
      return response({ invite: state.invite });
    }
    if (url === '/api/group-meet/host-token' && !init.method) return response({ invite: state.invite });
    throw Error(`Unexpected request: ${init.method || 'GET'} ${url}`);
  };
  dom.window.open = (...args) => {
    state.popupCalls.push(args);
    if (state.popupBlocked) return null;
    state.popup = { closed: false, location: { href: 'about:blank' }, close() { this.closed = true; } };
    return state.popup;
  };
  dom.window.setInterval = callback => { const id = state.timers.size + 1; state.timers.set(id, callback); return id; };
  dom.window.clearInterval = id => state.timers.delete(id);
  const picker = props => React.createElement('section', { 'aria-label': 'Availability picker' },
    React.createElement('output', { 'data-testid': 'slots' }, JSON.stringify(props.availabilityEntries)),
    React.createElement('button', { disabled: props.disabled, onClick: () => props.onChange([slot]) }, 'Add manual time'));
  const mocks = {
    react: React, 'next/head': () => null,
    'next/router': { useRouter: () => ({ isReady: true, pathname: '/admin/groupMeet', query: {}, replace: async () => {} }) },
    'date-fns': require('date-fns'),
    'lucide-react': { Calendar: () => null, CheckCircle2: () => null, Loader2: () => null },
    './GroupMeetAvailabilityPicker': picker,
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    module, exports: module.exports, Date, Error, console, window: dom.window, fetch,
    require(name) { if (!(name in mocks)) throw Error(`Unexpected dependency: ${name}`); return mocks[name]; },
  }, { filename: sourcePath });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  await act(async () => root.render(React.createElement(module.exports.default, {
    token: 'host-token',
    onFinish: async () => { state.finishCalls++; if (state.finishFailure) throw Error('Request refresh failed. Try again.'); },
    onClose: () => state.closeCalls++, onBusyChange: busy => state.busy.push(busy),
  })));
  const document = dom.window.document;
  const button = name => [...document.querySelectorAll('button')].find(element => element.textContent === name);
  const click = async name => { assert.ok(button(name), `Missing button: ${name}`); await act(async () => button(name).click()); };
  const slots = () => JSON.parse(document.querySelector('[data-testid="slots"]').textContent);
  const message = async overrides => {
    const event = new dom.window.MessageEvent('message', {
      origin: dom.window.location.origin, source: state.popup,
      data: { type: 'group-meet-calendar-result', token: 'host-token', message: { type: 'success', text: 'Google Calendar connected.' } },
      ...overrides,
    });
    await act(async () => dom.window.dispatchEvent(event));
  };
  return { state, document, button, click, slots, message };
}

test('host import persists availability before Finish can refresh the request', async t => {
  const { state, button, click, slots } = await fixture(t);
  assert.equal(button('Finish').disabled, true);
  state.delaySave = true;
  await click('Import availability');
  assert.equal(button('Finish').disabled, true);
  assert.equal(button('Close').disabled, true);
  assert.equal(button('Add manual time').disabled, true);
  assert.equal(state.finishCalls, 0);
  assert.equal(state.busy.at(-1), true);
  await act(async () => state.releaseSave());
  assert.deepEqual(slots(), [slot]);
  const saved = state.requests.find(request => request.url === '/api/group-meet/host-token' && request.method === 'POST');
  assert.deepEqual(saved.body, { availabilityEntries: [slot] });
  assert.equal(button('Finish').disabled, false);
  await click('Finish');
  assert.equal(state.finishCalls, 1);
  assert.equal(state.busy.at(-1), false);
});

test('failed import persistence rolls back displayed slots and keeps Finish disabled', async t => {
  const { state, document, button, click, slots } = await fixture(t);
  state.saveFailure = true;
  await click('Import availability');
  assert.deepEqual(slots(), []);
  assert.deepEqual(state.invite.availabilityEntries, []);
  assert.match(document.body.textContent, /Availability could not be saved/);
  assert.equal(button('Finish').disabled, true);
  await click('Finish');
  assert.equal(state.finishCalls, 0);
  assert.equal(state.busy.at(-1), false);
});

test('an empty import leaves host readiness incomplete without creating a response', async t => {
  const { state, document, button, click, slots } = await fixture(t);
  state.suggestions = [];
  await click('Import availability');
  assert.match(document.body.textContent, /No available times were found/);
  assert.deepEqual(slots(), []);
  assert.equal(button('Finish').disabled, true);
  assert.equal(state.requests.filter(request => request.url === '/api/group-meet/host-token' && request.method === 'POST').length, 0);
});

test('manual availability uses the same saved readiness and Finish flow', async t => {
  const { state, button, click } = await fixture(t, { disconnected: true });
  await click('Add manual time');
  assert.deepEqual(state.invite.availabilityEntries, [slot]);
  assert.equal(button('Finish').disabled, false);
  await click('Finish');
  assert.equal(state.finishCalls, 1);
});

test('Finish refresh failure preserves the form and supports retry', async t => {
  const { state, document, button, click, slots } = await fixture(t);
  await click('Import availability');
  state.finishFailure = true;
  await click('Finish');
  assert.match(document.body.textContent, /Request refresh failed/);
  assert.deepEqual(slots(), [slot]);
  assert.equal(button('Finish').disabled, false);
  assert.equal(state.closeCalls, 0);
  state.finishFailure = false;
  await click('Finish');
  assert.equal(state.finishCalls, 2);
});

test('a blocked Google popup shows recovery guidance without starting authorization', async t => {
  const { state, document, button, click } = await fixture(t, { disconnected: true });
  state.popupBlocked = true;
  await click('Connect Google Calendar');
  assert.match(document.body.textContent, /Allow the Google sign-in pop-up/);
  assert.equal(state.requests.length, 1);
  assert.equal(button('Connect Google Calendar').disabled, false);
  assert.equal(state.busy.at(-1), false);
});

test('OAuth messages require the expected origin, popup, and invite token', async t => {
  const { state, button, click, message } = await fixture(t, { disconnected: true });
  await click('Connect Google Calendar');
  assert.equal(state.popup.location.href, 'https://accounts.google.com/synthetic-authorization');
  assert.equal(button('Close').disabled, true);
  const requestsBeforeCallback = state.requests.length;
  await message({ origin: 'https://untrusted.invalid' });
  await message({ source: null });
  await message({ data: { type: 'group-meet-calendar-result', token: 'different-invite', message: { type: 'success', text: 'Spoofed result' } } });
  assert.equal(state.requests.length, requestsBeforeCallback);
  assert.equal(state.popup.closed, false);
  assert.equal(button('Close').disabled, true);
  state.invite.calendarImport = connected;
  await message();
  assert.equal(state.popup.closed, true);
  assert.equal(state.requests.length, requestsBeforeCallback + 1);
  assert.equal(button('Import availability').disabled, false);
  assert.equal(button('Finish').disabled, true);
  assert.equal(state.busy.at(-1), false);
});

test('closing Google authorization releases busy state and retains the availability form', async t => {
  const { state, button, click, slots } = await fixture(t, { disconnected: true });
  await click('Connect Google Calendar');
  state.popup.closed = true;
  await act(async () => { for (const tick of [...state.timers.values()]) tick(); });
  assert.equal(button('Connect Google Calendar').disabled, false);
  assert.equal(button('Close').disabled, false);
  assert.equal(button('Finish').disabled, true);
  assert.deepEqual(slots(), []);
  assert.equal(state.busy.at(-1), false);
});

test('Google authorization denial shows the callback error and allows reconnecting', async t => {
  const { state, document, button, click, message } = await fixture(t, { disconnected: true });
  await click('Connect Google Calendar');
  await message({ data: { type: 'group-meet-calendar-result', token: 'host-token', message: { type: 'error', text: 'Google Calendar connection was canceled.' } } });
  assert.match(document.body.textContent, /Google Calendar connection was canceled/);
  assert.equal(state.popup.closed, true);
  assert.equal(button('Connect Google Calendar').disabled, false);
  assert.equal(button('Finish').disabled, true);
});
