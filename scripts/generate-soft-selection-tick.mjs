import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sampleRate = 48_000;
const durationSeconds = 0.12;
const frameCount = Math.ceil(sampleRate * durationSeconds);
const channels = 2;

// Deterministic noise keeps the preview reproducible between runs.
let randomState = 0x50434b31;
const random = () => {
  randomState += 0x6d2b79f5;
  let value = randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
};

const samples = new Float64Array(frameCount);
let feltLow = 0;
let feltVeryLow = 0;
const lowPassCoefficient = Math.exp((-2 * Math.PI * 1_650) / sampleRate);
const veryLowPassCoefficient = Math.exp((-2 * Math.PI * 520) / sampleRate);

for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / sampleRate;
  const noise = random() * 2 - 1;
  feltLow = lowPassCoefficient * feltLow + (1 - lowPassCoefficient) * noise;
  feltVeryLow = veryLowPassCoefficient * feltVeryLow + (1 - veryLowPassCoefficient) * noise;

  // A soft felt-covered contact: brief broadband texture with no sharp click.
  const contactAttack = Math.min(1, time / 0.0018);
  const contactEnvelope = contactAttack * Math.exp(-time / 0.0075);
  const contact = (feltLow * 0.78 + feltVeryLow * 0.42) * contactEnvelope * 0.72;

  // A very short, low-mid physical body. It is too brief and too damped to
  // read as a note, chime, or alert, but gives the tap a comfortable tactility.
  const bodyAttack = Math.min(1, time / 0.0035);
  const bodyEnvelope = bodyAttack * Math.exp(-time / 0.021);
  const body = (
    Math.sin(2 * Math.PI * 178 * time + 0.62) * 0.095
    + Math.sin(2 * Math.PI * 287 * time + 2.15) * 0.041
  ) * bodyEnvelope;

  // A tiny rounded finish prevents the impact from feeling clipped while
  // still leaving most of the 120 ms file silent.
  const tail = Math.sin(2 * Math.PI * 128 * time + 1.1) * Math.exp(-time / 0.014) * 0.018;
  samples[frame] = Math.tanh((contact + body + tail) * 1.35);
}

// Remove any small DC bias introduced by the deterministic impact texture.
const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
let peak = 0;
for (let frame = 0; frame < samples.length; frame += 1) {
  samples[frame] -= mean;
  peak = Math.max(peak, Math.abs(samples[frame]));
}

// Keep this intentionally quieter than alerts and success tones (-12 dBFS).
const targetPeak = 10 ** (-12 / 20);
const scale = peak > 0 ? targetPeak / peak : 1;

const bytesPerSample = 2;
const dataSize = frameCount * channels * bytesPerSample;
const wav = Buffer.alloc(44 + dataSize);
let offset = 0;
const writeAscii = (value) => {
  wav.write(value, offset, 'ascii');
  offset += value.length;
};

writeAscii('RIFF');
wav.writeUInt32LE(36 + dataSize, offset); offset += 4;
writeAscii('WAVE');
writeAscii('fmt ');
wav.writeUInt32LE(16, offset); offset += 4;
wav.writeUInt16LE(1, offset); offset += 2;
wav.writeUInt16LE(channels, offset); offset += 2;
wav.writeUInt32LE(sampleRate, offset); offset += 4;
wav.writeUInt32LE(sampleRate * channels * bytesPerSample, offset); offset += 4;
wav.writeUInt16LE(channels * bytesPerSample, offset); offset += 2;
wav.writeUInt16LE(bytesPerSample * 8, offset); offset += 2;
writeAscii('data');
wav.writeUInt32LE(dataSize, offset); offset += 4;

for (let frame = 0; frame < frameCount; frame += 1) {
  const sample = Math.max(-1, Math.min(1, samples[frame] * scale));
  const pcm = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
  wav.writeInt16LE(pcm, offset); offset += 2;
  wav.writeInt16LE(pcm, offset); offset += 2;
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, '../public/audio/sfx/selection-soft-felt-preview.wav');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, wav);

process.stdout.write(`${outputPath}\n`);
