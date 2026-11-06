const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { act } = React;

const preferences = (overrides = {}) => ({ enabled: true, explicitConsentRecorded: false, suppressed: false,
  phoneLast4: '0123', version: 'team-texts-fixture-v2', text: 'Optional team texts. Reply STOP to opt out.', ...overrides });
const token = (provider = 'phone') => ({ token: 'fixture-token', signInProvider: provider, claims: { auth_time: Date.now() / 1000 } });

async function harness(t, { teamId = 'team-a', data = preferences(), provider = 'phone', signedIn = true, fetcher, getToken } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://fixture.invalid/PulseCheck/text-preferences' });
  const prior = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const requests = [];
  const user = { uid: 'athlete-a', phoneNumber: '+12025550123', getIdTokenResult: getToken || (async () => token(provider)) };
  const auth = { currentUser: signedIn ? user : null };
  const router = { query: teamId ? { teamId } : {}, isReady: true };
  let notifyAuth;
  const module = { exports: {} };
  const mocks = {
    react: React,
    'next/router': { useRouter: () => router },
    'next/head': () => null,
    'next/link': ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
    'firebase/auth': { onAuthStateChanged: (_auth, callback) => { notifyAuth = callback; callback(auth.currentUser); return () => {}; } },
    '../../api/firebase/config': { auth, getFirebaseModeRequestHeaders: () => ({}) },
    '../../components/auth/PhoneSignIn': ({ mode }) => React.createElement('div', { 'data-phone-verification': mode }, 'Phone verification fixture'),
    '../../lib/coach-communications/consent-copy': { SMS_CONSENT_TEXT: 'Public optional team-text disclosure.' },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/pages/PulseCheck/text-preferences.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: name => mocks[name], Date, Error, encodeURIComponent,
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (fetcher) return fetcher(url, options);
      const result = options.method === 'POST' ? preferences({ explicitConsentRecorded: JSON.parse(options.body).accepted,
        enabled: JSON.parse(options.body).accepted }) : teamId ? data : { teams: [{ teamId: 'team-a', displayName: 'Track & Field' }] };
      return { ok: true, json: async () => result };
    },
  });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root'));
  const render = async () => act(async () => root.render(React.createElement(module.exports.default)));
  t.after(async () => {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  await render();
  return { dom, requests, auth, router, render,
    button: text => [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === text),
    changeUser: async next => act(async () => { auth.currentUser = next; notifyAuth(next); }),
  };
}

test('delivery eligibility does not preselect permission; explicit acceptance submits displayed version', async t => {
  const h = await harness(t);
  const checkbox = h.dom.window.document.querySelector('input[type=checkbox]');
  assert.ok(checkbox);
  assert.equal(checkbox.checked, false);
  assert.equal(h.button('Save texting permission').disabled, true);
  assert.match(h.dom.window.document.body.textContent, /have not saved permission/);
  assert.equal(h.requests.filter(request => request.method === 'POST').length, 0);
  await act(async () => checkbox.click());
  assert.equal(h.button('Save texting permission').disabled, false);
  await act(async () => h.button('Save texting permission').click());
  const posts = h.requests.filter(request => request.method === 'POST');
  assert.equal(posts.length, 1);
  assert.deepEqual(JSON.parse(posts[0].body), { accepted: true, version: 'team-texts-fixture-v2' });
  assert.match(posts[0].url, /teamId=team-a$/);
  assert.match(h.dom.window.document.body.textContent, /Your permission for team texts is saved/);
});

test('STOP hides acceptance and phone verification controls', async t => {
  const h = await harness(t, { data: preferences({ suppressed: true, enabled: false }), provider: 'google.com' });
  assert.match(h.dom.window.document.body.textContent, /previous STOP is active/);
  assert.equal(h.dom.window.document.querySelector('input[type=checkbox]'), null);
  assert.equal(h.button('Save texting permission'), undefined);
  assert.equal(h.dom.window.document.querySelector('[data-phone-verification]'), null);
  assert.equal(h.requests.filter(request => request.method === 'POST').length, 0);
});

test('active team choices link to team-specific preferences without saving consent', async t => {
  const h = await harness(t, { teamId: '' });
  assert.equal(h.requests[0].url, '/api/pulsecheck/text-preferences');
  const link = [...h.dom.window.document.querySelectorAll('a')].find(a => a.textContent === 'Track & Field');
  assert.equal(link.getAttribute('href'), '/PulseCheck/text-preferences?teamId=team-a');
  assert.equal(h.dom.window.document.querySelector('input[type=checkbox]'), null);
  assert.equal(h.requests.filter(request => request.method === 'POST').length, 0);
});

test('withdrawal works without phone verification while new permission requires it', async t => {
  const h = await harness(t, { provider: 'google.com' });
  await act(async () => h.dom.window.document.querySelector('input[type=checkbox]').click());
  assert.equal(h.button('Save texting permission').disabled, true);
  assert.equal(h.dom.window.document.querySelector('[data-phone-verification]').getAttribute('data-phone-verification'), 'verify');
  assert.equal(h.button('Turn team texts off').disabled, false);
  await act(async () => h.button('Turn team texts off').click());
  const post = h.requests.find(request => request.method === 'POST');
  assert.deepEqual(JSON.parse(post.body), { accepted: false, version: 'team-texts-fixture-v2' });
  assert.match(h.dom.window.document.body.textContent, /Team texts are off/);
});

test('signed-out page exposes disclosure and policies without requesting or saving consent', async t => {
  const h = await harness(t, { signedIn: false });
  assert.match(h.dom.window.document.body.textContent, /Public optional team-text disclosure/);
  assert.ok(h.dom.window.document.querySelector('a[href="/privacy"]'));
  assert.ok(h.dom.window.document.querySelector('a[href="/terms"]'));
  assert.match(h.dom.window.document.body.textContent, /Sign in to choose/);
  assert.equal(h.requests.length, 0);
});

test('an old account token cannot change phone readiness or dispatch a request after account switch', async t => {
  let resolveOldToken;
  const oldToken = new Promise(resolve => { resolveOldToken = resolve; });
  const h = await harness(t, { getToken: () => oldToken });
  assert.equal(h.requests.length, 0);
  await h.changeUser({ uid: 'athlete-b', phoneNumber: '+12025550999', getIdTokenResult: async () => token('google.com') });
  assert.equal(h.requests.length, 1);
  await act(async () => resolveOldToken(token('phone')));
  assert.equal(h.requests.length, 1);
  await act(async () => h.dom.window.document.querySelector('input[type=checkbox]').click());
  assert.equal(h.button('Save texting permission').disabled, true);
  assert.ok(h.dom.window.document.querySelector('[data-phone-verification]'));
});

test('signing out during a pending request clears loading and ignores its result', async t => {
  let resolveResponse;
  const response = new Promise(resolve => { resolveResponse = resolve; });
  const h = await harness(t, { fetcher: () => response });
  assert.match(h.dom.window.document.body.textContent, /Loading your texting choice/);
  await h.changeUser(null);
  assert.doesNotMatch(h.dom.window.document.body.textContent, /Loading your texting choice/);
  await act(async () => resolveResponse({ ok: true, json: async () => preferences({ explicitConsentRecorded: true }) }));
  assert.match(h.dom.window.document.body.textContent, /Sign in to choose/);
  assert.equal(h.dom.window.document.querySelector('input[type=checkbox]'), null);
  assert.equal(h.button('Turn team texts off'), undefined);
});
