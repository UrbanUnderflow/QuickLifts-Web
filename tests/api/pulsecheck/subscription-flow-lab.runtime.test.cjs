const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '../../..');
const pagePath = path.join(
  repoRoot,
  'src/pages/PulseCheck/subscription-flow-lab.tsx'
);

const readPage = () => {
  assert.equal(
    fs.existsSync(pagePath),
    true,
    'the development subscription Flow Lab page should exist'
  );
  return fs.readFileSync(pagePath, 'utf8');
};

const parsePage = (source) => ts.createSourceFile(
  pagePath,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

const visit = (node, callback) => {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
};

test('the Flow Lab is unavailable in production unless its server-only flag is enabled', () => {
  const source = readPage();

  assert.match(
    source,
    /export\s+const\s+getServerSideProps\s*(?::[^=]+)?=/,
    'the lab should make its availability decision on the server for every request'
  );
  assert.match(
    source,
    /process\.env\.NODE_ENV\s*===\s*['"]production['"]/,
    'the server gate should explicitly identify production'
  );
  assert.match(
    source,
    /process\.env\.PULSECHECK_FLOW_LAB_ENABLED\s*(?:===|!==)\s*['"]true['"]/,
    'production access should require PULSECHECK_FLOW_LAB_ENABLED=true'
  );
  const directDenyGuard = /if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]\s*&&\s*process\.env\.PULSECHECK_FLOW_LAB_ENABLED\s*!==\s*['"]true['"]\s*\)\s*(?:\{\s*)?return\s*\{\s*notFound\s*:\s*true/.test(source);
  const enabledDeclaration = source.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*process\.env\.PULSECHECK_FLOW_LAB_ENABLED\s*===\s*['"]true['"]/
  );
  const productionDeclaration = source.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]/
  );
  const derivedDenyGuard = enabledDeclaration && productionDeclaration
    ? new RegExp(
        `if\\s*\\(\\s*${productionDeclaration[1]}\\s*&&\\s*!${enabledDeclaration[1]}\\s*\\)\\s*(?:\\{\\s*)?return\\s*\\{\\s*notFound\\s*:\\s*true`
      ).test(source)
    : false;
  assert.ok(
    directDenyGuard || derivedDenyGuard,
    'production requests should return a 404 whenever the server flag is not exactly true'
  );
  assert.match(
    source,
    /notFound\s*:\s*true/,
    'a disabled production lab should resolve as a 404'
  );
  assert.doesNotMatch(
    source,
    /NEXT_PUBLIC_PULSECHECK_FLOW_LAB_ENABLED/,
    'the enable switch should remain server-only instead of being bundled for browsers'
  );
});

test('the Flow Lab remains a local simulation with no Firebase, Stripe, or network writes', () => {
  const source = readPage();
  const tree = parsePage(source);
  const unsafeImports = [];
  const unsafeCalls = [];
  const unsafeJsxActions = [];
  const forbiddenCallNames = new Set([
    'fetch',
    'addDoc',
    'setDoc',
    'updateDoc',
    'deleteDoc',
    'writeBatch',
    'runTransaction',
    'createCheckoutSession',
    'redirectToCheckout',
  ]);

  visit(tree, (node) => {
    if (
      ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && /(?:firebase|stripe|axios)/i.test(node.moduleSpecifier.text)
      && node.importClause?.isTypeOnly !== true
    ) {
      unsafeImports.push(node.moduleSpecifier.text);
    }

    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression)
        && forbiddenCallNames.has(node.expression.text)
      ) {
        unsafeCalls.push(node.expression.text);
      }

      if (
        ts.isPropertyAccessExpression(node.expression)
        && ['fetch', 'sendBeacon'].includes(node.expression.name.text)
      ) {
        unsafeCalls.push(node.expression.getText(tree));
      }

      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.some((argument) =>
          ts.isStringLiteral(argument)
          && /(?:firebase|stripe|axios)/i.test(argument.text)
        )
      ) {
        unsafeCalls.push('dynamic service import');
      }
    }

    if (
      ts.isNewExpression(node)
      && ts.isIdentifier(node.expression)
      && ['XMLHttpRequest', 'WebSocket', 'EventSource'].includes(node.expression.text)
    ) {
      unsafeCalls.push(`new ${node.expression.text}`);
    }

    if (
      ts.isJsxAttribute(node)
      && ['action', 'formAction'].includes(node.name.text)
    ) {
      unsafeJsxActions.push(node.name.text);
    }
  });

  assert.deepEqual(
    unsafeImports,
    [],
    `the lab should not load Firebase, Stripe, or HTTP clients: ${unsafeImports.join(', ')}`
  );
  assert.deepEqual(
    unsafeCalls,
    [],
    `the lab should not call persistence, checkout, or network APIs: ${unsafeCalls.join(', ')}`
  );
  assert.deepEqual(
    unsafeJsxActions,
    [],
    'the lab should not submit a form to a server'
  );
  assert.doesNotMatch(
    source,
    /(?:\/\.netlify\/functions\/|['"]\/api\/)/,
    'the simulation should not reference application mutation endpoints'
  );
});

