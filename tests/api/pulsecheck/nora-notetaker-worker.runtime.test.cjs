const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('NoraNotetaker queues an owned worker job named Nora', () => {
  const queueBot = read('src/pages/api/nora-notetaker/queue-bot.ts');
  const page = read('src/pages/NoraNotetaker.tsx');
  const envExample = read('.env.example');

  assert.match(queueBot, /const NORA_BOT_NAME = 'Nora'/, 'the worker bot display name should be Nora');
  assert.match(
    queueBot,
    /provider: OWNED_WORKER_PROVIDER[\s\S]*workerJobId: meetingId[\s\S]*workerMode: 'caption-browser'/,
    'queue should return an owned worker job instead of calling a paid bot provider',
  );
  assert.match(
    page,
    /workerJobId[\s\S]*workerStatus[\s\S]*workerMode/,
    'the browser page should persist worker job state on the meeting record',
  );
  assert.doesNotMatch(queueBot + page + envExample, /RECALLAI_API_KEY|RECALL_API_KEY|recall\.ai/i);
});

test('NoraNotetaker refreshes notes from Firestore worker output', () => {
  const syncBot = read('src/pages/api/nora-notetaker/sync-bot.ts');
  const page = read('src/pages/NoraNotetaker.tsx');

  assert.match(
    syncBot,
    /transcriptStatus: 'read-from-firestore'/,
    'sync should point the UI back to Firestore because the worker writes transcripts directly',
  );
  assert.match(page, /fetch\('\/api\/nora-notetaker\/sync-bot'/);
  assert.match(page, /getDoc\(doc\(meetingsCollectionRef\(user\.uid\), selectedMeeting\.id\)\)/);
  assert.doesNotMatch(syncBot, /\/api\/v1\/bot|\/api\/v1\/transcript|providerBotId|recall/i);
});

test('NoraNotetaker can import upcoming video meetings from Google Calendar', () => {
  const page = read('src/pages/NoraNotetaker.tsx');

  assert.match(
    page,
    /GOOGLE_CALENDAR_READONLY_SCOPE = 'https:\/\/www\.googleapis\.com\/auth\/calendar\.readonly'/,
    'calendar sync should request read-only calendar access only',
  );
  assert.match(
    page,
    /https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/primary\/events/,
    'calendar sync should read events from the Google Calendar events endpoint',
  );
  assert.match(page, /extractMeetingUrl\(event\)/, 'calendar import should only save events with video links');
  assert.match(page, /calendarEventId/, 'calendar import should dedupe imported meetings by event id');
  assert.match(page, /Sync Google Calendar/, 'the signed-in Nora dashboard should expose a calendar sync button');
});

test('Nora worker is a separate deployable Google Meet service', () => {
  const worker = read('nora-worker/src/index.ts');
  const dockerfile = read('nora-worker/Dockerfile');
  const readme = read('nora-worker/README.md');
  const firebaseSimpBudget = read('firebase.simpbudget.json');
  const simpBudgetIndexes = read('firestore.simpbudget.indexes.json');

  assert.match(worker, /collectionGroup\(MEETINGS_SUBCOLLECTION\)/, 'worker should pull queued meetings across users');
  assert.match(worker, /status', '==', 'queued'/, 'worker should only claim queued meetings');
  assert.match(worker, /workerStatus', 'in', \['queued', 'retryable-error'\]/, 'worker should avoid repeatedly claiming blocked jobs');
  assert.match(worker, /collectGoogleMeetCaptions/, 'Google Meet caption capture should be the first owned adapter');
  assert.match(worker, /rawTranscript/, 'worker should write transcript text back to Firestore');
  assert.match(dockerfile, /mcr\.microsoft\.com\/playwright/, 'worker image should include browser runtime support');
  assert.match(readme, /No Recall\.ai or paid meeting-bot provider\./);
  assert.match(firebaseSimpBudget, /firestore\.simpbudget\.indexes\.json/, 'SimpBudget deploy should include Nora worker indexes');
  assert.match(simpBudgetIndexes, /noraNotetakerMeetings[\s\S]*workerStatus/, 'worker queue query should have a collection-group index');
});
