const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
const { deploymentForBuild } = require('../../../scripts/pipelists-deployment.cjs');
const production = { NODE_ENV: 'production', SITE_ID: 'synthetic-site-id', SITE_NAME: 'synthetic-site-name', URL: 'https://fitwithpulse.ai' };
const productionBuild = { ...production, NETLIFY: 'true', CONTEXT: 'production' };
const productionMarker = deploymentForBuild(productionBuild);
const blockedEnvironments = [
  {},
  { NODE_ENV: 'development', CONTEXT: 'production' },
  { NODE_ENV: 'test', CONTEXT: 'production' },
  { NODE_ENV: 'production' },
  { NODE_ENV: 'production', CONTEXT: 'dev' },
  { NODE_ENV: 'production', CONTEXT: 'deploy-preview' },
  { NODE_ENV: 'production', CONTEXT: 'branch-deploy' },
  { NODE_ENV: 'production', CONTEXT: 'unknown' },
  { ...production, NETLIFY_LOCAL: 'true' },
  { ...production, NETLIFY_PREVIEW_SERVER: 'true' },
  { ...production, CONTEXT: 'deploy-preview' },
  { ...production, SITE_ID: 'different-site' },
  { ...production, SITE_NAME: 'different-site-name' },
  { ...production, URL: 'http://fitwithpulse.ai' },
];

// Nothing in this loader can access a real client, credential source, or network.
// Pure local modules execute normally; external service modules are inert probes.
function sandbox(env, overrides = {}) {
  const cache = new Map();
  const effects = [];
  const imports = [];
  const fail = label => (..._args) => { effects.push(label); throw new Error(`Forbidden service effect: ${label}`); };
  const forbiddenServices = {
    getSimpBudgetFirestore: fail('firestore initialization'),
    getSimpBudgetAuth: fail('auth initialization'),
  };
  function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = fs.readFileSync(filename, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    const localRequire = name => {
      imports.push(name);
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === '../generated/pipelists-deployment.json') return productionMarker;
      if (/getSimpBudgetServiceAccount$/.test(name)) return forbiddenServices;
      if (/emailSequenceHelpers$|getServiceAccount$|api\/firebase\//.test(name)) return fail(`eager import ${name}`)();
      if (name === 'firebase-admin/firestore') return { FieldValue: { serverTimestamp: fail('server timestamp') } };
      if (name === 'jsdom') return { JSDOM: fail('DOM initialization') };
      if (name === 'crypto') return require('node:crypto');
      if (name.endsWith('.css')) return {};
      if (name.startsWith('.')) {
        let resolved = path.resolve(path.dirname(filename), name);
        if (!path.extname(resolved)) resolved += fs.existsSync(`${resolved}.ts`) ? '.ts' : '.tsx';
        return load(resolved);
      }
      return fail(`unmocked import ${name}`)();
    };
    vm.runInNewContext(code, {
      module, exports: module.exports, require: localRequire,
      process: { env: { ...env, BREVO_API_KEY: 'synthetic-provider-key', SIMPBUDGET_FIREBASE_PROJECT_ID: 'synthetic-production-credentials-present' } },
      console, URL, Date, Intl, Set, AbortController, AbortSignal,
      fetch: fail('network'), setTimeout, clearTimeout,
      ...(overrides.__globals || {}),
    }, { filename });
    return module.exports;
  }
  return { load, effects, imports };
}

function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(status) { this.statusCode = status; return this; }, json(body) { this.body = body; return this; } };
}

test('only explicitly verified production runtime is enabled', () => {
  const { isPipeListsProductionRuntime } = sandbox({}).load('src/utils/pipelistsRuntime.ts');
  assert.equal(isPipeListsProductionRuntime(production), true);
  for (const env of blockedEnvironments) assert.equal(isPipeListsProductionRuntime(env), false, JSON.stringify(env));
});

