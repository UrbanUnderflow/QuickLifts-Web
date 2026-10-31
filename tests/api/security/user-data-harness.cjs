const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');

function harness({ profile = {}, follow = null, privateAccount = false } = {}) {
  const calls = { reads: [], writes: [], tokens: [], stripe: [] };
  const reference = (parts = []) => ({
    id: 'generated-id',
    collection(name) { return reference([...parts, name]); },
    doc(id) { return reference([...parts, id || 'generated-id']); },
    orderBy() { return this; }, limit() { return this; },
    async get() {
      calls.reads.push(parts.join('/'));
      if (parts[0] === 'pulsecheck-private-users') return { exists: privateAccount };
      if (parts[0] === 'followRequests') return { exists: !!follow, data: () => follow };
      if (parts.length === 2) return { exists: true, data: () => profile };
      return { empty: true, docs: [] };
    },
    async set(data) { calls.writes.push({ path: parts.join('/'), data }); },
  });
  const db = reference();
  const admin = {
    auth: () => ({ async verifyIdToken(token, revoked) {
      calls.tokens.push({ token, revoked });
      if (['expired', 'revoked', 'wrong-project'].includes(token)) throw Error('invalid token');
      return token === 'missing-uid' ? {} : { uid: token };
    } }),
    firestore: () => db,
  };
  admin.firestore.FieldValue = { serverTimestamp: () => 'timestamp' };
  const config = { admin, db, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  } };
  function load(file, dependencies) {
    const exports = {};
    const context = { exports, module: { exports }, process: { env: { STRIPE_SECRET_KEY: 'synthetic' } }, console: { log() {}, error() {} },
      require(name) { if (!(name in dependencies)) throw Error(`Unexpected import: ${name}`); return dependencies[name]; } };
    vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    return context.module.exports;
  }
  const helper = load('netlify/functions/config/require-user.js', { './firebase': config });
  return { calls, helper, handler(name) {
    return load(`netlify/functions/${name}.js`, {
      './config/firebase': config, './config/require-user': helper,
      stripe: () => ({ paymentIntents: { async list(args) { calls.stripe.push(args); return { data: [] }; } } }),
    }).handler;
  } };
}

module.exports = { harness };
