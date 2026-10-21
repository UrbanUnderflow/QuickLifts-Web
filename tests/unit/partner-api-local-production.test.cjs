const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function rewrites(env) {
  const context = {
    module: { exports: {} },
    process: { env },
    require(name) {
      assert.equal(name, './scripts/pipelists-deployment.cjs');
      return { writePipeListsDeployment: () => ({ production: env.NODE_ENV === 'production' }) };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../next.config.js'), 'utf8'), context);
  return (await context.module.exports.rewrites()).beforeFiles.filter(rule => rule.source.includes('partner-api'));
}

test('production partner forwarding requires an explicit development-only opt-in', async () => {
  for (const env of [
    { NODE_ENV: 'production', LOCAL_PARTNER_API_USE_PRODUCTION: 'true' },
    { NODE_ENV: 'test', LOCAL_PARTNER_API_USE_PRODUCTION: 'true' },
    { NODE_ENV: 'development' },
    { NODE_ENV: 'development', LOCAL_PARTNER_API_USE_PRODUCTION: 'false' },
  ]) assert.equal((await rewrites(env)).length, 0);
});

test('local forwarding targets only the fixed production partner admin endpoint', async () => {
  const rules = await rewrites({ NODE_ENV: 'development', LOCAL_PARTNER_API_USE_PRODUCTION: 'true' });
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, '/api/admin/partner-api-keys');
  assert.equal(rules[0].destination, 'https://fitwithpulse.ai/api/admin/partner-api-keys');
});
