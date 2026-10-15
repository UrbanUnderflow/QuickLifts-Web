'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { buildEnvironment, PROJECT_ID } = require('../../scripts/ci/build-isolated.cjs');
const { deploymentForBuild } = require('../../scripts/pipelists-deployment.cjs');

test('isolated build rejects inherited credentials, provenance, bypasses and runtime flags', () => {
  const env = buildEnvironment({
    PATH: '/synthetic/bin',
    HOME: '/private/home',
    FIREBASE_SERVICE_ACCOUNT: 'private-credential',
    STRIPE_SECRET_KEY: 'private-key',
    OPEN_AI_SECRET_KEY: 'private-key',
    GOOGLE_APPLICATION_CREDENTIALS: '/private/credential.json',
    NETLIFY: 'true', CONTEXT: 'production', URL: 'https://fitwithpulse.ai', SITE_ID: 'live', SITE_NAME: 'live',
    NEXT_PUBLIC_PIPELISTS_PRODUCTION_BUILD: 'true',
    NEXT_PUBLIC_DEV_AUTH_BYPASS: 'true',
    NEXT_PUBLIC_FIREBASE_EMULATORS: 'true',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'live-project',
    NODE_OPTIONS: '--require=/private/preload.cjs',
  });
  assert.equal(env.PATH, '/synthetic/bin');
  for (const name of ['HOME', 'GOOGLE_APPLICATION_CREDENTIALS', 'NETLIFY', 'CONTEXT', 'URL', 'SITE_ID', 'SITE_NAME', 'NEXT_PUBLIC_PIPELISTS_PRODUCTION_BUILD', 'NEXT_PUBLIC_DEV_AUTH_BYPASS', 'NEXT_PUBLIC_FIREBASE_EMULATORS']) assert.equal(env[name], undefined, name);
  assert.equal(env.STRIPE_SECRET_KEY, 'isolated-build-not-a-provider-key');
  assert.equal(env.OPEN_AI_SECRET_KEY, 'isolated-build-not-a-provider-key');
  assert.equal(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, PROJECT_ID);
  assert.equal(env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_PROJECT_ID, PROJECT_ID);
  assert.equal(env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID, PROJECT_ID);
  assert.deepEqual(deploymentForBuild(env), { production: false, siteId: '', siteName: '', url: '' });
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  assert.equal(account.project_id, PROJECT_ID);
  assert.equal(account.client_email, `isolated-build@${PROJECT_ID}.invalid`);
  assert.match(account.private_key, /BEGIN PRIVATE KEY/);
  assert.match(env.NODE_OPTIONS, /deny-build-network\.cjs/);
  assert.doesNotMatch(env.NODE_OPTIONS, /private/);
});

test('isolated build has no reusable credential between runs', () => {
  const first = JSON.parse(buildEnvironment({}).FIREBASE_SERVICE_ACCOUNT);
  const second = JSON.parse(buildEnvironment({}).FIREBASE_SERVICE_ACCOUNT);
  assert.notEqual(first.private_key, second.private_key);
});

test('network guard fails closed for sockets, fetch and DNS in Node workers', () => {
  const guard = path.resolve(__dirname, '../../scripts/ci/deny-build-network.cjs');
  const result = spawnSync(process.execPath, ['--require', guard, '-e', `
    const assert = require('node:assert/strict');
    const net = require('node:net');
    assert.throws(() => net.connect(443, 'example.invalid'), {code:'ENETUNREACH'});
    assert.throws(() => new net.Socket().connect(443, 'example.invalid'), {code:'ENETUNREACH'});
    (async () => {
      await assert.rejects(fetch('https://example.invalid'), {code:'ENETUNREACH'});
      await assert.rejects(require('node:dns').promises.lookup('example.invalid'), {code:'ENETUNREACH'});
      console.log('All network attempts rejected');
    })().catch(error => {console.error(error);process.exitCode=1});
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /All network attempts rejected/);
});
