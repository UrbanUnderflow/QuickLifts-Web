const test = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require('@playwright/test');

test('organization deletion requires the exact name and restoration respects the deadline', async () => {
  const bundle = await esbuild.build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Lifecycle from './src/components/admin/OrganizationLifecycle';
      const now = Date.now();
      window.requests=[]; window.changes=0;
      window.fetch=async (url,options)=>{ window.requests.push({url, ...options}); return {ok:true,json:async()=> options.method==='POST' ? {success:true} : {organizations:[
        {id:'restorable',displayName:'Restorable Academy',status:'deleted',deletedAt:now-86400000,purgeAfter:now+86400000},
        {id:'expired',displayName:'Expired Academy',status:'deleted',deletedAt:now-90*86400000,purgeAfter:now-1},
        {id:'purging',displayName:'Purging Academy',status:'purging',deletedAt:now-90*86400000,purgeAfter:now+86400000}
      ]}} };
      function App(){const [target,setTarget]=React.useState(null);return <><button onClick={()=>setTarget({id:'synthetic',displayName:'Synthetic Academy'})}>Open delete</button><Lifecycle target={target} onClose={()=>setTarget(null)} onChanged={async()=>{window.changes++;}}/></>}
      createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'synthetic-auth', setup(build) {
      build.onResolve({ filter: /api\/firebase\/config$/ }, () => ({ path: 'auth', namespace: 'synthetic' }));
      build.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: `export const auth={currentUser:{getIdToken:async()=> 'synthetic-token'}}; export const getFirebaseModeRequestHeaders=()=>({});`, loader: 'js' }));
    } }],
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    await page.route('**/*', route => route.abort());
    await page.setContent('<!doctype html><html><body style="font:16px system-ui;background:#f5f4ef;padding:28px"><div id="root"></div></body></html>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.getByText('Deleted organizations (3)', { exact: true }).click();
    const restorable = page.getByRole('listitem').filter({ hasText: 'Restorable Academy' });
    assert.equal(await restorable.getByRole('button').isEnabled(), true);
    assert.equal(await page.getByRole('listitem').filter({ hasText: 'Expired Academy' }).getByRole('button').isDisabled(), true);
    assert.equal(await page.getByRole('listitem').filter({ hasText: 'Purging Academy' }).getByRole('button').isDisabled(), true);
    await page.getByRole('button', { name: 'Open delete' }).click();
    const dialog = page.getByRole('dialog');
    const submit = dialog.getByRole('button', { name: 'Delete organization', exact: true });
    assert.equal(await submit.isDisabled(), true);
    await dialog.getByRole('textbox').fill('Synthetic');
    assert.equal(await submit.isDisabled(), true);
    await dialog.getByRole('textbox').fill('Synthetic Academy');
    assert.equal(await submit.isEnabled(), true);
    await page.screenshot({ path: 'work/organization-lifecycle-dialog.png' });
    await submit.click();
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.changes === 1);
    const deletion = await page.evaluate(() => window.requests.filter(request => request.method === 'POST').map(request => JSON.parse(request.body)));
    assert.deepEqual(deletion, [{ organizationId: 'synthetic', action: 'delete', confirmationName: 'Synthetic Academy' }]);
    await restorable.getByRole('button').click();
    await page.waitForFunction(() => window.changes === 2);
    assert.deepEqual(await page.evaluate(() => JSON.parse(window.requests.filter(request => request.method === 'POST')[1].body)), { organizationId: 'restorable', action: 'restore' });
    await page.screenshot({ path: 'work/organization-lifecycle-restoration.png' });
  } finally { await browser.close(); }
});
