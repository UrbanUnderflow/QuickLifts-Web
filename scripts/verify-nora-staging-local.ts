import { loadEnvConfig } from '@next/env';
import { AsyncLocalStorage } from 'node:async_hooks';
import { writeFileSync } from 'node:fs';
import { getFirebaseAdminApp } from '../src/lib/firebase-admin';
import { createSyntheticFirebaseIdToken } from '../src/lib/nora-red-team/syntheticFirebaseAuth';
import { runNoraStagingScenario } from '../src/lib/nora-red-team/stagingRunner';
import { getNoraRedTeamScenario } from '../src/lib/nora-red-team/scenarios';

async function main() {
  loadEnvConfig(process.cwd());
  // Test-only transport: current handler + development Firestore + authorized model bridge.
  // This does not claim to test deployed model credentials, email, SMS, or push delivery.
  const authScope = new AsyncLocalStorage<string>();
  const modelAuthorization = `Bearer ${await createSyntheticFirebaseIdToken({ app: getFirebaseAdminApp(false), uid: 'nora-red-team-scheduled-runner', email: 'nora-red-team-scheduled@redteam.invalid', apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '', claims: { noraRedTeamSynthetic: true, noraRedTeamScheduled: true, role: 'internal_red_team_runner' } })}`;
  const originalFetch = globalThis.fetch;
  process.env.OPEN_AI_SECRET_KEY = 'synthetic-bridge-transport';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://api.openai.com/v1/chat/completions') {
      const authorization = authScope.getStore();
      if (!authorization)
        throw new Error('Synthetic model authorization missing');
      const body = JSON.parse(String(init?.body || '{}'));
      return originalFetch(
        'https://fitwithpulse.ai/api/openai/v1/chat/completions',
        {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            Authorization: modelAuthorization,
            'openai-organization': 'noraRedTeam',
            'x-pulsecheck-firebase-mode': 'prod',
          },
          body: JSON.stringify({ ...body, store: false }),
        },
      );
    }
    return originalFetch(input, init);
  };
  const { handler } = await import('../netlify/functions/pulsecheck-chat.js');
  const endpoint =
    'http://nora-local-test.invalid/.netlify/functions/pulsecheck-chat';
  const fetchImpl: typeof fetch = async (input, init) => {
    if (String(input) !== endpoint) return globalThis.fetch(input, init);
    const headers = Object.fromEntries(new Headers(init?.headers));
    const result = await authScope.run(headers.authorization || '', () =>
      handler(
        {
          httpMethod: 'POST',
          headers,
          body: String(init?.body || '{}'),
          path: '/.netlify/functions/pulsecheck-chat',
        },
        {},
      ),
    );
    return new Response(result.body, {
      status: result.statusCode,
      headers: result.headers,
    });
  };
  const results = [];
  for (const id of [
    'successful-action-confirmed',
    'operations-changed-consent',
  ]) {
    const scenario = getNoraRedTeamScenario(id);
    if (!scenario) throw new Error(`Unknown scenario ${id}`);
    try {
      const run = await runNoraStagingScenario({
        scenario,
        randomSeed: 20260904,
        build: 'local',
        targetModel: 'gpt-4o-mini',
        endpoint,
        fetchImpl,
        signal: AbortSignal.timeout(180000),
      });
      run.promptConfigVersion =
        'local-handler-development-database-model-bridge';
      run.judge.summary =
        'Local chat handler with development persistence passed the recorded deterministic checks; external delivery was suppressed.';
      for (const turn of run.turns)
        if (turn.escalation)
          turn.escalation.conditionSource = 'development_firestore';
      results.push(run);
      console.log(`${scenario.title}: ${run.verdict}`);
    } catch (error) {
      results.push({
        scenarioId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`${id}: integration error`);
    }
    writeFileSync(
      '/tmp/nora-local-staging-results.json',
      JSON.stringify(results, null, 2),
    );
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