test('the Flow Lab exercises the shared commercialization and invite-link rules', () => {
  const source = readPage();
  const tree = parsePage(source);
  const imports = new Map();

  for (const statement of tree.statements) {
    if (
      !ts.isImportDeclaration(statement)
      || !ts.isStringLiteral(statement.moduleSpecifier)
      || !statement.importClause?.namedBindings
      || !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }

    imports.set(
      statement.moduleSpecifier.text,
      statement.importClause.namedBindings.elements.map((element) => element.name.text)
    );
  }

  const commercializationImport = [...imports.entries()].find(([specifier]) =>
    specifier.endsWith('/utils/pulsecheckCommercialization')
  );
  const inviteImport = [...imports.entries()].find(([specifier]) =>
    specifier.endsWith('/utils/pulsecheckInviteLinks')
  );

  assert.ok(
    commercializationImport,
    'the lab should import the production commercialization rules'
  );
  assert.ok(
    inviteImport,
    'the lab should import the production invite-link builders'
  );

  const commercializationHelpers = commercializationImport[1];
  const inviteHelpers = inviteImport[1];
  assert.ok(
    commercializationHelpers.some((name) => [
      'formatPulseCheckMonthlyPrice',
      'isPulseCheckCoachPricedAthleteOfferActive',
      'normalizePulseCheckMonthlyPriceCents',
    ].includes(name) && source.match(new RegExp(`\\b${name}\\b`, 'g'))?.length >= 2),
    'at least one shared commercialization helper should drive the simulation'
  );
  assert.ok(
    inviteHelpers.some((name) => [
      'buildPulseCheckAthleteOfferWebUrl',
      'buildPulseCheckTeamInviteWebUrl',
      'buildPulseCheckTeamInviteOneLink',
    ].includes(name) && source.match(new RegExp(`\\b${name}\\b`, 'g'))?.length >= 2),
    'at least one shared invite helper should drive the simulated athlete link'
  );
});

test('the Flow Lab covers requested outcomes and a restartable coach-to-athlete journey', () => {
  const source = readPage();

  for (const scenario of [
    'successful payment',
    'cancelled payment',
    'pending activation',
    'declined payment',
    'offer paused after link issued',
  ]) {
    assert.match(
      source,
      new RegExp(scenario, 'i'),
      `the lab should expose the ${scenario} scenario`
    );
  }

  assert.match(
    source,
    /reset(?:Flow|Lab|Journey|Simulation|Scenario)|reset (?:flow|lab|journey|simulation|scenario)/i,
    'the lab should provide a clear reset action'
  );
  assert.match(
    source,
    /coach (?:setup|view|experience|step)/i,
    'the journey should begin with a coach-facing setup step'
  );
  assert.match(
    source,
    /athlete (?:landing|offer|checkout|purchase|view|experience|step)/i,
    'the journey should include the athlete-facing purchase path'
  );
  assert.match(
    source,
    /(?:continue|open|preview|switch|start|share)[^\n]{0,80}athlete/i,
    'the coach view should include an explicit transition into the athlete flow'
  );
});

test('the Flow Lab makes cancelled and paused-offer product decisions visible', () => {
  const source = readPage();

  assert.match(
    source,
    /type\s+Preset[\s\S]*['"]paused-after-link['"][\s\S]*['"]Offer paused after link issued['"]/,
    'the paused-after-sharing state should be a selectable first-class lab preset'
  );
  assert.match(
    source,
    /pausedAfterIssue\s*\?\s*\([\s\S]{0,700}<DecisionCard[\s\S]{0,700}Current behavior/,
    'the paused-offer dead end should show its current behavior inside a decision card'
  );
  assert.match(
    source,
    /checkoutScenario\s*===\s*['"]cancelled payment['"][\s\S]{0,700}<DecisionCard[\s\S]{0,700}Current behavior/,
    'cancelled checkout should show its current behavior inside a decision card'
  );
  assert.match(
    source,
    /const\s+DecisionCard[\s\S]{0,700}Decision needed/,
    'decision cards should visibly label the open product decision'
  );
});

test('the Flow Lab primary invite is a reloadable same-route preview link', () => {
  const source = readPage();

  assert.doesNotMatch(
    source,
    /flow-lab\.local/i,
    'the lab should never render a synthetic hostname that reviewers cannot open'
  );
  assert.match(
    source,
    /\/PulseCheck\/subscription-flow-lab/,
    'the primary generated link should point back to the real Flow Lab route'
  );
  assert.match(
    source,
    /preview[\s\S]{0,80}athlete/i,
    'the same-route link should identify the athlete preview'
  );
  assert.match(
    source,
    /data-testid=['"]flow-lab-preview-url['"]/,
    'the working preview link should have a stable browser-test hook'
  );
  assert.match(
    source,
    /data-testid=['"]flow-lab-preview-price['"]/,
    'a directly loaded preview should expose its hydrated price for review'
  );
  assert.match(
    source,
    /data-testid=['"]flow-lab-production-url-example['"]/,
    'the production URL shape should be separately identifiable'
  );
  assert.match(
    source,
    /Production URL example|Example only/i,
    'the production-shaped URL should be visibly described as an example'
  );
});