test('all PipeLists API entry points deny nonproduction before auth, clients, stores, or network', async () => {
  const apis = fs.readdirSync(path.join(root, 'src/pages/api/pipelists')).filter(name => name.endsWith('.ts'));
  assert.ok(apis.includes('stage-migration.ts'));
  for (const env of blockedEnvironments) {
    for (const api of apis) {
      const run = sandbox(env);
      const handler = run.load(`src/pages/api/pipelists/${api}`).default;
      const res = response();
      await handler({ method: 'POST', headers: { host: 'fitwithpulse.ai', authorization: 'Bearer synthetic-token' }, body: {}, query: {} }, res);
      assert.equal(res.statusCode, 503, `${api} ${JSON.stringify(env)}`);
      assert.equal(res.body.code, 'PIPELISTS_NON_PRODUCTION_BLOCKED');
      assert.deepEqual(run.effects, []);
    }
  }
});

test('production API runtime rejects missing, local, preview, deceptive hosts and untrusted origins', async () => {
  const headers = [
    {}, { host: 'localhost:3000' }, { host: '127.0.0.1' }, { host: 'preview--pulse.netlify.app' },
    { host: 'fitwithpulse.ai.evil.example' }, { host: 'fitwithpulse.ai:3000' },
    { host: ['fitwithpulse.ai'] }, { host: 'fitwithpulse.ai', origin: 'https://deploy-preview--pulse.netlify.app' },
    { host: 'fitwithpulse.ai', origin: 'null' }, { host: 'fitwithpulse.ai', origin: 'http://fitwithpulse.ai' },
  ];
  for (const value of headers) {
    const run = sandbox(production);
    const handler = run.load('src/pages/api/pipelists/runbook.ts').default;
    const res = response();
    await handler({ method: 'GET', headers: { ...value, authorization: 'Bearer synthetic-token' }, query: {} }, res);
    assert.equal(res.statusCode, 503, JSON.stringify(value));
    assert.deepEqual(run.effects, []);
  }
});

test('production boundary permits the canonical host and same-origin request without adding service effects', () => {
  const run = sandbox(production);
  const { guardPipeListsApiRequest } = run.load('src/utils/pipelistsRuntime.ts');
  for (const host of ['fitwithpulse.ai', 'www.fitwithpulse.ai', 'fitwithpulse.ai:443']) {
    assert.equal(guardPipeListsApiRequest({ headers: { host, origin: 'https://fitwithpulse.ai' } }, response()), true);
  }
  assert.deepEqual(run.effects, []);
});

test('both scheduled functions deny previews and local/test contexts before importing services', async () => {
  for (const env of blockedEnvironments) {
    for (const file of ['pipelists-email-sequences', 'pipelists-deadline-reminders']) {
      const run = sandbox(env);
      const result = await run.load(`netlify/functions/${file}.ts`).handler();
      assert.equal(result.statusCode, 503);
      assert.equal(JSON.parse(result.body).code, 'PIPELISTS_NON_PRODUCTION_BLOCKED');
      assert.deepEqual(run.effects, []);
      assert.equal(run.imports.some(name => /getSimpBudgetServiceAccount|emailSequenceHelpers|getServiceAccount|lib\/pipelistsEmailSequences/.test(name)), false);
    }
  }
});

test('production scheduler skips blocked jobs without starving unrelated sequences or overstating processed count', async () => {
  const called = [];
  const docs = ['university-1', 'university-2', 'university-3', 'university-4', 'eligible-1', 'eligible-2', 'eligible-3', 'eligible-4'].map(id => ({ id, data: () => ({ nextSendAt: '2000-01-01T00:00:00.000Z' }) }));
  const run = sandbox(production, {
    './utils/getSimpBudgetServiceAccount': { getSimpBudgetFirestore: async () => ({ collection: () => ({ where: () => ({ get: async () => ({ docs }) }) }) }) },
    './lib/pipelistsEmailSequences': { COLLECTION: 'synthetic-sequences', dispatchSequence: async (_db, id) => { called.push(id); return id.startsWith('university') ? null : { id }; } },
  });
  const result = await run.load('netlify/functions/pipelists-email-sequences.ts').handler();
  assert.deepEqual(called, docs.slice(0, 7).map(doc => doc.id));
  assert.deepEqual(JSON.parse(result.body), { processed: 3, skipped: 4, failed: 0 });
  assert.deepEqual(run.effects, []);
});

