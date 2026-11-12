// PulseCheck voice transcription
// - Turns one spoken athlete turn into text for Nora, in whatever language was spoken.
// - The phone's own recognizer listens in one language at a time, so an athlete who switches
//   between languages is misheard. This model detects the language of each recording instead.
// - Audio is sent to the transcription provider only for this request. It is not stored or logged,
//   and neither is the returned text. The text then goes through pulsecheck-chat as a typed turn would.

const { initializeFirebaseAdmin, getFirebaseAdminApp, headers } = require('./config/firebase');
const { assertAccountOpen } = require('./lib/account-closure-guard');
const console = require('./utils/noraSafeLogger');
const { CONVERSATION_LANGUAGES, normalizeConversationLanguage } = require('./utils/noraConversationLanguage');

const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
// About two minutes of compressed speech. A single turn is far shorter.
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['audio/m4a', 'turn.m4a'],
  ['audio/mp4', 'turn.m4a'],
  ['audio/aac', 'turn.m4a'],
  ['audio/wav', 'turn.wav'],
]);
const PROMPT = 'An athlete talking with Nora, a mental performance coach. They often address her by name, "Nora". '
  + 'They may switch languages mid-sentence. '
  + 'Write each word in the language and script it was spoken in. Do not translate.';

function requestHeader(event, name) {
  const target = name.toLowerCase();
  const match = Object.entries(event?.headers || {}).find(([key]) => key.toLowerCase() === target);
  return String(match?.[1] || '').trim();
}

function respond(statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

async function verifyCaller(firebaseApp, event) {
  const match = requestHeader(event, 'authorization').match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return null;
  try {
    const decoded = await firebaseApp.auth().verifyIdToken(match[1], true);
    const userId = String(decoded?.uid || '').trim();
    if (!userId) return null;
    await assertAccountOpen(firebaseApp.firestore(), userId);
    return userId;
  } catch {
    return null;
  }
}

/** Validates the request body. Returns { audio, fileName } or { error }. */
function parseAudioRequest(body) {
  const mimeType = String(body?.mimeType || '').toLowerCase();
  const fileName = ALLOWED_TYPES.get(mimeType);
  if (!fileName) return { error: 'Unsupported audio type.' };
  const encoded = typeof body?.audio === 'string' ? body.audio : '';
  if (!encoded) return { error: 'Missing audio.' };
  const audio = Buffer.from(encoded, 'base64');
  if (audio.length === 0) return { error: 'Missing audio.' };
  if (audio.length > MAX_AUDIO_BYTES) return { error: 'This recording is too long.' };
  return { audio, fileName, mimeType, language: normalizeConversationLanguage(body?.language) };
}

/** The athlete's chosen language is a hint, not a lock, so a spoken request to switch still comes through. */
function promptFor(language) {
  const name = CONVERSATION_LANGUAGES[language];
  return name ? `${PROMPT} They have chosen to talk in ${name}, so most of what they say will be in ${name}.` : PROMPT;
}

async function transcribe({ audio, fileName, mimeType, language }, apiKey, fetchImpl = fetch) {
  const form = new FormData();
  form.append('file', new Blob([audio], { type: mimeType }), fileName);
  form.append('model', TRANSCRIPTION_MODEL);
  form.append('response_format', 'json');
  form.append('prompt', promptFor(language));
  const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = new Error(`Transcription provider returned ${response.status}`);
    error.statusCode = 502;
    throw error;
  }
  const payload = await response.json();
  return String(payload?.text || '').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });

  let firebaseApp;
  try {
    const firebaseRequest = { headers: event.headers || {} };
    initializeFirebaseAdmin(firebaseRequest);
    firebaseApp = getFirebaseAdminApp(firebaseRequest);
  } catch (error) {
    console.error('[pulsecheck-transcribe] Firebase initialization failed');
    return respond(500, { error: 'Voice transcription is unavailable right now.' });
  }

  const userId = await verifyCaller(firebaseApp, event);
  if (!userId) return respond(401, { error: 'Sign in is required.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid request.' });
  }
  const parsed = parseAudioRequest(body);
  if (parsed.error) return respond(400, { error: parsed.error });

  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) return respond(503, { error: 'Voice transcription is unavailable right now.' });

  try {
    const text = await transcribe(parsed, apiKey);
    return respond(200, { text, model: TRANSCRIPTION_MODEL });
  } catch (error) {
    // Never log the audio or any transcript, only that the provider call failed.
    console.error('[pulsecheck-transcribe] Transcription failed', { status: error.statusCode || null, name: error.name });
    return respond(error.statusCode === 502 ? 502 : 503, { error: 'Voice transcription is unavailable right now.' });
  }
};

exports._test = { parseAudioRequest, transcribe, promptFor, MAX_AUDIO_BYTES, TRANSCRIPTION_MODEL };
