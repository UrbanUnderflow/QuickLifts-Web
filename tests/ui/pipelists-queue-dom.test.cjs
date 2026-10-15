const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const { act } = React;
const rootPath = path.resolve(__dirname, '../..');

function load(file, mocks, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(rootPath, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    module, exports: module.exports, Date, Error, AbortController, console,
    require(name) { if (!(name in mocks)) throw Error(`Unexpected dependency: ${name}`); return mocks[name](); }, ...globals,
  }, { filename: file });
  return module.exports;
}

async function fixture(t, { allowed = true, signedIn = true, listId = 'synthetic-list', status = 200 } = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fixture.invalid/' });
  const prior = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const state = {
    requests: [], authImports: 0, configImports: 0, delay: false, pending: [], status,
    identity: signedIn ? { uid: 'synthetic-owner', getIdToken: async () => 'synthetic-token' } : null,
    router: { isReady: true, query: listId === null ? {} : { listId } },
    record: { id: 'synthetic-sequence', ownerUid: 'synthetic-owner', listId: 'synthetic-list', itemId: 'synthetic-item', toEmail: 'recipient@example.test', fromEmail: 'sender@example.test', status: 'active', nextStepIndex: 1, nextSendAt: '2030-01-01T12:00:00Z', attempt: { index: 1, startedAt: '2030-01-01T12:00:00Z' }, lastError: 'Synthetic delivery review', steps: [{ id: 'email-1', subject: 'Synthetic subject', sentAt: '2029-12-28T12:00:00Z', messageId: 'synthetic-provider-message', tracking: { status: 'delivered', openCount: 0, clickCount: 0 } }] },
  };
  const fetchStatus = async (url, options) => {
    state.requests.push({ url, ...options });
    const respond = () => ({ ok: state.status === 200, status: state.status, json: async () => ({ success: state.status === 200, sequences: state.empty ? [] : [state.record] }) });
    return state.delay ? new Promise(resolve => state.pending.push(() => resolve(respond()))) : respond();
  };
  const queue = load('src/utils/pipelistsQueue.ts', {}, { fetch: fetchStatus });
  const view = load('src/components/pipelists/PipeListsQueueView.tsx', { react: () => React, '../../utils/pipelistsQueue': () => queue });
  const page = load('src/pages/PipeListsQueue.tsx', {
    react: () => React, 'next/head': () => () => null, 'next/router': () => ({ useRouter: () => state.router }),
    '../components/pipelists/PipeListsQueueView': () => view, '../utils/pipelistsQueue': () => queue,
    '../utils/pipelistsRuntime': () => ({ isPipeListsProductionBrowser: () => allowed }),
    'firebase/auth': () => { state.authImports++; return { onAuthStateChanged: (_, callback) => { state.identityChanged = callback; callback(state.identity); return () => {}; } }; },
    '../api/firebase/simpBudgetConfig': () => { state.configImports++; return { simpBudgetAuth: {} }; },
  }).default;
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root'));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  await act(async () => root.render(React.createElement(page)));
  const inspect = async value => {
    await act(async () => {
      const input = dom.window.document.getElementById('queue-list-id');
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await act(async () => dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  };
  return { state, document: dom.window.document, inspect };
}

test('blocked queue mounts without initializing auth, Firebase or fetch', async t => {
  const { state, document } = await fixture(t, { allowed: false });
  assert.match(document.querySelector('[role="alert"]').textContent, /disabled outside/);
  assert.deepEqual([state.authImports, state.configImports, state.requests.length], [0, 0, 0]);
  assert.equal(document.querySelectorAll('button').length, 0);
});

test('signed-out queue requires the existing session and never requests data', async t => {
  const { state, document } = await fixture(t, { signedIn: false });
  assert.match(document.body.textContent, /existing signed-in PipeLists owner session/);
  assert.equal(state.requests.length, 0);
});

test('rendered owner queue contains requested evidence and only one read action', async t => {
  const { state, document } = await fixture(t);
  const output = document.querySelector('[aria-label="Stored email queue"]').textContent;
  for (const value of ['recipient@example.test', 'synthetic-list', 'synthetic-item', 'active', '2030-01-01 12:00:00 UTC', 'Synthetic delivery review', 'Brevo', 'synthetic-provider-message', 'delivered', 'Step index 1']) assert.ok(output.includes(value), value);
  assert.deepEqual([...document.querySelectorAll('button')].map(button => button.textContent), ['Inspect stored status']);
  assert.equal(state.requests.length, 1); assert.equal(state.requests[0].method, 'GET'); assert.equal(state.requests[0].body, undefined);
});

test('local input waits for Inspect and invalid scope clears stale results without another read', async t => {
  const { state, document, inspect } = await fixture(t, { listId: null });
  assert.equal(state.requests.length, 0);
  await inspect('synthetic-list');
  assert.equal(state.requests.length, 1);
  assert.ok(document.querySelector('[aria-label="Stored email queue"]'));
  await inspect('invalid/list');
  assert.equal(state.requests.length, 1);
  assert.match(document.querySelector('[role="alert"]').textContent, /valid list ID/);
  assert.equal(document.querySelector('[aria-label="Stored email queue"]'), null);
});

test('non-owner denial stays visible and never becomes an empty queue', async t => {
  const { state, document } = await fixture(t, { status: 403 });
  assert.match(document.querySelector('[role="alert"]').textContent, /existing PipeLists owner/);
  assert.equal(document.querySelector('[aria-label="Stored email queue"]'), null);
  assert.equal(state.requests.length, 1);
});

test('session change aborts a pending read and suppresses its late response', async t => {
  const { state, document, inspect } = await fixture(t);
  state.delay = true;
  await inspect('synthetic-list');
  assert.equal(state.pending.length, 1);
  await act(async () => { state.identityChanged(null); state.pending.shift()(); });
  assert.equal(state.requests[1].signal.aborted, true);
  assert.equal(document.querySelector('[aria-label="Stored email queue"]'), null);
  assert.equal(document.body.textContent.includes('synthetic-provider-message'), false);
});


test('empty result is cleared when a later read fails', async t => {
  const { state, document, inspect } = await fixture(t);
  state.empty = true;
  await inspect('synthetic-list');
  assert.match(document.body.textContent, /No stored email sequences/);
  state.status = 500;
  await inspect('synthetic-list');
  assert.match(document.querySelector('[role="alert"]').textContent, /could not be read/);
  assert.equal(document.querySelector('[aria-label="Stored email queue"]'), null);
});