test('browser boundary denies all local, preview and unknown hosts even with a copied production build', () => {
  const { isPipeListsProductionBrowser } = sandbox({ NEXT_PUBLIC_PIPELISTS_PRODUCTION_BUILD: 'true' }).load('src/utils/pipelistsRuntime.ts');
  assert.equal(isPipeListsProductionBrowser(), false, 'SSR must not load the workspace');
  for (const host of ['localhost', '127.0.0.1', '::1', 'preview--pulse.netlify.app', 'fitwithpulse.ai.evil.example', 'unknown.example']) {
    assert.equal(isPipeListsProductionBrowser(host, 'https:'), false, host);
  }
  assert.equal(isPipeListsProductionBrowser('fitwithpulse.ai', 'http:'), false);
  assert.equal(isPipeListsProductionBrowser('fitwithpulse.ai', 'https:'), true);
  for (const flag of [undefined, 'false', '1']) {
    const guard = sandbox({ NEXT_PUBLIC_PIPELISTS_PRODUCTION_BUILD: flag }).load('src/utils/pipelistsRuntime.ts');
    assert.equal(guard.isPipeListsProductionBrowser('fitwithpulse.ai', 'https:'), false);
  }
});

test('PipeLists routes never evaluate the global shell; unrelated routes await it during SSR', async () => {
  let shellCalls = 0;
  const react = require('react');
  const { renderToReadableStream } = require('react-dom/server.browser');
  const shell = ({ Component, pageProps }) => react.createElement('section', { 'data-shell': 'ready' }, react.createElement(Component, pageProps));
  const run = sandbox({}, { react, 'next/head': () => null, '../components/ApplicationShell': { __esModule: true, get default() { shellCalls++; return shell; } } });
  const App = run.load('src/pages/_app.tsx').default;
  const Page = () => react.createElement('p', null, 'SSR page content');
  const render = async pathname => {
    const stream = await renderToReadableStream(react.createElement(App, { router: { pathname }, Component: Page, pageProps: {} }));
    await stream.allReady;
    return new Response(stream).text();
  };
  for (const pathname of ['/PipeLists', '/PipeListsQueue', '/pipelists/', '/PipeLists?test=1']) {
    assert.match(await render(pathname), /SSR page content/);
    assert.equal(shellCalls, 0);
  }
  const unrelated = await render('/PulseCheck');
  assert.equal(shellCalls, 1);
  assert.match(unrelated, /data-shell="ready"/);
  assert.match(unrelated, /SSR page content/);
  assert.deepEqual(run.effects, []);
});

test('blocked full workspace route runs its mount effect without importing Firebase or autosave workspace', async () => {
  for (const [flag, hostname] of [['false', 'fitwithpulse.ai'], ['true', 'localhost'], ['true', 'preview--pulse.netlify.app']]) {
    const effects = [];
    const react = { createElement: () => null, useState: value => [value, () => {}], useEffect: effect => effects.push(effect) };
    const run = sandbox({ NEXT_PUBLIC_PIPELISTS_PRODUCTION_BUILD: flag }, { react, __globals: { window: { location: { hostname, protocol: 'https:', port: '' } } } });
    const Page = run.load('src/pages/PipeLists.tsx').default;
    Page();
    effects.forEach(effect => effect());
    await Promise.resolve();
    assert.equal(run.imports.some(name => /PipeListsWorkspace|firebase/.test(name)), false);
    assert.deepEqual(run.effects, []);
  }
});

