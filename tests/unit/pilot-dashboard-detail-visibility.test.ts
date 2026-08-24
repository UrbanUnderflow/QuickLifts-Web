import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const serviceSource = readFileSync(
  path.resolve(process.cwd(), 'src/api/firebase/pulsecheckPilotDashboard/service.ts'),
  'utf8'
);

const sourceBetween = (startMarker: string, endMarker: string): string => {
  const startIndex = serviceSource.indexOf(startMarker);
  const endIndex = serviceSource.indexOf(endMarker, startIndex + startMarker.length);

  assert.notEqual(startIndex, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${endMarker}`);
  return serviceSource.slice(startIndex, endIndex);
};

test('direct pilot detail remains available after the final active athlete leaves', () => {
  const detailLookup = sourceBetween(
    'async getPilotDashboardDetail(',
    'async getPilotAthleteDetail('
  );

  assert.match(detailLookup, /const pilot = await pulseCheckProvisioningService\.getPilot\(pilotId\)/);
  assert.match(detailLookup, /if \(!pilot\) return null/);
  assert.doesNotMatch(detailLookup, /isPilotOperationallyActive/);
  assert.match(
    detailLookup,
    /const activeEnrollments = visibleEnrollments\.filter\(\(enrollment\) => enrollment\.status === 'active'\)/
  );
  assert.match(detailLookup, /activeAthleteCount: activeEnrollments\.length/);
});

test('the Active Pilots directory retains operational-scope filtering', () => {
  const activeDirectoryLookup = sourceBetween(
    'async listActivePilotDirectory(',
    'async getPilotDashboardAthletes('
  );

  assert.match(
    activeDirectoryLookup,
    /if \(!isPilotOperationallyActive\(pilot, pilotCohorts, pilotEnrollments\)\) return null/
  );
});
