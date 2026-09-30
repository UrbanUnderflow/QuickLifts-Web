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

// Isolated browser fixture: no Firebase credentials, live backend, or real email sends.
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipelists-sequence-ui-'));
  const source = await fs.readFile('src/components/pipelists/PipeListsEmailSequence.tsx', 'utf8') + await fs.readFile('src/components/pipelists/PipeListsEmailTracking.tsx', 'utf8');
  await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import Component from './src/components/pipelists/PipeListsEmailSequence';
    const user={getIdToken:async()=> 'fixture-token'};
    const item={id:'howard',title:'Howard University Athletics Department',organization:'Howard University',contactEmails:['ad@howard.example','staff@howard.example']};
    window.__requests=[]; window.__record=null;
    window.fetch=async(url,opts)=>{
      const body=opts.body?JSON.parse(opts.body):null;
      if(window.__failLoad&&!body)return {ok:false,json:async()=>({success:false,error:'Sequence service unavailable'})};
      if(body){
        window.__requests.push(body);
        if(body.action==='refresh-tracking'){
          if(window.__trackingError)return {ok:false,json:async()=>({success:false,error:'Provider tracking is temporarily unavailable.'})};
          if(window.__tracking){window.__record={...window.__record,steps:window.__record.steps.map((s,i)=>i===0?{...s,tracking:window.__tracking}:s)};}
          return {ok:true,json:async()=>({success:true,sequence:window.__record})};
        }
        const old=window.__record;
        const next={id:'seq-1',ownerUid:'owner',listId:'universities',itemId:'howard',status:'draft',nextStepIndex:0,nextSendAt:'',lastError:'',createdAt:'2026-09-30T14:00:00Z',updatedAt:'2026-09-30T14:00:00Z',...old,...body.sequence,version:(old?.version||0)+1};
        if(body.action==='send'){
          if(window.__sendError){next.status='error';next.lastError='Recipient suppressed. Sending stopped.';}
          else{next.steps=next.steps.map((s,i)=>i? s:{...s,sentAt:'2026-09-30T14:00:00Z',messageId:'fake-message'});next.status='active';next.nextStepIndex=1;next.nextSendAt='2026-10-04T14:00:00Z';}
        }
        if(body.action==='pause'){next.status='paused';next.nextSendAt='';}
        if(body.action==='resume'){next.status='active';next.nextSendAt='2026-10-07T14:00:00Z';}
        window.__record=next;
      }
      return {ok:true,json:async()=>({success:true,sequence:window.__record})};
    };
    window.__mount=()=>createRoot(document.getElementById('root')).render(<Component user={user} listId="universities" item={item} onClose={()=>{window.__closed=true}}/>);
    window.__mount();
  `, resolveDir: process.cwd(), sourcefile: 'sequence-fixture.tsx', loader: 'tsx' }, bundle: true, outfile: path.join(dir, 'bundle.js'), platform: 'browser' });
  const css = await postcss([tailwind({ content: [{ raw: source, extension: 'tsx' }], theme: { extend: {} }, plugins: [] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
  await fs.writeFile(path.join(dir, 'style.css'), css.css);
  const server = http.createServer(async (req, res) => {
    if (req.url === '/bundle.js' || req.url === '/style.css') {
      res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css');
      res.end(await fs.readFile(path.join(dir, req.url.slice(1))));
    } else res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body style="margin:0;background:#f5f5f4"><main id="root" style="max-width:900px;margin:auto;background:white"></main><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1050, height: 1100 } });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); await fs.rm(dir, { recursive: true, force: true }); });
  await page.goto(origin);
  await page.getByLabel('Subject', { exact: true }).waitFor();
  return page;
}
async function personalize(page) {
  for (let i = 0; i < 3; i++) {
    await page.getByRole('tab').nth(i).click();
    await page.getByLabel('Message', { exact: true }).fill(`Hello Dr. Smith,\n\nCustom Howard email ${i + 1}. https://example.org/resource`);
  }
}