test('Next configuration never proxies PipeLists development APIs to production and ignores public override flags', async () => {
  const source = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8');
  for (const env of [...blockedEnvironments, production, productionBuild]) {
    const module = { exports: {} };
    vm.runInNewContext(source, { module, require: name => { assert.equal(name, './scripts/pipelists-deployment.cjs'); return { writePipeListsDeployment: () => deploymentForBuild(env) }; }, process: { env: { ...env, NEXT_PUBLIC_PIPELISTS_PRODUCTION_BUILD: 'true' } } });
    assert.equal(module.exports.env.NEXT_PUBLIC_PIPELISTS_PRODUCTION_BUILD, String(deploymentForBuild(env).production));
    const rewrites = await module.exports.rewrites();
    assert.equal(rewrites.beforeFiles.some(rule => /pipelists/i.test(rule.source) && /^https?:/.test(rule.destination)), false);
  }
});


test('a preview build sharing production service credentials and site identity remains disabled', () => {
  for (const context of ['deploy-preview', 'branch-deploy', 'dev', undefined, 'unknown']) {
    const marker = deploymentForBuild({ ...productionBuild, CONTEXT: context });
    const run = sandbox(production, { '../generated/pipelists-deployment.json': marker });
    assert.equal(run.load('src/utils/pipelistsRuntime.ts').isPipeListsProductionRuntime(), false);
  }
});

test('missing marker and copied production artifact fail closed locally, including next start after production build', () => {
  const missing = sandbox(production, { '../generated/pipelists-deployment.json': {} }).load('src/utils/pipelistsRuntime.ts');
  assert.equal(missing.isPipeListsProductionRuntime(), false);
  const compiled = sandbox(production).load('src/utils/pipelistsRuntime.ts');
  for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'development', ...production, CONTEXT: 'dev' }, { ...production, SITE_ID: undefined }, { ...production, URL: undefined }]) {
    assert.equal(compiled.isPipeListsProductionRuntime(env), false);
  }
  assert.equal(deploymentForBuild({ ...productionBuild, NODE_ENV: 'development' }).production, false);
  assert.equal(deploymentForBuild({ NODE_ENV: 'production' }).production, false);
});

test('bundled production guard works without build-only CONTEXT and rejects local copies', async () => {
  const esbuild = require('esbuild');
  const bundled = await esbuild.build({
    entryPoints: [path.join(root, 'src/utils/pipelistsRuntime.ts')], bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'synthetic-deployment-only', setup(build) {
      build.onResolve({ filter: /pipelists-deployment\.json$/ }, () => ({ path: 'synthetic-marker', namespace: 'synthetic' }));
      build.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: JSON.stringify(productionMarker), loader: 'json' }));
    } }],
  });
  for (const [env, allowed] of [[production, true], [{ NODE_ENV: 'production' }, false], [{ ...production, CONTEXT: 'deploy-preview' }, false]]) {
    const module = { exports: {} };
    vm.runInNewContext(bundled.outputFiles[0].text, { module, exports: module.exports, process: { env }, URL });
    assert.equal(module.exports.isPipeListsProductionRuntime(), allowed);
  }
});

