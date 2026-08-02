const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pagePath = path.resolve(
  __dirname,
  '../../../src/pages/PulseCheck/athlete-subscription-complete.tsx'
);
const source = fs.readFileSync(pagePath, 'utf8');

test('subscription success preserves the invite in the native post-checkout handoff', () => {
  assert.match(source, /inviteToken,/);
  assert.match(source, /checkoutComplete:\s*['"]1['"]/);
  assert.match(source, /resumeInvite:\s*['"]1['"]/);
  assert.match(source, /pulsecheck:\/\/open\?\$\{params\.toString\(\)\}/);
  assert.match(source, /I already have the app/);
  assert.match(source, /window\.location\.assign\(appOpenUrl\)/);
});

