import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNoraFirebaseApiKey, resolveNoraRuntimeOrigin } from '../../src/lib/nora-red-team/runtimeConfig';

test('hosted workers use the runtime development key without build-time variables', () => {
  assert.equal(resolveNoraFirebaseApiKey(true, { DEV_FIREBASE_WEB_API_KEY: ' dev-key ' }), 'dev-key');
  assert.equal(resolveNoraFirebaseApiKey(true, { NEXT_PUBLIC_DEV_FIREBASE_API_KEY: 'build-dev' }), 'build-dev');
  assert.equal(resolveNoraFirebaseApiKey(true, { FIREBASE_WEB_API_KEY: 'prod', NEXT_PUBLIC_FIREBASE_API_KEY: 'prod' }), '');
  assert.equal(resolveNoraFirebaseApiKey(false, { FIREBASE_WEB_API_KEY: 'prod', DEV_FIREBASE_WEB_API_KEY: 'dev' }), 'prod');
});

test('chat simulation and scenarios resolve the same hosted or local app endpoint', () => {
  assert.equal(resolveNoraRuntimeOrigin({ URL: 'https://candidate.netlify.app/' }), 'https://candidate.netlify.app');
  assert.equal(resolveNoraRuntimeOrigin({ NEXT_PUBLIC_SITE_URL: 'https://fitwithpulse.ai' }), 'https://fitwithpulse.ai');
  assert.equal(resolveNoraRuntimeOrigin({ PULSECHECK_LOCAL_FUNCTIONS_ORIGIN: 'http://localhost:8888', URL: 'https://fitwithpulse.ai' }), 'http://localhost:8888');
  assert.equal(resolveNoraRuntimeOrigin({ NORA_RED_TEAM_STAGING_CHAT_ORIGIN: 'https://staging.example.com', URL: 'https://fitwithpulse.ai' }), 'https://staging.example.com');
  for (const origin of ['http://remote.example.com', 'file:///tmp/chat', 'https://user:password@example.com']) {
    assert.throws(() => resolveNoraRuntimeOrigin({ NORA_RED_TEAM_STAGING_CHAT_ORIGIN: origin }));
  }
});