test('school editor selects senders and contacts, retains step edits, saves, starts and pauses without losing edits', async t => {
  const page = await fixture(t);
  assert.equal(await page.getByLabel('From', { exact: true }).inputValue(), 'tre@fitwithpulse.ai');
  assert.equal(await page.getByLabel('From', { exact: true }).locator('option').count(), 3);
  assert.equal(await page.getByLabel('Recipient', { exact: true }).inputValue(), 'ad@howard.example');
  assert.match(await page.getByLabel('Message', { exact: true }).inputValue(), /Hi \[Name\]/);
  assert.equal(await page.getByRole('button', { name: 'Send email & start sequence' }).isDisabled(), true);
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Day 1 · Email 1', 'Day 5 · Email 2', 'Day 12 · Email 3']);
  await page.getByLabel('From', { exact: true }).selectOption('hello@fitwithpulse.ai');
  await page.getByLabel('Recipient', { exact: true }).selectOption('__custom__');
  await page.getByLabel('Custom email', { exact: true }).fill('director@howard.example');
  await personalize(page);
  await page.getByRole('tab').nth(1).click();
  await page.getByLabel('Days after the previous email').fill('5');
  await page.getByRole('tab').nth(0).click();
  assert.match(await page.getByLabel('Message', { exact: true }).inputValue(), /Custom Howard email 1/);
  assert.match(await page.getByRole('tab').nth(2).textContent(), /Day 13/);
  await page.getByRole('button', { name: 'Save school sequence' }).click();
  await page.getByText('School sequence saved.', { exact: true }).waitFor();
  const saved = await page.evaluate(() => window.__record);
  assert.equal(saved.fromEmail, 'hello@fitwithpulse.ai');
  assert.equal(saved.toEmail, 'director@howard.example');
  assert.equal(saved.steps[1].delayDays, 5);
  await page.getByRole('button', { name: 'Send email & start sequence' }).click();
  await page.getByText('First email sent. Follow-ups are scheduled.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('tab').nth(1).getAttribute('aria-selected'), 'true');
  await page.getByRole('tab').nth(0).click();
  assert.equal(await page.getByLabel('Message', { exact: true }).isDisabled(), true);
  await page.getByRole('tab').nth(1).click();
  await page.getByLabel('Message', { exact: true }).fill('Keep this unsaved school-specific change.');
  await page.getByRole('button', { name: 'Pause sequence / reply received' }).click();
  await page.getByText('Automatic follow-ups paused.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Keep this unsaved school-specific change.');
  assert.equal(await page.getByRole('button', { name: 'Resume sequence' }).isDisabled(), true);
  if (process.env.PIPELISTS_UI_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.PIPELISTS_UI_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.PIPELISTS_UI_SCREENSHOT_DIR, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 375, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(process.env.PIPELISTS_UI_SCREENSHOT_DIR, 'mobile.png'), fullPage: true });
  }
});

test('suppressed delivery is shown as an error rather than a successful send', async t => {
  const page = await fixture(t);
  await personalize(page);
  await page.evaluate(() => { window.__sendError = true; });
  await page.getByRole('button', { name: 'Send email & start sequence' }).click();
  await page.getByText('Sequence needs attention', { exact: true }).waitFor();
  assert.equal(await page.getByText('First email sent. Follow-ups are scheduled.', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Send email & start sequence' }).count(), 0);
});


test('each sequence email shows tracking, refresh preserves school edits, and failures stay visible', async t => {
  const page = await fixture(t);
  await personalize(page);
  await page.getByRole('button', { name: 'Send email & start sequence' }).click();
  await page.getByText('First email sent. Follow-ups are scheduled.', { exact: true }).waitFor();
  await page.getByLabel('Message', { exact: true }).fill('Preserve this email 2 draft while email 1 engagement refreshes.');
  for (const status of ['delivered', 'opened', 'clicked']) {
    await page.evaluate(status => { window.__tracking = { status, deliveredAt: '2026-09-30T14:01:00Z', ...(status !== 'delivered' ? { openedAt: '2026-09-30T14:05:00Z', openCount: 2 } : {}), ...(status === 'clicked' ? { clickedAt: '2026-09-30T14:06:00Z', clickCount: 1, lastClickedLink: 'https://example.org/resource' } : {}) }; }, status);
    await page.getByRole('button', { name: 'Refresh email tracking' }).click();
    await page.getByRole('tab').nth(0).filter({ hasText: status.charAt(0).toUpperCase() + status.slice(1) }).waitFor();
    assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Preserve this email 2 draft while email 1 engagement refreshes.');
    assert.match(await page.getByRole('tab').nth(1).textContent(), /Email 2$/);
  }
  await page.getByRole('tab').nth(0).click();
  const tracking = page.getByRole('region', { name: 'Email 1 activity' });
  await tracking.getByText('2 tracked opens · 1 tracked click', { exact: true }).waitFor();
  assert.equal(await tracking.getByRole('link').getAttribute('href'), 'https://example.org/resource');
  assert.match(await tracking.textContent(), /Last opened/);
  if (process.env.PIPELISTS_UI_SCREENSHOT_DIR) {
    await page.screenshot({ path: path.join(process.env.PIPELISTS_UI_SCREENSHOT_DIR, 'tracking-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 375, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(process.env.PIPELISTS_UI_SCREENSHOT_DIR, 'tracking-mobile.png'), fullPage: true });
  }
  await page.evaluate(() => { window.__trackingError = true; });
  await page.getByRole('button', { name: 'Refresh email tracking' }).click();
  await page.getByRole('alert').filter({ hasText: 'Provider tracking is temporarily unavailable.' }).waitFor();
  await tracking.getByText('2 tracked opens · 1 tracked click', { exact: true }).waitFor();
  await page.getByRole('tab').nth(1).click();
  assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Preserve this email 2 draft while email 1 engagement refreshes.');
});
