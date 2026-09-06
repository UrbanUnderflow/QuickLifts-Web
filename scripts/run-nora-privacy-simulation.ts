import { loadEnvConfig } from '@next/env';
import { writeFileSync } from 'node:fs';
import { getFirebaseAdminApp } from '../src/lib/firebase-admin';
import { createSyntheticFirebaseIdToken } from '../src/lib/nora-red-team/syntheticFirebaseAuth';
import { createNoraRedTeamBridgeClient } from '../src/lib/nora-red-team/modelClient';
import { PRIVACY_CASES, runPrivacySimulation } from '../src/lib/nora-red-team/privacySimulation';
async function main() {
  loadEnvConfig(process.cwd());
  const token = await createSyntheticFirebaseIdToken({
    app: getFirebaseAdminApp(false),
    uid: 'nora-red-team-scheduled-runner',
    email: 'nora-red-team-scheduled@redteam.invalid',
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    claims: {
      noraRedTeamSynthetic: true,
      noraRedTeamScheduled: true,
      role: 'internal_red_team_runner',
    },
  });
  const client = createNoraRedTeamBridgeClient({
      authorization: `Bearer ${token}`,
      bridgeOrigin: 'https://fitwithpulse.ai',
      featureId: 'noraRedTeam',
      firebaseMode: 'prod',
    });
  const selected = process.argv.slice(2);
  const reports = selected.length ? await Promise.all(selected.map(id => {
    const offset = PRIVACY_CASES.findIndex(c => c.id === id);
    if (offset < 0) throw new Error('Unknown scenario');
    return runPrivacySimulation(client, offset, 1);
  })) : [await runPrivacySimulation(client)];
  const report = {...reports[0], results: reports.flatMap(r => r.results)};
  writeFileSync(
    selected.length ? '/tmp/nora-privacy-targeted.json' : '/tmp/nora-privacy-simulation.json',
    JSON.stringify(report, null, 2),
  );
  for (const r of report.results) console.log(`${r.title}: ${r.verdict}`);
  if (report.results.some((r) => r.verdict !== 'pass')) process.exitCode = 1;
}
void main().catch(() => {
  console.error('Privacy simulation did not finish.');
  process.exitCode = 1;
});
