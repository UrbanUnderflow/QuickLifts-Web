const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

for (const provider of ['whoop', 'oura', 'polar', 'google-health']) {
  test(`${provider} returns to AthleticMind while preserving redirect restrictions`, () => {
    const source = fs.readFileSync(path.join(__dirname, '../../netlify/functions', `${provider}-utils.js`), 'utf8');
    const sandbox = {
      require: (id) => id === 'crypto' ? require('node:crypto') : { headers: {} },
      module: { exports: {} }, process: { env: {} }, URL, Buffer, console,
    };
    vm.runInNewContext(source, sandbox);
    const { sanitizeReturnTo, DEFAULT_RETURN_TO } = sandbox.module.exports;
    assert.equal(sanitizeReturnTo('athleticmind://wearables?provider=test'), 'athleticmind://wearables?provider=test');
    assert.equal(sanitizeReturnTo('pulsecheck://wearables'), 'pulsecheck://wearables');
    assert.equal(sanitizeReturnTo('https://untrusted.example/'), DEFAULT_RETURN_TO);
    assert.equal(sanitizeReturnTo('javascript:alert(1)'), DEFAULT_RETURN_TO);
    assert.equal(sanitizeReturnTo('//untrusted.example/'), DEFAULT_RETURN_TO);
  });
}
