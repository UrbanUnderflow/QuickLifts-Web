#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const fetchImpl = typeof fetch === 'function' ? fetch : require('node-fetch');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'src', 'data', 'pulsecheckdemo-act1-audio.json');
const envLocalPath = path.join(projectRoot, '.env.local');
const defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';
const fullOutputDir = path.join(projectRoot, 'public', 'audio', 'pulsecheckdemo');
const abOutputDir = path.join(projectRoot, 'public', 'audio', 'pulsecheckdemo-ab');

const voiceProfiles = {
  balanced: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.3,
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

const sampleAudioIds = new Set([
  'act1-00-intro',
  'act1-04-box-breathing',
  'act1-06-support-staff',
]);

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

function parseArgs(argv) {
  const parsed = {
    sampleOnly: false,
    allProfiles: false,
    profile: 'expressive',
    voiceId: defaultVoiceId,
    useVoiceDefaults: false,
    punctuationPauses: false,
  };

  for (const arg of argv) {
    if (arg === '--sample-only') {
      parsed.sampleOnly = true;
      continue;
    }
    if (arg === '--all-profiles') {
      parsed.allProfiles = true;
      continue;
    }
    if (arg.startsWith('--profile=')) {
      parsed.profile = arg.split('=')[1] || parsed.profile;
      continue;
    }
    if (arg.startsWith('--voice-id=')) {
      parsed.voiceId = arg.split('=')[1] || parsed.voiceId;
      continue;
    }
    if (arg === '--use-voice-defaults') {
      parsed.useVoiceDefaults = true;
      continue;
    }
    if (arg === '--respect-punctuation') {
      parsed.punctuationPauses = true;
    }
  }

  return parsed;
}

function addPunctuationPauses(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(/([,;:])\s+/g, '$1  ')
    .trim();
}

async function synthesizeSpeech(apiKey, voiceId, text, voiceSettings, useVoiceDefaults) {
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
        ...(useVoiceDefaults ? {} : { voice_settings: voiceSettings }),
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
  const options = parseArgs(process.argv.slice(2));

  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ELEVEN_LABS_API_KEY in environment or .env.local');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entries = options.sampleOnly
    ? manifest.filter((entry) => sampleAudioIds.has(entry.id))
    : manifest;
  const profileNames = options.allProfiles
    ? Object.keys(voiceProfiles)
    : [options.profile];

  for (const profileName of profileNames) {
    const voiceSettings = voiceProfiles[profileName];
    if (!voiceSettings) {
      throw new Error(
        `Unknown profile "${profileName}". Available profiles: ${Object.keys(voiceProfiles).join(', ')}`
      );
    }

    const outputDir = options.sampleOnly || options.allProfiles
      ? path.join(abOutputDir, profileName)
      : fullOutputDir;
    fs.mkdirSync(outputDir, { recursive: true });

    for (const entry of entries) {
      const targetPath = path.join(outputDir, entry.filename);
      const synthesisText = options.punctuationPauses
        ? addPunctuationPauses(entry.text)
        : entry.text;
      process.stdout.write(
        `Generating [${profileName}] ${entry.filename} with voice ${options.voiceId}${options.useVoiceDefaults ? ' (defaults)' : ''}...\n`
      );
      const audioBuffer = await synthesizeSpeech(
        apiKey,
        options.voiceId,
        synthesisText,
        voiceSettings,
        options.useVoiceDefaults
      );
      fs.writeFileSync(targetPath, audioBuffer);
    }

    process.stdout.write(
      `Wrote ${entries.length} file(s) for profile "${profileName}" to ${outputDir}\n`
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
