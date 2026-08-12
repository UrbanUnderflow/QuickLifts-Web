const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('NoraNotetaker queues a server-side meeting bot named Nora', () => {
  const queueBot = read('src/pages/api/nora-notetaker/queue-bot.ts');
  const secrets = read('src/lib/noraNotetakerProviderSecrets.ts');
  const page = read('src/pages/NoraNotetaker.tsx');

  assert.match(
    queueBot,
    /const NORA_BOT_NAME = 'Nora'/,
    'the provider bot display name should be Nora',
  );
  assert.match(
    secrets,
    /DEFAULT_RECALLAI_SECRET_NAME = 'RECALLAI_API_KEY'/,
    'the meeting bot API key should default to the canonical Secret Manager secret name',
  );
  assert.match(
    secrets,
    /process\.env\.RECALLAI_API_KEY[\s\S]*getSecretManagerSecret\(secretName\)/,
    'the meeting bot API key should resolve from env first, then Google Secret Manager',
  );
  assert.match(
    queueBot,
    /meeting_url: meetingUrl[\s\S]*bot_name: NORA_BOT_NAME[\s\S]*recording_config:/,
    'the provider request should create a bot for the meeting URL with transcript recording enabled',
  );
  assert.match(
    queueBot,
    /resolveJoinAt[\s\S]*10 \* 60 \* 1000/,
    'scheduled bots should only send join_at when the meeting is far enough in the future',
  );
  assert.doesNotMatch(
    page,
    /RECALLAI_API_KEY|RECALL_API_KEY/,
    'provider API keys must never appear in the browser page bundle',
  );
});

test('NoraNotetaker can sync completed provider transcripts', () => {
  const syncBot = read('src/pages/api/nora-notetaker/sync-bot.ts');
  const secrets = read('src/lib/noraNotetakerProviderSecrets.ts');
  const page = read('src/pages/NoraNotetaker.tsx');

  assert.match(
    syncBot,
    /\/api\/v1\/bot\/\$\{encodeURIComponent\(providerBotId\)\}\//,
    'sync should retrieve the provider bot by providerBotId',
  );
  assert.match(
    syncBot,
    /\/api\/v1\/transcript\/\?recording_id=\$\{encodeURIComponent\(recordingId\)\}&status_code=done/,
    'sync should look up completed transcript artifacts for the recording',
  );
  assert.match(
    syncBot,
    /downloadTranscript\(downloadUrl\)/,
    'sync should download the transcript artifact once available',
  );
  assert.match(
    secrets,
    /DEFAULT_RECALLAI_REGION = 'us-east-1'/,
    'the non-secret Recall region should have a safe default',
  );
  assert.match(
    page,
    /fetch\('\/api\/nora-notetaker\/sync-bot'/,
    'the page should expose a sync path for completed Nora notes',
  );
});
