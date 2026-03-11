#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const fetchImpl = typeof fetch === 'function' ? fetch : require('node-fetch');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'src', 'data', 'pulsecheckdemo-act1-audio.json');
const outputDir = path.join(projectRoot, 'public', 'audio', 'pulsecheckdemo');
const envLocalPath = path.join(projectRoot, '.env.local');
const voiceId = '21m00Tcm4TlvDq8ikWAM';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function synthesizeSpeech(apiKey, text) {
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
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
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

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.mkdirSync(outputDir, { recursive: true });

  for (const entry of manifest) {
    const targetPath = path.join(outputDir, entry.filename);
    process.stdout.write(`Generating ${entry.filename}...\n`);
    const audioBuffer = await synthesizeSpeech(apiKey, entry.text);
    fs.writeFileSync(targetPath, audioBuffer);
  }

  process.stdout.write(`Wrote ${manifest.length} files to ${outputDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