test('bundled Next API and scheduled function embed the same provenance and gate before client effects', async () => {
  const esbuild = require('esbuild');
  for (const marker of [productionMarker, deploymentForBuild({ ...productionBuild, CONTEXT: 'deploy-preview' })]) {
    for (const entry of ['src/pages/api/pipelists/generate-leads.ts', 'netlify/functions/pipelists-email-sequences.ts']) {
      const bundled = await esbuild.build({
        entryPoints: [path.join(root, entry)], bundle: true, platform: 'node', format: 'cjs', write: false,
        // Next production compilation inlines NODE_ENV; function provenance may
        // not rely on this constant being a trustworthy deployment indicator.
        define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [{ name: 'synthetic-services-and-provenance', setup(build) {
          build.onResolve({ filter: /pipelists-deployment\.json$/ }, () => ({ path: 'marker', namespace: 'synthetic' }));
          build.onResolve({ filter: /utils\/getSimpBudgetServiceAccount$/ }, () => ({ path: 'database', namespace: 'synthetic' }));
          build.onResolve({ filter: /lib\/pipelistsEmailSequences$/ }, () => ({ path: 'sequences', namespace: 'synthetic' }));
          build.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => {
            if (args.path === 'marker') return { contents: JSON.stringify(marker), loader: 'json' };
            if (args.path === 'database') return { contents: 'exports.getSimpBudgetFirestore = async () => { globalThis.__effects.push("database"); return { collection: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }) }; };', loader: 'js' };
            return { contents: 'exports.COLLECTION = "synthetic-sequences"; exports.dispatchSequence = async () => { throw Error("No jobs should dispatch"); };', loader: 'js' };
          });
        } }],
      });
      const code = bundled.outputFiles[0].text;
      assert.doesNotMatch(code, /require\(["']\.\.\/generated\/pipelists-deployment\.json/);
      for (const [env, local] of [[production, false], [{ NODE_ENV: 'production' }, true]]) {
        const effects = [];
        const module = { exports: {} };
        vm.runInNewContext(code, { module, exports: module.exports, process: { env }, URL, console, Date, __effects: effects, fetch: () => { throw Error('No real network permitted'); } });
        const allowed = marker.production && !local;
        if (entry.includes('/api/')) {
          const res = response();
          await module.exports.default({ method: 'DELETE', headers: { host: 'fitwithpulse.ai' } }, res);
          assert.equal(res.statusCode, allowed ? 405 : 503);
          assert.deepEqual(effects, []);
        } else {
          const res = await module.exports.handler();
          assert.equal(res.statusCode, allowed ? 200 : 503);
          assert.deepEqual(effects, allowed ? ['database'] : []);
        }
      }
    }
  }
});

test('shared webhook denies preview PipeLists before all database initialization and preserves unrelated events', async () => {
  const generalWrites = [];
  const query = { where: () => query, limit: () => query, get: async () => ({ docs: [], empty: true }) };
  const database = { collection: name => ({ ...query, doc: id => ({
    get: async () => ({ exists: false, data: () => ({}) }),
    set: async data => generalWrites.push({ name, id, data }),
    update: async data => generalWrites.push({ name, id, data }),
  }) }) };
  const firestore = () => database;
  firestore.FieldValue = { increment: value => value, arrayUnion: value => value };
  const run = sandbox(production, {
    '../generated/pipelists-deployment.json': deploymentForBuild({ ...productionBuild, CONTEXT: 'deploy-preview' }),
    './config/firebase': { admin: { firestore } },
    './utils/mixpanelAnalytics': { MACRA_MIXPANEL_EVENTS: {}, safeTrackMacraWebOfferEvent: async () => {} },
    '../../src/lib/equityEmailDelivery': {},
  });
  const webhook = run.load('netlify/functions/brevo-email-webhook.ts');
  const custom = { pipeListsOwnerUid: 'synthetic-owner', pipeListsListId: 'synthetic-list', pipeListsItemIds: ['synthetic-item'], pipeListsSequenceId: 'synthetic-sequence', pipeListsSequenceStepId: 'synthetic-step' };
  for (const pipeListsEmailType of ['school-outreach', 'general-update', 'investor-update']) {
    const result = await webhook.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ event: 'opened', email: 'synthetic@example.test', 'message-id': 'synthetic-message', 'X-Mailin-custom': JSON.stringify({ ...custom, pipeListsEmailType }) }) });
    assert.equal(result.statusCode, 503, result.body);
  }
  assert.deepEqual(run.effects, []);
  assert.deepEqual(generalWrites, []);
  assert.equal(run.imports.some(name => /config\/firebase|getSimpBudgetServiceAccount|pipelistsEmailSequenceTracking/.test(name)), false);
  const unrelated = await webhook.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ event: 'opened', email: 'synthetic@example.test', 'message-id': 'synthetic-unrelated-message', 'X-Mailin-custom': JSON.stringify({ pilotAthleteCommunicationId: 'synthetic-pilot' }) }) });
  assert.equal(unrelated.statusCode, 200, unrelated.body);
  const updates = generalWrites.filter(write => write.name === 'pulsecheck-pilot-athlete-communications');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, 'synthetic-pilot');
  assert.equal(updates[0].data.lastEmailEvent, 'opened');
  assert.deepEqual(run.effects, []);
});


