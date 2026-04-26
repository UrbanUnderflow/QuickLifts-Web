const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const seedScriptPath = 'scripts/seed-pulsecheck-sports.ts';
const seedScript = () => read(seedScriptPath);

test('PulseCheck sport seed script defaults to diff-only and documents --apply', () => {
  const source = seedScript();
  const packageJson = JSON.parse(read('package.json'));

  assert.match(source, /Default mode is a dry diff/, 'script header should make dry diff mode obvious');
  assert.match(source, /--apply/, 'script should document the explicit apply flag');
  assert.match(source, /Diff mode only\. Re-run with --apply/, 'non-apply path should tell operators how to write intentionally');
  assert.match(source, /if \(!args\.apply\)[\s\S]*return;/, 'non-apply path must return before Firestore writes');

  assert.equal(
    packageJson.scripts['seed:pulsecheck-sports'],
    'tsx scripts/seed-pulsecheck-sports.ts',
    'default npm script must remain diff-only',
  );
  assert.equal(
    packageJson.scripts['seed:pulsecheck-sports:apply'],
    'tsx scripts/seed-pulsecheck-sports.ts --apply',
    'apply npm script must require the explicit --apply flag',
  );
});

test('PulseCheck sport seed apply path preserves admin-owned sport fields by default', () => {
  const source = seedScript();
  const mergeBlock = source.match(/const mergeSports =[\s\S]*?\n};/)?.[0] || '';

  assert.match(mergeBlock, /\.\.\.current/, 'existing sports should preserve current admin-owned fields');
  assert.match(mergeBlock, /reportPolicy: defaultSport\.reportPolicy/, 'apply should replace code-owned reportPolicy');
  assert.match(mergeBlock, /args\.includePrompting \? \{ prompting: defaultSport\.prompting \} : \{\}/, 'prompting must be opt-in');

  for (const adminOwnedField of ['positions', 'attributes', 'metrics']) {
    assert.doesNotMatch(
      mergeBlock,
      new RegExp(`${adminOwnedField}:\\s*defaultSport\\.${adminOwnedField}`),
      `${adminOwnedField} must not be overwritten from code defaults during policy backfill`,
    );
  }
});

test('PulseCheck sport seed apply path only includes prompting when requested', () => {
  const source = seedScript();

  assert.match(source, /includePrompting: argv\.includes\('--include-prompting'\)/);
  assert.match(
    source,
    /args\.includePrompting \? \{ prompting: defaultSport\.prompting \} : \{\}/,
    'prompting should be guarded by --include-prompting',
  );
  assert.match(
    source,
    /Prompting was preserved; only reportPolicy\/loadModel was written\./,
    'operator output should confirm prompting was preserved by default',
  );
  assert.match(
    source,
    /Prompting was included because --include-prompting was passed\./,
    'operator output should confirm intentional prompting writes',
  );
});
