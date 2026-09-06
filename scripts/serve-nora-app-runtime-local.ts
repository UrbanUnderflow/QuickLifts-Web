import { loadEnvConfig } from '@next/env';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getFirebaseAdminApp } from '../src/lib/firebase-admin';
import { createSyntheticFirebaseIdToken } from '../src/lib/nora-red-team/syntheticFirebaseAuth';

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
  const conversation = await import('../netlify/functions/nora-save-conversation.js');
  const derived = await import('../netlify/functions/nora-save-derived.js');
  const estimate = await import('../netlify/functions/nora-estimate-meal.js');
  const handlers: Record<string, any> = {
    '/.netlify/functions/pulsecheck-chat': handler,
    '/.netlify/functions/nora-save-conversation': conversation.handler,
    '/.netlify/functions/nora-save-derived': derived.handler,
    '/.netlify/functions/nora-estimate-meal': estimate.handler,
  };
  const endpoint =
    'http://nora-local-test.invalid/.netlify/functions/pulsecheck-chat';
  const fetchImpl: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    const selectedHandler = handlers[path];
    if (!selectedHandler) return globalThis.fetch(input, init);
    const headers = Object.fromEntries(new Headers(init?.headers));
    const result = await authScope.run(headers.authorization || '', () =>
      selectedHandler(
        {
          httpMethod: 'POST',
          headers,
          body: String(init?.body || '{}'),
          path,
        },
        {},
      ),
    );
    return new Response(result.body, {
      status: result.statusCode,
      headers: result.headers,
    });
  };
  const { createServer } = await import('node:http');
  createServer(async (req, res) => {
    if (req.method !== 'POST' || !handlers[req.url || ''] || req.headers['x-pulsecheck-firebase-mode'] !== 'dev' || req.headers['x-nora-red-team-synthetic'] !== 'true') {
      res.writeHead(403); res.end(); return;
    }
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 160000) { res.writeHead(413); res.end(); return; } }
    try {
      const response = await fetchImpl(new URL(req.url || '', endpoint).href, {method:'POST',headers:req.headers as Record<string,string>,body});
      res.writeHead(response.status, {'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(await response.text());
    } catch { res.writeHead(500);res.end(JSON.stringify({error:'Local app runtime unavailable'})); }
  }).listen(3111, '127.0.0.1', () => console.log('Synthetic app runtime listening on loopback. External contacts disabled; model transport uses the authorized bridge.'));

}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
