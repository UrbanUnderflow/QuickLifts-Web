const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const compileScopeModule = () => {
  const source = read('netlify/functions/utils/pulsecheckAthleteScope.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  Function('require', 'module', 'exports', output)(
    require,
    loaded,
    loaded.exports
  );
  return loaded.exports;
};

test('multi-team check-ins remain unscoped regardless of membership order', () => {
  const { selectUnambiguousAthleteScope } = compileScopeModule();
  const firstOrder = selectUnambiguousAthleteScope([
    { teamId: 'team-a', organizationId: 'org-a' },
    { teamId: 'team-b', organizationId: 'org-b' },
  ]);
  const reverseOrder = selectUnambiguousAthleteScope([
    { teamId: 'team-b', organizationId: 'org-b' },
    { teamId: 'team-a', organizationId: 'org-a' },
  ]);

  assert.deepEqual(firstOrder, {
    scope: null,
    warning: 'multiple_active_team_scopes',
    validScopeCount: 2,
  });
  assert.deepEqual(reverseOrder, firstOrder);
});

test('one exact live membership produces one coach-visible scope', () => {
  const { selectUnambiguousAthleteScope } = compileScopeModule();

  assert.deepEqual(
    selectUnambiguousAthleteScope([
      {
        teamId: ' team-a ',
        organizationId: ' org-a ',
        timezone: ' America/New_York ',
      },
    ]),
    {
      scope: {
        teamId: 'team-a',
        organizationId: 'org-a',
        timezone: 'America/New_York',
      },
      warning: null,
      validScopeCount: 1,
    }
  );
  assert.deepEqual(selectUnambiguousAthleteScope([]), {
    scope: null,
    warning: 'no_active_team_scope',
    validScopeCount: 0,
  });
});

test('both check-in writers use exact resolution and clear stale scope', () => {
  const resolver = read(
    'netlify/functions/utils/pulsecheckAthleteScope.ts'
  );
  const morning = read('netlify/functions/record-morning-checkin.ts');
  const evening = read('netlify/functions/record-evening-checkin.ts');

  assert.doesNotMatch(morning, /\.limit\(1\)/);
  assert.doesNotMatch(evening, /\.limit\(1\)/);
  for (const source of [morning, evening]) {
    assert.match(source, /resolveUnambiguousAthleteScope\(db, auth\.uid\)/);
    assert.match(source, /FieldValue\.delete\(\)/);
    assert.match(source, /scopeWarning/);
  }

  assert.match(
    resolver,
    /document\.id !== `\$\{teamId\}_\$\{userId\}`/
  );
  assert.match(resolver, /clean\(data\.status\)\.toLowerCase\(\) === 'active'/);
  assert.match(resolver, /data\.revokedAt == null/);
  assert.match(resolver, /\.where\('status', '==', 'active'\)/);
  assert.match(
    resolver,
    /clean\(team\.organizationId\) !== candidate\.organizationId/
  );
  assert.match(
    resolver,
    /db\.collection\('pulsecheck-organizations'\)/
  );
});
