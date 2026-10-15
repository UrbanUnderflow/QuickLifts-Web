'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { generateKeyPairSync } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-pipelists-ci';
const DIST_DIR = '.next-isolated-build';

function buildEnvironment(source = process.env) {
  // Do not inherit credentials, production provenance, auth bypasses, or provider
  // configuration. The only inherited values locate this Node installation.
  const env = {};
  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'TMP', 'TEMP', 'TMPDIR']) {
    if (source[name]) env[name] = source[name];
  }
  Object.assign(env, {
    CI: 'true',
    NODE_ENV: 'production',
    NODE_OPTIONS: `--max-old-space-size=4096 --require=${path.join(__dirname, 'deny-build-network.cjs')}`,
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_DIST_DIR: DIST_DIR,
    // Next14 uses this supported worker-count input; keep static generation
    // bounded as well as isolating webpack compiler phases in next.config.js.
    CIRCLE_NODE_TOTAL: '3',
    FIREBASE_PROJECT_ID: PROJECT_ID,
    DEV_FIREBASE_PROJECT_ID: PROJECT_ID,
    // Legacy API modules construct these clients while Next inspects routes.
    // Invalid fixture strings satisfy constructors without provider access.
    OPEN_AI_SECRET_KEY: 'isolated-build-not-a-provider-key',
    STRIPE_SECRET_KEY: 'isolated-build-not-a-provider-key',
  });
  const config = {
    API_KEY: 'ci-demo-api-key',
    AUTH_DOMAIN: `${PROJECT_ID}.invalid`,
    PROJECT_ID,
    STORAGE_BUCKET: `${PROJECT_ID}.invalid`,
    MESSAGING_SENDER_ID: '123456789012',
    APP_ID: '1:123456789012:web:abcdef123456',
  };
  for (const prefix of ['NEXT_PUBLIC_FIREBASE_', 'NEXT_PUBLIC_DEV_FIREBASE_', 'NEXT_PUBLIC_SIMPBUDGET_FIREBASE_']) {
    for (const [name, value] of Object.entries(config)) env[`${prefix}${name}`] = value;
  }
  // Existing server entry points validate an Admin certificate at import time.
  // This fresh, unregistered key has no account or permissions and is never saved
  // or transmitted. It allows syntax/import validation without real secrets.
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const account = JSON.stringify({
    project_id: PROJECT_ID,
    client_email: `isolated-build@${PROJECT_ID}.invalid`,
    private_key: privateKey,
  });
  env.FIREBASE_SERVICE_ACCOUNT = account;
  env.DEV_FIREBASE_SERVICE_ACCOUNT = account;
  return env;
}

function main() {
  const root = path.resolve(__dirname, '../..');
  // Next automatically loads these, so fail rather than silently loading local
  // service settings after the environment above has been sanitized.
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    assert.equal(fs.existsSync(path.join(root, name)), false, `Remove ${name} before isolated build verification`);
  }
  const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], {
    cwd: root,
    env: buildEnvironment(),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/pipelists-deployment.json'), 'utf8'));
  assert.deepEqual(provenance, { production: false, siteId: '', siteName: '', url: '' });
  assert.ok(fs.readFileSync(path.join(root, DIST_DIR, 'BUILD_ID'), 'utf8').trim(), 'Build must finish, including page generation');
  const html = fs.readFileSync(path.join(root, DIST_DIR, 'server/pages/404.html'), 'utf8');
  assert.match(html, /<meta[^>]*property="og:site_name"[^>]*content="Pulse Intelligence Labs"/, 'Async application shell must preserve server-rendered metadata');
  console.log('Full optimized build completed with synthetic configuration and Node TCP/fetch/DNS blocked. Not a deployment artifact.');
}

module.exports = { buildEnvironment, DIST_DIR, PROJECT_ID };
if (require.main === module) main();
