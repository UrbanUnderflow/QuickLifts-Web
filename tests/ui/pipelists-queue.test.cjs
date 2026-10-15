const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const postcss = require('postcss');
const tailwind = require('tailwindcss');

// All identities, API responses and email evidence below are synthetic. Firebase
// is replaced before bundling, fetch is in-memory, and off-fixture traffic aborts.
async function fixture(t, { allowed = true, signedIn = true, listId = 'synthetic-list', status = 200 } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pipelists-queue-ui-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const settings = JSON.stringify({ allowed, signedIn, listId, status });
  await build({
    stdin: { contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import Queue from './src/pages/PipeListsQueue';
      const settings=${settings};
      window.__allowQueueRuntime=settings.allowed; window.__status=settings.status;
      window.__authImports=0; window.__configImports=0; window.__requests=[]; window.__pending=[];
      window.__identity=settings.signedIn?{uid:'synthetic-owner',getIdToken:async()=> 'synthetic-token'}:null;
      window.__router={isReady:true,query:settings.listId===null?{}:{listId:settings.listId}};
      window.__record={id:'synthetic-sequence',ownerUid:'synthetic-owner',listId:'synthetic-list',itemId:'synthetic-item',
        toEmail:'recipient@example.test',fromEmail:'sender@example.test',ccEmails:['copy@example.test'],bccEmails:[],status:'active',
        nextStepIndex:1,nextSendAt:'2030-01-01T12:00:00Z',updatedAt:'2029-12-28T12:00:00Z',lastError:'Synthetic delivery review',
        attempt:{index:1,startedAt:'2030-01-01T12:00:00Z'},steps:[{id:'email-1',subject:'Synthetic email subject',sentAt:'2029-12-28T12:00:00Z',messageId:'synthetic-provider-message',tracking:{status:'delivered',lastEventAt:'2029-12-28T12:01:00Z',deliveredAt:'2029-12-28T12:01:00Z',openCount:0,clickCount:0}}]};
      window.fetch=async(url,options)=>{
        window.__requests.push({url,method:options?.method,body:options?.body,headers:options?.headers,signal:options?.signal});
        const status=window.__status;
        const sequences=window.__empty?[]:[structuredClone(window.__record)];
        const respond=()=>({ok:status===200,status,json:async()=>({success:status===200,sequences})});
        if(window.__delay)return new Promise(resolve=>window.__pending.push(()=>resolve(respond())));
        return respond();
      };
      createRoot(document.getElementById('root')).render(<Queue/>);
    `, resolveDir: process.cwd(), sourcefile: 'queue-fixture.tsx', loader: 'tsx' },
    bundle: true, outfile: path.join(directory, 'bundle.js'), platform: 'browser',
    plugins: [{ name: 'isolated-queue', setup(build) {
      const mocks = {
        'next/head': 'export default function Head(){return null}',
        'next/router': 'export function useRouter(){return window.__router}',
        'firebase/auth': 'window.__authImports++; export function onAuthStateChanged(auth,callback){window.__identityChanged=callback;callback(window.__identity);return ()=>{window.__identityChanged=null}}',
      };
      build.onResolve({ filter: /^(next\/(head|router)|firebase\/auth)$/ }, args => ({ path: args.path, namespace: 'queue-mock' }));
      build.onResolve({ filter: /\/api\/firebase\/simpBudgetConfig$/ }, () => ({ path: 'config', namespace: 'queue-mock' }));
      build.onResolve({ filter: /\/utils\/pipelistsRuntime$/ }, () => ({ path: 'runtime', namespace: 'queue-mock' }));
      build.onLoad({ filter: /.*/, namespace: 'queue-mock' }, args => ({ contents: args.path === 'config' ? 'window.__configImports++;export const simpBudgetAuth={};' : args.path === 'runtime' ? 'export function isPipeListsProductionBrowser(){return window.__allowQueueRuntime===true}' : mocks[args.path], loader: 'js' }));
    } }],
  });
  const source = await fs.readFile('src/pages/PipeListsQueue.tsx', 'utf8') + await fs.readFile('src/components/pipelists/PipeListsQueueView.tsx', 'utf8');
  const css = await postcss([tailwind({ content: [{ raw: source, extension: 'tsx' }], theme: { extend: {} }, plugins: [] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
  await fs.writeFile(path.join(directory, 'style.css'), css.css);
  const server = http.createServer(async (request, response) => {
    if (request.url === '/bundle.js' || request.url === '/style.css') {
      response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'text/css');
      response.end(await fs.readFile(path.join(directory, request.url.slice(1))));
    } else response.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin);
  return page;
}

test('a blocked queue never initializes Firebase or loads any queue data', async t => {
  const page = await fixture(t, { allowed: false });
  await page.getByRole('alert').filter({ hasText: 'disabled outside' }).waitFor();
  assert.deepEqual(await page.evaluate(() => [window.__authImports, window.__configImports, window.__requests.length]), [0, 0, 0]);
  assert.equal(await page.getByRole('button').count(), 0);
});

test('an existing signed-out session does not load data or offer account creation', async t => {
  const page = await fixture(t, { signedIn: false });
  await page.getByRole('status').filter({ hasText: 'existing signed-in' }).waitFor();
  assert.equal(await page.evaluate(() => window.__requests.length), 0);
  assert.equal(await page.getByRole('button').count(), 0);
});

test('the queue renders stored evidence with only scoped read controls on desktop and mobile', async t => {
  const page = await fixture(t);
  const region = page.getByRole('region', { name: 'Stored email queue', exact: true });
  await region.waitFor();
  for (const value of ['recipient@example.test', 'synthetic-list', 'synthetic-item', 'active', '2030-01-01 12:00:00 UTC', 'Synthetic delivery review', 'Brevo (sequence transport)', 'synthetic-provider-message', 'delivered']) assert.match(await region.textContent(), new RegExp(value.replace(/[()]/g, '\\$&')));
  assert.deepEqual(await page.getByRole('button').allTextContents(), ['Inspect stored status']);
  assert.deepEqual(await page.evaluate(() => window.__requests.map(request => [request.method, request.url, request.body ?? null])), [['GET', '/api/pipelists/email-sequence?listId=synthetic-list', null]]);
  if (process.env.PIPELISTS_UI_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.PIPELISTS_UI_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.PIPELISTS_UI_SCREENSHOT_DIR, 'queue-desktop.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 375, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  if (process.env.PIPELISTS_UI_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PIPELISTS_UI_SCREENSHOT_DIR, 'queue-mobile.png'), fullPage: true });
});

test('list ID input reads only after Inspect and rejects invalid IDs locally', async t => {
  const page = await fixture(t, { listId: null });
  await page.getByLabel('List ID', { exact: true }).fill('synthetic-list');
  assert.equal(await page.evaluate(() => window.__requests.length), 0);
  await page.getByRole('button', { name: 'Inspect stored status' }).click();
  await page.getByRole('region', { name: 'Stored email queue', exact: true }).waitFor();
  await page.getByLabel('List ID', { exact: true }).fill('invalid/list');
  await page.getByRole('button', { name: 'Inspect stored status' }).click();
  await page.getByRole('alert').filter({ hasText: 'valid list ID' }).waitFor();
  assert.equal(await page.evaluate(() => window.__requests.length), 1);
  assert.equal(await page.getByRole('region', { name: 'Stored email queue', exact: true }).count(), 0);
});

test('denied owner permission is shown as an error rather than an empty queue', async t => {
  const page = await fixture(t, { status: 403 });
  await page.getByRole('alert').filter({ hasText: 'existing PipeLists owner' }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Stored email queue', exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.__requests.length), 1);
});

test('signing out during a read discards the late response and clears prior evidence', async t => {
  const page = await fixture(t);
  await page.getByRole('region', { name: 'Stored email queue', exact: true }).waitFor();
  await page.evaluate(() => { window.__delay = true; });
  await page.getByRole('button', { name: 'Inspect stored status' }).click();
  await page.waitForFunction(() => window.__pending.length === 1);
  await page.evaluate(() => { window.__identityChanged(null); window.__pending.shift()(); });
  await page.getByRole('status').filter({ hasText: 'existing signed-in' }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Stored email queue', exact: true }).count(), 0);
  assert.equal(await page.getByText('synthetic-provider-message', { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.__requests.every(request => request.method === 'GET' && !request.body)), true);
});


test('repeated inspection aborts the earlier scope and ignores its late response', async t => {
  const page = await fixture(t);
  const region = page.getByRole('region', { name: 'Stored email queue', exact: true });
  await region.waitFor();
  await page.evaluate(() => { window.__delay = true; });
  await page.getByRole('button', { name: 'Inspect stored status' }).click();
  await page.waitForFunction(() => window.__pending.length === 1);
  assert.equal(await region.count(), 0);
  await page.evaluate(() => { window.__record = { ...window.__record, listId: 'newer-list', id: 'newer-sequence', toEmail: 'newer@example.test' }; });
  await page.getByLabel('List ID', { exact: true }).fill('newer-list');
  await page.getByRole('button', { name: 'Inspect stored status' }).click();
  await page.waitForFunction(() => window.__pending.length === 2);
  assert.equal(await page.evaluate(() => window.__requests[1].signal.aborted), true);
  await page.evaluate(() => window.__pending.pop()());
  await region.getByRole('heading', { name: 'newer@example.test', exact: true }).waitFor();
  await page.evaluate(() => window.__pending.shift()());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.match(await region.textContent(), /newer-sequence/);
  assert.doesNotMatch(await region.textContent(), /synthetic-sequence/);
  assert.equal(await page.evaluate(() => window.__requests.every(request => request.method === 'GET' && !request.body)), true);
});

test('an empty scoped result is distinct from an unavailable read', async t => {
  const page = await fixture(t);
  const region = page.getByRole('region', { name: 'Stored email queue', exact: true });
  await region.waitFor();
  await page.evaluate(() => { window.__empty = true; });
  await page.getByRole('button', { name: 'Inspect stored status' }).click();
  await page.getByText('No stored email sequences were returned for this list.', { exact: true }).waitFor();
  assert.match(await region.textContent(), /covers only this list/);
  await page.evaluate(() => { window.__status = 500; });
  await page.getByRole('button', { name: 'Inspect stored status' }).click();
  await page.getByRole('alert').filter({ hasText: 'could not be read' }).waitFor();
  assert.equal(await region.count(), 0);
  assert.equal(await page.getByText('No stored email sequences were returned for this list.', { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.__requests.every(request => request.method === 'GET' && !request.body)), true);
});

test('long stored identifiers remain readable without mobile horizontal overflow', async t => {
  const page = await fixture(t);
  await page.getByRole('region', { name: 'Stored email queue', exact: true }).waitFor();
  await page.evaluate(() => {
    window.__record.id = 'sequence-'.repeat(35);
    window.__record.itemId = 'item-'.repeat(45);
    window.__record.steps[0].messageId = 'provider-message-'.repeat(35);
    window.__record.steps[0].subject = 'subject-'.repeat(45);
    window.__record.lastError = 'error-detail-'.repeat(35);
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: 'Inspect stored status' }).click();
  await page.getByText('sequence-'.repeat(35), { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  if (process.env.PIPELISTS_UI_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.PIPELISTS_UI_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.PIPELISTS_UI_SCREENSHOT_DIR, 'queue-long-identifiers-mobile.png'), fullPage: true });
  }
});
