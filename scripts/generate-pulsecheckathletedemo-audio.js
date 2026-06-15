#!/usr/bin/env node

// Generates ElevenLabs narration for the NEW Nora lines in the athlete demo
// (/pulsecheckathletedemo) — the curriculum hand-off line and the chat-2 spiral.
// Uses the SAME voice/model/profile as generate-pulsecheckdemo-audio.js so chat 2
// sounds like the same Nora as the reused chat-1 game-day audio.
// Writes into public/audio/pulsecheckdemo/ (shared with chat 1), new filenames only —
// it never touches the existing act1-*.mp3 files.

const fs = require('fs');
const path = require('path');

const fetchImpl = typeof fetch === 'function' ? fetch : require('node-fetch');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'src', 'data', 'pulsecheckathletedemo-audio.json');
const envLocalPath = path.join(projectRoot, '.env.local');
// "Our Nora voice" — the voice configured at /admin/ai-voice (app-config/ai-voice).
// Prefer regenerating via POST /api/admin/generate-voice-asset (dir=pulsecheckdemo),
// which auto-resolves this from Firestore. Pinned here so offline CLI runs still match.
const defaultVoiceId = 'gJx1vCzNCD1EQHT212Ls';
const outputDir = path.join(projectRoot, 'public', 'audio', 'pulsecheckdemo');

// 'expressive' profile — identical to the existing demo's default.
const voiceSettings = {
  stability: 0.34,
  similarity_boost: 0.82,
  style: 0.65,
  use_speaker_boost: true,
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function synthesizeSpeech(apiKey, voiceId, text) {
  const response = await fetchImpl(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
        voice_settings: voiceSettings,
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs request failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  loadEnvFile(envLocalPath);

  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ELEVEN_LABS_API_KEY in environment or .env.local');
  }

  const voiceIdArg = process.argv.find((a) => a.startsWith('--voice-id='));
  const voiceId = voiceIdArg ? voiceIdArg.split('=')[1] : defaultVoiceId;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.mkdirSync(outputDir, { recursive: true });

  for (const entry of manifest) {
    const targetPath = path.join(outputDir, entry.filename);
    process.stdout.write(`Generating ${entry.filename} with voice ${voiceId}...\n`);
    const audioBuffer = await synthesizeSpeech(apiKey, voiceId, entry.text);
    fs.writeFileSync(targetPath, audioBuffer);
  }

  process.stdout.write(`Wrote ${manifest.length} file(s) to ${outputDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
