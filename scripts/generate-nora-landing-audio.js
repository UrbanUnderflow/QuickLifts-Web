#!/usr/bin/env node

/**
 * Generate the Nora landing-page voice samples with ElevenLabs.
 *
 * Usage:
 *   node scripts/generate-nora-landing-audio.js                     # all samples, expressive profile
 *   node scripts/generate-nora-landing-audio.js --hero-only         # just the hero line
 *   node scripts/generate-nora-landing-audio.js --voice-id=<id>     # override voice
 *   node scripts/generate-nora-landing-audio.js --profile=grounded  # grounded | expressive | animated
 *
 * Requires ELEVEN_LABS_API_KEY in env or .env.local.
 */

const fs = require('fs');
const path = require('path');

const fetchImpl = typeof fetch === 'function' ? fetch : require('node-fetch');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'src', 'data', 'nora-landing-audio.json');
const envLocalPath = path.join(projectRoot, '.env.local');
const defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';
const outputDir = path.join(projectRoot, 'public', 'audio', 'nora');

const voiceProfiles = {
  grounded: {
    stability: 0.52,
    similarity_boost: 0.78,
    style: 0.28,
    use_speaker_boost: true,
  },
  expressive: {
    stability: 0.34,
    similarity_boost: 0.82,
    style: 0.65,
    use_speaker_boost: true,
  },
  animated: {
    stability: 0.24,
    similarity_boost: 0.8,
    style: 0.82,
    use_speaker_boost: true,
  },
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
    if (!(key in process.env)) process.env[key] = value.replace(/^["']|["']$/g, '');
  }
}

function parseArgs(argv) {
  const parsed = {
    heroOnly: false,
    profile: 'expressive',
    voiceId: defaultVoiceId,
  };
  for (const arg of argv) {
    if (arg === '--hero-only') parsed.heroOnly = true;
    else if (arg.startsWith('--profile=')) parsed.profile = arg.split('=')[1] || parsed.profile;
    else if (arg.startsWith('--voice-id=')) parsed.voiceId = arg.split('=')[1] || parsed.voiceId;
  }
  return parsed;
}

async function synthesize(apiKey, voiceId, text, voiceSettings) {
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
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  loadEnvFile(envLocalPath);
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ELEVEN_LABS_API_KEY in environment or .env.local');
  }
  const voiceSettings = voiceProfiles[options.profile];
  if (!voiceSettings) {
    throw new Error(
      `Unknown profile "${options.profile}". Available: ${Object.keys(voiceProfiles).join(', ')}`
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entries = options.heroOnly
    ? manifest.filter((e) => e.id === 'nora-hero')
    : manifest;

  fs.mkdirSync(outputDir, { recursive: true });

  for (const entry of entries) {
    const target = path.join(outputDir, entry.filename);
    process.stdout.write(
      `Generating ${entry.filename} [${options.profile}] with voice ${options.voiceId}...\n`
    );
    const buf = await synthesize(apiKey, options.voiceId, entry.text, voiceSettings);
    fs.writeFileSync(target, buf);
  }

  process.stdout.write(`Wrote ${entries.length} file(s) to ${outputDir}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
