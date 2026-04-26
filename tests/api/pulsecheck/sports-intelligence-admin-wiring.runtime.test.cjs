const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const doctrine =
  'Pulse team manually curates inference + adherence; reports flow through reviewer screen; no auto-delivery during pilot';

test('hosted coach reports pass through AuthWrapper while keeping page-level membership auth', () => {
  const authWrapper = read('src/components/AuthWrapper.tsx');
  const hostedReportRoute = read('src/pages/coach-reports/[teamId]/[reportId].tsx');

  assert.match(authWrapper, /'\/coach-reports'/, 'AuthWrapper must allow hosted report routes through to page-level authorization');
  assert.match(authWrapper, /team-membership authorization/, 'AuthWrapper comment should preserve the page-level authorization intent');
  assert.match(hostedReportRoute, /useUserLoading/, 'hosted report page must own the unauthenticated loading/sign-in state');
  assert.match(hostedReportRoute, /status:\s*'sign_in'/, 'hosted report page must not spin forever when the user is signed out');
  assert.match(hostedReportRoute, /\?signin=1/, 'hosted report page should open the sign-in modal without losing the permalink');
  assert.match(hostedReportRoute, /listUserTeamMemberships/, 'hosted report page must still check team membership');
  assert.match(hostedReportRoute, /team-admin|coach|performance-staff/, 'hosted report page must scope access to approved team roles');
});

test('admin entry points expose the reviewer screen and Slice 1 doctrine', () => {
  const adminIndex = read('src/pages/admin/index.tsx');
  const sportConfig = read('src/pages/admin/pulsecheckSportConfiguration.tsx');

  assert.match(adminIndex, /Sports Intelligence Reports/);
  assert.match(adminIndex, /\/admin\/sportsIntelligenceReports/);
  assert.match(adminIndex, new RegExp(doctrine.replace(/[+]/g, '\\+')));

  assert.match(sportConfig, /\/admin\/sportsIntelligenceReports/);
  assert.match(sportConfig, /scripts\/seed-pulsecheck-sports\.ts/);
  assert.match(sportConfig, new RegExp(doctrine.replace(/[+]/g, '\\+')));
});

test('system overview carries reviewer links, seed guidance, and doctrine memory', () => {
  const layerTab = read('src/components/admin/system-overview/PulseCheckSportsIntelligenceLayerSpecTab.tsx');
  const plainTextBundle = read('src/components/admin/system-overview/sportsIntelligencePlainTextBundle.ts');

  for (const source of [layerTab, plainTextBundle]) {
    assert.match(source, /\/admin\/sportsIntelligenceReports/);
    assert.match(source, /scripts\/seed-pulsecheck-sports\.ts/);
    assert.match(source, new RegExp(doctrine.replace(/[+]/g, '\\+')));
  }
});
