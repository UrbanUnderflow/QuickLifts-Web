// Offline UI checks: fictional data, mocked authentication, no external requests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright');
const { createPreviewServer } = require('../../scripts/preview-coach-messages.cjs');

function isolate(page, errors, external) {
  page.on('pageerror', error => errors.push(error.message));
  return page.route('**/*', route => { const url = new URL(route.request().url()); if (url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort(); } return route.continue(); });
}
test('unified inbox preview supports channel selection, private fan-out, failed Text-only retry and mobile layout', async () => {
  const preview = await createPreviewServer(0);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [], external = [];
  await isolate(page, errors, external);
  try {
    await page.goto(preview.url);
    await page.getByRole('heading', { name: 'Messages', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Jordan Lee', exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'App', exact: true }).isChecked(), true);
    assert.equal(await page.getByRole('checkbox', { name: 'Text', exact: true }).isChecked(), true);

    const outgoingBefore = await page.locator('article').count();
    await page.getByRole('button', { name: 'Retry Text only', exact: true }).click();
    await page.getByText('Text queued', { exact: true }).waitFor();
    assert.equal(await page.locator('article').count(), outgoingBefore, 'Retry must not add another App/logical bubble');
    await page.getByRole('checkbox', { name: 'Unread only' }).check();
    assert.equal(await page.getByRole('button', { name: /Avery Cole/ }).count(), 1);
    assert.equal(await page.getByRole('button', { name: /Jordan Lee/ }).count(), 0);
    await page.getByRole('checkbox', { name: 'Unread only' }).uncheck();
    await page.getByRole('button', { name: /Sam Rivera/ }).click();
    assert.equal(await page.getByRole('checkbox', { name: 'Text', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('checkbox', { name: 'App', exact: true }).isChecked(), true);
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('App remains available after Text opt-out.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText('App remains available after Text opt-out.', { exact: true }).last().waitFor();
    await page.getByRole('button', { name: 'New message', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Jordan Lee', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Avery Cole', exact: true }).check();
    assert.equal(await page.getByRole('checkbox', { name: 'Text', exact: true }).isChecked(), true);
    await page.getByRole('checkbox', { name: 'Sam Rivera', exact: true }).check();
    assert.equal(await page.getByRole('checkbox', { name: 'Text', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('checkbox', { name: 'App', exact: true }).isChecked(), true);
    await page.getByRole('checkbox', { name: 'Sam Rivera', exact: true }).uncheck();
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Unified private fan-out.');
    await page.getByRole('button', { name: 'Send privately to 2', exact: true }).click();
    await page.getByRole('heading', { name: 'Jordan Lee', exact: true }).waitFor();
    await page.locator('article').filter({ hasText: 'Unified private fan-out.' }).waitFor();
    assert.equal(await page.locator('article').filter({ hasText: 'Unified private fan-out.' }).count(), 1);
    await page.getByRole('button', { name: /Avery Cole/ }).click();
    await page.locator('article').filter({ hasText: 'Unified private fan-out.' }).waitFor();
    assert.equal(await page.locator('article').filter({ hasText: 'Unified private fan-out.' }).count(), 1);
    await page.getByRole('checkbox', { name: 'App', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: 'Text', exact: true }).uncheck();
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('No channel selected.');
    assert.equal(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled(), true);
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('');
    await page.setViewportSize({ width: 390, height: 844 });

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
  } finally { await browser.close(); await preview.close(); }
});

test('lost commit response, later auth rejection and reload preserve the original pending request ID', async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-messages-transport-test-'));
  await esbuild.build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Inbox from './src/components/coach/CoachMessagesInbox';createRoot(document.getElementById('root')).render(<Inbox teamId="team" coachId="coach"/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outfile: path.join(output, 'app.js'), plugins: [{ name: 'synthetic-auth', setup(build) { build.onResolve({ filter: /api\/firebase\/config$/ }, () => ({ path: 'synthetic-auth', namespace: 'test' })); build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const auth={currentUser:{getIdToken:async()=>"synthetic-token"}};export const getFirebaseModeRequestHeaders=()=>({'x-pulsecheck-firebase-mode':'dev'});` })); } }] });
  const server = http.createServer((request, response) => {
    const asset = request.url === '/app.js' ? 'app.js' : request.url === '/app.css' ? 'app.css' : null;
    response.setHeader('Content-Type', asset === 'app.js' ? 'application/javascript' : asset === 'app.css' ? 'text/css' : 'text/html');
    response.end(asset ? fs.readFileSync(path.join(output, asset)) : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true }), page = await browser.newPage();
  const errors = [], external = [], attempts = [], saved = new Map();
  await isolate(page, errors, external);
  await page.route('**/api/coach/communications/inbox**', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      if (body.action !== 'send') return route.fulfill({ json: { read: true } });
      attempts.push(body.requestId);
      if (attempts.length === 1) { saved.set(body.requestId, body); return route.abort(); }
      if (attempts.length === 2) return route.fulfill({ status: 401, json: { notSaved: true, error: 'Synthetic session expired.' } });
      return route.fulfill({ status: 202, json: { requestId: body.requestId, duplicate: saved.has(body.requestId) } });
    }
    return route.fulfill({ json: { recipients: [{ id: 'a', name: 'Jordan Sample', unread: false, lastMessage: '', lastAtMs: 0, textAvailable: true, textReason: null }], messages: [...saved.values()].map(body => ({ id: body.requestId, athleteId: 'a', text: body.text, direction: 'outgoing', atMs: 1, channels: { app: { status: 'saved' }, sms: { status: 'unknown' } } })), hasOlder: false, smsNextCursor: null } });
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button', { name: /Jordan Sample/ }).click();
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Synthetic lost response.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Retry same request', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Retry same request', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Synthetic session expired.' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).isDisabled(), true);
    await page.reload();
    await page.getByRole('button', { name: 'Retry same request', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Retry same request', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'already saved' }).waitFor();
    assert.equal(attempts.length, 3); assert.equal(new Set(attempts).size, 1); assert.equal(saved.size, 1);
    assert.equal(await page.locator('article').filter({ hasText: 'Synthetic lost response.' }).count(), 1);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(output, { recursive: true, force: true }); }
});
