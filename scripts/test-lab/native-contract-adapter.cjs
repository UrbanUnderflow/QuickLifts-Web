'use strict';
// Local contract evidence only: production handlers/auth/storage/normalization,
// emulator persistence, and explicit deterministic model-transport doubles.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PROJECT } = require('./emulator-fixtures.cjs');
const functions = path.resolve(__dirname, '../../netlify/functions');
const storage = require('../../netlify/functions/utils/noraStoragePolicy');
const guards = require('../../netlify/functions/lib/account-closure-guard');
const policy = require('../../netlify/functions/utils/noraEngagementPolicy');
const contract = require('../../netlify/functions/lib/skill-reflection/v1');

function modelResponse(content) {
  return { ok: true, status: 200, statusText: 'OK', headers: new Headers({'Content-Type':'application/json'}),
    json: async () => ({ choices: [{ message: { content } }] }), text: async () => content };
}

function createNativeContractAdapter({app, admin, runtime}) {
  if (app.options.projectId !== PROJECT) throw Error('Native contracts require the isolated demo project.');
  for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
    if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/.test(process.env[key] || '')) throw Error('Native contracts require loopback emulators.');
  }
  const evidence = 'production-handlers; emulator-auth-and-firestore; deterministic-model-transport; no-provider-or-delivery';
  const nativeStorage = { ...storage, assessNoraStorage: value => storage.assessNoraStorage(value, {
    apiKey: 'synthetic-only', fetchImpl: async () => modelResponse('{"decision":"ordinary"}'),
  }) };
  const nativeRuntime = { ...runtime, classifyEscalation: (db, uid, message, history, id) => runtime.classifyEscalation(db, uid, message, history, id, {
    conditions: [], requestClassification: async () => modelResponse(JSON.stringify({tier:0, category:'none', reason:'Deterministic local fixture', confidence:1, shouldEscalate:false})),
  }) };
  const dependencies = {
    './config/firebase': { getFirebaseAdminApp: () => app, initializeFirebaseAdmin: () => app, admin, headers: {} },
    './pulsecheck-chat': { runtimeHelpers: nativeRuntime },
    './lib/account-closure-guard': guards,
    './utils/noraStoragePolicy': nativeStorage,
    './utils/noraEngagementPolicy': policy,
    './utils/pulsecheck-youth-track': require('../../netlify/functions/utils/pulsecheck-youth-track'),
    './lib/skill-reflection/v1': contract,
    './journal-safety-screen': { escalateJournalClassification: async () => { throw Error('External delivery is disabled in Test Lab.'); } },
  };
  const files = ['nora-save-conversation.js', 'skill-reflection.js'];
  const sources = files.map(file => fs.readFileSync(path.join(functions, file), 'utf8'));
  const handlers = sources.map(source => {
    const exports = {};
    new Function('require', 'exports', 'fetch', source)(name => {
      if (!Object.hasOwn(dependencies, name)) throw Error(`Unreviewed native contract dependency: ${name}`);
      return dependencies[name];
    }, exports, async url => {
      if (url !== 'https://api.openai.com/v1/chat/completions') throw Error('Unexpected model transport.');
      return modelResponse('What did you notice while you practiced that action?');
    });
    return exports.handler;
  });
  const kind = url => url.endsWith('/nora-save-conversation') ? 0 : url.endsWith('/skill-reflection') ? 1 : -1;
  return {
    evidence,
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).update(sources.join('\n')).digest('hex'),
    supports: url => kind(url) >= 0,
    async handle(url, event) {
      const index = kind(url);
      if (index < 0) throw Error('Unsupported native contract.');
      // Only the transient, registry-authorized preview is in scope. Production
      // reflection delivery/journal flows must never be silently simulated.
      if (index === 1 && (event.headers?.['x-athleticmind-internal'] || JSON.parse(event.body || '{}').preview !== true)) {
        return {statusCode:501,body:JSON.stringify({error:'Only isolated, authorized reflection previews are supported.'})};
      }
      return handlers[index](event);
    },
  };
}
module.exports = { createNativeContractAdapter };
