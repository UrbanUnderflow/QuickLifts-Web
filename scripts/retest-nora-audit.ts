import { loadEnvConfig } from '@next/env';
import { readFileSync, writeFileSync } from 'node:fs';
import { getFirebaseAdminApp } from '../src/lib/firebase-admin';
import { createSyntheticFirebaseIdToken } from '../src/lib/nora-red-team/syntheticFirebaseAuth';
import {
  executeNoraRedTeamRun,
  getNoraRedTeamRunLimits,
} from '../src/lib/nora-red-team/execution';
import { getNoraRedTeamScenario } from '../src/lib/nora-red-team/scenarios';

async function main() {
  loadEnvConfig(process.cwd());
  const app = getFirebaseAdminApp(false);
  const token = await createSyntheticFirebaseIdToken({
    app,
    uid: 'nora-red-team-scheduled-runner',
    email: 'nora-red-team-scheduled@redteam.invalid',
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    claims: {
      noraRedTeamSynthetic: true,
      noraRedTeamScheduled: true,
      role: 'internal_red_team_runner',
    },
  });
  const baseline = JSON.parse(
    readFileSync(process.argv[2] || '/tmp/nora-baseline-audit.json', 'utf8'),
  );
  const ids: string[] = process.env.NORA_RETEST_IDS
    ? process.env.NORA_RETEST_IDS.split(',')
    : process.argv.includes('--all')
      ? baseline.runs.map((r: any) => r.run.scenarioId)
      : [
          'health-data-domain-drift',
          'cross-athlete-account-confusion',
          'failed-action-false-confirmation',
          'plain-language-factual-reflection',
        ];
  const runs = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        const prior = baseline.runs.find(
          (r: any) => r.run.scenarioId === id,
        ).run;
        const scenario = {
          ...getNoraRedTeamScenario(id)!,
          additionalAthleteMessages: prior.turns
            .slice(1)
            .map((t: any) => t.athleteMessage),
        };
        const run = await executeNoraRedTeamRun({
          authorization: `Bearer ${token}`,
          bridgeOrigin:
            process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai',
          featureId: 'noraRedTeam',
          firebaseMode: 'prod',
          firebaseProjectId: 'quicklifts-dd3f1',
          scenario,
          randomSeed: prior.randomSeed || 20260904,
          targetModel: 'gpt-4o-mini',
          agentModel: 'gpt-4o',
          build: 'local-audit-retest',
          target: 'policy_sandbox',
          limits: getNoraRedTeamRunLimits(),
          signal: AbortSignal.timeout(180000),
        });
        runs.push(run);
        writeFileSync(
          process.env.NORA_RETEST_OUTPUT ||
            (process.argv.includes('--all')
              ? '/tmp/nora-full-exact-retests.json'
              : '/tmp/nora-exact-retests.json'),
          JSON.stringify(runs, null, 2),
        );
        console.log(`${scenario.title}: ${run.verdict}`);
      }
    }),
  );
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
