const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');

const topLevelMatchBlock = (collection, variable) => {
  const marker = `    match /${collection}/{${variable}} {`;
  const start = rules.indexOf(marker);
  assert.notEqual(start, -1, `${collection} must have a dedicated rules block`);
  const next = rules.indexOf('\n    match /', start + marker.length);
  return rules.slice(start, next === -1 ? rules.length : next);
};

test('athlete app commercialization collections cannot use the signed-in fallback', () => {
  const explicitStart = rules.indexOf('function isExplicitlyRuledCollection(collectionName)');
  const explicitEnd = rules.indexOf('// PulseCheck provisioning helpers', explicitStart);
  const explicitBlock = rules.slice(explicitStart, explicitEnd);

  for (const collection of [
    'pulsecheck-athlete-app-checkout-locks',
    'pulsecheck-athlete-app-checkouts',
    'pulsecheck-athlete-app-commercialization',
    'pulsecheck-athlete-app-entitlements',
    'pulsecheck-athlete-app-invite-checkout-locks',
    'pulsecheck-athlete-app-offers',
    'pulsecheck-athlete-app-revenue-events',
  ]) {
    assert.match(
      explicitBlock,
      new RegExp(`'${collection}'`),
      `${collection} must be excluded from the compatibility fallback`
    );
  }
});

test('every commercialization record is invisible and immutable to client SDKs', () => {
  for (const [collection, variable] of [
    ['pulsecheck-athlete-app-offers', 'offerId'],
    ['pulsecheck-athlete-app-entitlements', 'entitlementId'],
    ['pulsecheck-athlete-app-revenue-events', 'eventId'],
    ['pulsecheck-athlete-app-checkouts', 'checkoutId'],
    ['pulsecheck-athlete-app-checkout-locks', 'lockId'],
    ['pulsecheck-athlete-app-invite-checkout-locks', 'lockId'],
    ['pulsecheck-athlete-app-commercialization', 'documentId'],
  ]) {
    const block = topLevelMatchBlock(collection, variable);
    assert.match(block, /allow read, create, update, delete: if false;/);
    assert.doesNotMatch(
      block,
      /isAdminUser|pcCan|request\.auth|isSignedIn/,
      `${collection} must only be reachable through trusted server code`
    );
  }
});