test('PipeLists custom-header variants, tags, malformed identifiable payloads and mixed batches reject before imports', async () => {
  const events = [
    { 'X-Mailin-custom': JSON.stringify({ pipeListsOwnerUid: 'synthetic-owner' }) },
    { 'x-mailin-custom': { pipeListsListId: 'synthetic-list' } },
    { 'X-Mailin-Custom': '{ "pipeListsListId": malformed' },
    { 'x-mailin-customs': JSON.stringify({ pipeListsSequenceId: 'synthetic-sequence' }) },
    { custom: { pipeListsEmailType: 'school-outreach' } },
    { headers: { 'X-Mailin-custom': JSON.stringify({ pipeListsListId: 'synthetic-list' }) } },
    { headers: { 'x-mailin-custom': { pipeListsItemIds: [] } } },
    { pipeListsListId: 'synthetic-list' },
    { tag: 'pipelists' }, { tag: 'SCHOOL-OUTREACH' }, { tags: ['unrelated', 'pipelists'] },
    { tags: 'unrelated,school-outreach' },
  ];
  for (const identifiable of events) {
    const run = sandbox(production, {
      '../generated/pipelists-deployment.json': { production: false },
      './utils/mixpanelAnalytics': { MACRA_MIXPANEL_EVENTS: {}, safeTrackMacraWebOfferEvent: async () => {} },
      '../../src/lib/equityEmailDelivery': {},
    });
    const webhook = run.load('netlify/functions/brevo-email-webhook.ts');
    const result = await webhook.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify([
      { event: 'opened', email: 'unrelated@example.test', 'message-id': 'unrelated' },
      { event: 'opened', email: 'synthetic@example.test', 'message-id': 'synthetic', ...identifiable },
    ]) });
    assert.equal(result.statusCode, 503, JSON.stringify(identifiable));
    assert.equal(JSON.parse(result.body).code, 'PIPELISTS_NON_PRODUCTION_BLOCKED');
    assert.equal(run.imports.some(name => /config\/firebase|getSimpBudgetServiceAccount|pipelistsEmailSequenceTracking/.test(name)), false);
    assert.deepEqual(run.effects, []);
  }
});

test('opaque nonproduction callbacks cannot initialize Firebase or look up stored metadata', async () => {
  for (const extra of [{}, { tag: 'unknown-campaign' }, { custom: { userId: 'synthetic-user' } }, { custom: { product: 'unknown', campaignId: 'unknown' } }]) {
    const run = sandbox(production, {
      '../generated/pipelists-deployment.json': { production: false },
      './utils/mixpanelAnalytics': { MACRA_MIXPANEL_EVENTS: {}, safeTrackMacraWebOfferEvent: async () => {} },
      '../../src/lib/equityEmailDelivery': {},
    });
    const webhook = run.load('netlify/functions/brevo-email-webhook.ts');
    const result = await webhook.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify([
      { event: 'opened', email: 'unrelated@example.test', custom: { pilotAthleteCommunicationId: 'synthetic-pilot' } },
      { event: 'opened', email: 'opaque@example.test', 'message-id': 'opaque-provider-message', ...extra },
    ]) });
    assert.equal(result.statusCode, 503);
    assert.equal(JSON.parse(result.body).code, 'WEBHOOK_NON_PRODUCTION_UNCLASSIFIED');
    assert.equal(run.imports.some(name => /config\/firebase|getSimpBudgetServiceAccount|pipelistsEmailSequenceTracking/.test(name)), false);
    assert.deepEqual(run.effects, []);
  }
});
