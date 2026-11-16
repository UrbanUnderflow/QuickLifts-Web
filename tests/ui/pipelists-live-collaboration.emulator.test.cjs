const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');

for (const dashboard of [false, true]) test(`owner and editor converge on the ${dashboard ? 'dashboard' : 'private link'} through reconnect`, async t => {
  const address = process.env.FIRESTORE_EMULATOR_HOST || '';
  assert.match(address, /^127\.0\.0\.1:\d+$/, 'Start a loopback Firestore emulator first');
  const projectId = 'demo-pipelists-browser';
  const env = await initializeTestEnvironment({ projectId, firestore: {
    host: '127.0.0.1', port: Number(address.split(':')[1]), rules: fs.readFileSync('firestore.simpbudget.rules', 'utf8'),
  } });
  t.after(() => env.cleanup());
  const shareId = 'owner-fixture';
  const list = { id: 'fixture', name: 'Fixture list', templateKey: dashboard ? 'university-pilot' : 'grant', createdAt: '2026-01-01',
    items: [{ id: 'lead', title: 'Fixture lead', notes: 'start', stage: 'identified', createdAt: '2026-01-01', updatedAt: '2026-01-01' }] };
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const share = { ownerUid: 'owner', ownerEmail: 'owner@example.test', access: 'edit', publicRead: false,
      protectedDetails: true, viewerEmails: [], editorEmails: ['editor@example.test'], list };
    await setDoc(doc(db, 'pipeListShares', shareId), { ...share, list: { ...list, items: [] } });
    await setDoc(doc(db, 'pipeListProtectedShares', shareId), { ownerUid: share.ownerUid, ownerEmail: share.ownerEmail,
      listId: list.id, list, writeProtocol: 2, revision: 1 });
    await setDoc(doc(db, 'simpbudget-users/owner/pipeLists/state'), { lists: [list], writeProtocol: 2, revision: 1 });
    for (const uid of ['owner', 'editor']) await setDoc(doc(db, 'pipeListProfiles', uid), { displayName: uid });
  });
  // Bundle the workspace component inside a synthetic shell. The deployed route
  // and its production-host guard stay intact. All transports are loopback-only.
  const { outputFiles } = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import Workspace from './src/features/PipeListsWorkspace';
      createRoot(document.getElementById('root')).render(<Workspace/>);`,
      resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, jsx: 'automatic', write: false, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'loopback-only', setup(builder) {
      builder.onResolve({ filter: /\/api\/firebase\/(config|simpBudgetConfig)$/ }, () => ({ path: 'db', namespace: 'fixture' }));
      builder.onResolve({ filter: /^firebase\/auth$/ }, args => args.importer.endsWith('PipeListsWorkspace.tsx') ? { path: 'auth', namespace: 'fixture' } : undefined);
      builder.onResolve({ filter: /^(next\/link|next\/head)$/ }, () => ({ path: 'empty', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ resolveDir: process.cwd(), contents: ({
        db: `import {initializeApp} from 'firebase/app';
          import {initializeFirestore,connectFirestoreEmulator,enableNetwork,disableNetwork} from 'firebase/firestore';
          const uid=new URLSearchParams(location.search).get('uid');
          const user={uid,email:uid+'@example.test',displayName:uid};
          export const simpBudgetDb=initializeFirestore(initializeApp({projectId:${JSON.stringify(projectId)},apiKey:'fixture',appId:'fixture'}),{experimentalForceLongPolling:true});
          connectFirestoreEmulator(simpBudgetDb,'127.0.0.1',${Number(address.split(':')[1])},{mockUserToken:{sub:uid,email:user.email,email_verified:true}});
          window.connection=online=>online?enableNetwork(simpBudgetDb):disableNetwork(simpBudgetDb);
          export const simpBudgetAuth={currentUser:user}, auth=simpBudgetAuth, db=simpBudgetDb, simpBudgetStorage={};`,
        auth: `export function onAuthStateChanged(auth,callback){queueMicrotask(()=>callback(auth.currentUser));return ()=>{}}
          export const isSignInWithEmailLink=()=>false,getRedirectResult=async()=>null,GoogleAuthProvider=class {},browserPopupRedirectResolver={};
          export const sendSignInLinkToEmail=()=>{},signInWithEmailLink=()=>{},signInWithPopup=()=>{},signOut=()=>{};`,
        empty: 'export default function Empty(){return null}',
      })[path] }));
    } }],
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(outputFiles[0].contents); return; }
    res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self'; connect-src http://${address}; style-src 'unsafe-inline'`);
    res.end('<main id="root"></main><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  t.after(() => browser.close());
  const pageErrors = [];
  const pages = await Promise.all(['owner', 'editor'].map(async uid => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?${dashboard ? '' : 'share=' + shareId + '&'}uid=${uid}`);
    await page.getByTitle('Edit opportunity', { exact: true }).first().click({ timeout: 15000 }).catch(async error => { throw new Error(uid + ': ' + (await page.locator('body').innerText()).slice(-1800), { cause: error }); });
    return page;
  }));
  const [owner, editor] = pages;
  const value = (page, selector, expected) => page.waitForFunction(([selector, expected]) =>
    document.querySelector(selector)?.value === expected, [selector, expected], { timeout: 12000 });
  await Promise.all(pages.map(page => value(page, '#pipe-notes', 'start')));
  const presence = page => page.waitForFunction(() =>
    document.querySelectorAll('ul[aria-label="People with this list open"] li').length === 2);
  await Promise.all(pages.map(presence));
  const secondTab = await owner.context().newPage();
  await secondTab.goto(owner.url());
  await presence(secondTab);
  await secondTab.close();
  await presence(editor);
  await env.withSecurityRulesDisabled(async c => {
    assert.equal((await getDoc(doc(c.firestore(), 'pipeListProtectedShares', shareId))).data().revision, 1);
  });
  await Promise.all([owner.locator('#pipe-notes').fill('left start'), editor.locator('#pipe-notes').fill('start right')]);
  await Promise.all(pages.map(page => value(page, '#pipe-notes', 'left start right')));
  await Promise.all([owner.locator('#pipe-title').fill('New title'), editor.locator('#pipe-notes').fill('left start right!')]);
  await Promise.all([value(editor, '#pipe-title', 'New title'), value(owner, '#pipe-notes', 'left start right!')]);
  await editor.locator('#pipe-notes').evaluate(field => { field.focus(); field.setSelectionRange(5, 5); });
  await owner.locator('#pipe-notes').fill('++left start right!');
  await value(editor, '#pipe-notes', '++left start right!');
  assert.equal(await editor.locator('#pipe-notes').evaluate(field => field.selectionStart), 7);
  await owner.locator('#pipe-notes').fill('left start right!');
  await value(editor, '#pipe-notes', 'left start right!');
  await editor.evaluate(() => window.connection(false));
  await editor.locator('#pipe-notes').fill('offline left start right!');
  await owner.locator('#pipe-notes').fill('left start right! online');
  await editor.evaluate(() => window.connection(true));
  const finalText = 'offline left start right! online';
  await Promise.all(pages.map(page => value(page, '#pipe-notes', finalText)));
  // Reconnect without a competing write: a metadata-only server snapshot must
  // still restart an autosave that exhausted its transient retries offline.
  await editor.evaluate(() => window.connection(false));
  await editor.locator('#pipe-title').fill('Pending while offline');
  await new Promise(resolve => setTimeout(resolve, 2500));
  await editor.evaluate(() => window.connection(true));
  await value(owner, '#pipe-title', 'Pending while offline');
  const stages = await owner.locator('#pipe-stage option').evaluateAll(options => options.map(option => option.value));
  await Promise.all([owner.locator('#pipe-stage').selectOption(stages[1]), editor.locator('#pipe-stage').selectOption(stages[2])]);
  await env.withSecurityRulesDisabled(async context => {
    const ref = doc(context.firestore(), 'pipeListProtectedShares', shareId);
    for (let i = 0; i < 80; i++) {
      const saved = (await getDoc(ref)).data();
      const item = saved.list.items[0];
      if (item.weeklyLogs?.filter(log => log.systemAction === 'field-changed').length >= 2) {
        assert.equal(item.notes, finalText);
        await Promise.all(pages.map(page => value(page, '#pipe-stage', item.stage)));
        await new Promise(resolve => setTimeout(resolve, 1200));
        assert.equal((await getDoc(ref)).data().revision, saved.revision, 'Both editors stop writing after convergence');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail('Both stage changes must be recorded in the saved list');
  });
  assert.deepEqual(pageErrors, []);
});
