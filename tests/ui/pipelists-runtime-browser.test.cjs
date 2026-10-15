const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { build } = require('esbuild');
const { chromium } = require('playwright');

// Exercise the actual production-host/build guard in a real browser. Only service
// dependencies are stubbed, before bundling. No production URL or service is used.
async function fixture(t, productionBuild) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pipelists-runtime-ui-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await build({
    stdin: { contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import App from './src/pages/_app';
      import WorkspaceEntry from './src/pages/PipeLists';
      import QueueEntry from './src/pages/PipeListsQueue';
      window.__fixtureCounters={shell:0,workspace:0,auth:0,config:0,fetch:0};
      window.fetch=async()=>{window.__fixtureCounters.fetch++;throw Error('Unexpected fixture request')};
      const Entry=location.pathname==='/PipeListsQueue'?QueueEntry:WorkspaceEntry;
      createRoot(document.getElementById('root')).render(<App Component={Entry} pageProps={{}} router={{pathname:location.pathname}}/>);
    `, resolveDir: process.cwd(), sourcefile: 'runtime-entry-fixture.tsx', loader: 'tsx' },
    bundle: true, outfile: path.join(directory, 'bundle.js'), platform: 'browser',
    define: { 'process.env.NEXT_PUBLIC_PIPELISTS_PRODUCTION_BUILD': JSON.stringify(String(productionBuild)) },
    plugins: [{ name: 'isolated-services', setup(build) {
      const mocks = {
        'next/head': 'export default function Head(){return null}',
        'next/router': 'export function useRouter(){return {isReady:true,query:{listId:"synthetic-list"}}}',
        'firebase/auth': 'window.__fixtureCounters.auth++;export function onAuthStateChanged(){throw Error("Unexpected auth initialization")}',
        config: 'window.__fixtureCounters.config++;export const simpBudgetAuth={}',
        workspace: 'window.__fixtureCounters.workspace++;export default function Workspace(){throw Error("Unexpected workspace initialization")}',
        shell: 'window.__fixtureCounters.shell++;export default function Shell(){throw Error("Unexpected application shell initialization")}',
        style: '',
      };
      build.onResolve({ filter: /^(next\/(head|router)|firebase\/auth)$/ }, args => ({ path: args.path, namespace: 'isolated-services' }));
      build.onResolve({ filter: /\/api\/firebase\/simpBudgetConfig$/ }, () => ({ path: 'config', namespace: 'isolated-services' }));
      build.onResolve({ filter: /\/features\/PipeListsWorkspace$/ }, () => ({ path: 'workspace', namespace: 'isolated-services' }));
      build.onResolve({ filter: /\/components\/ApplicationShell$/ }, () => ({ path: 'shell', namespace: 'isolated-services' }));
      build.onResolve({ filter: /\.css$/ }, () => ({ path: 'style', namespace: 'isolated-services' }));
      build.onLoad({ filter: /.*/, namespace: 'isolated-services' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }],
  });
  const server = http.createServer(async (request, response) => {
    if (request.url === '/bundle.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await fs.readFile(path.join(directory, 'bundle.js')));
    } else {
      response.setHeader('Content-Type', 'text/html');
      // CSP is an extra independent barrier: this fixture never connects to APIs.
      response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; connect-src 'none'");
      response.end('<!doctype html><html><head><title>Isolated runtime guard fixture</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const outsideRequests = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    outsideRequests.push(route.request().url());
    return route.abort();
  });
  return { page, origin, outsideRequests };
}

for (const productionBuild of [false, true]) {
  test(`${productionBuild ? 'copied production' : 'nonproduction'} bundle blocks workspace and queue entry before services, including reload and history`, async t => {
    const { page, origin, outsideRequests } = await fixture(t, productionBuild);
    const verify = async route => {
      await page.getByRole('heading', { name: route === '/PipeListsQueue' ? 'Email queue' : 'PipeLists', exact: true }).waitFor();
      if (route === '/PipeListsQueue') await page.getByRole('alert').filter({ hasText: 'disabled outside' }).waitFor();
      else await page.getByText('PipeLists is available only on the production site. Development and preview sessions cannot connect to its services.', { exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.__fixtureCounters), { shell: 0, workspace: 0, auth: 0, config: 0, fetch: 0 });
      assert.equal(await page.getByRole('button').count(), 0);
    };
    await page.goto(`${origin}/PipeLists`);
    await verify('/PipeLists');
    await page.goto(`${origin}/PipeListsQueue`);
    await verify('/PipeListsQueue');
    await page.reload();
    await verify('/PipeListsQueue');
    await page.goBack();
    await verify('/PipeLists');
    await page.goForward();
    await verify('/PipeListsQueue');
    assert.deepEqual(outsideRequests, []);
    if (process.env.PIPELISTS_UI_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.PIPELISTS_UI_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.PIPELISTS_UI_SCREENSHOT_DIR, `runtime-${productionBuild ? 'copied-production' : 'nonproduction'}-blocked.png`), fullPage: true });
    }
  });
}
