import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAiVoiceConfig } from '../../src/lib/aiVoice';
import { buildSpeakRequest } from '../../src/utils/tts';

test('legacy ElevenLabs config keeps its voice and receives a separate OpenAI fallback', () => {
  const normalized = normalizeAiVoiceConfig({
    provider: 'elevenlabs',
    voiceId: 'legacy-eleven-voice',
    updatedAt: 1,
  });

  assert.equal(normalized.voiceId, 'legacy-eleven-voice');
  assert.equal(normalized.elevenLabsVoiceId, 'legacy-eleven-voice');
  assert.equal(normalized.openAiVoiceId, 'alloy');
});

test('independent provider voices survive normalization and active voice follows the primary provider', () => {
  const normalized = normalizeAiVoiceConfig({
    provider: 'elevenlabs',
    voiceId: 'stale-legacy-value',
    elevenLabsVoiceId: 'configured-eleven-voice',
    openAiVoiceId: 'shimmer',
    updatedAt: 2,
  });

  assert.equal(normalized.voiceId, 'configured-eleven-voice');
  assert.equal(normalized.elevenLabsVoiceId, 'configured-eleven-voice');
  assert.equal(normalized.openAiVoiceId, 'shimmer');
});

test('ElevenLabs narration request carries the configured OpenAI fallback voice', async () => {
  const request = await buildSpeakRequest('Stay with the breath.', {
    provider: 'elevenlabs',
    id: 'configured-eleven-voice',
    label: 'Configured ElevenLabs voice',
    presetId: 'default',
    settings: null,
    punctuationPauses: true,
    fallbackVoiceId: 'nova',
  });

  assert.equal(request.provider, 'elevenlabs');
  assert.equal(request.voice, 'configured-eleven-voice');
  assert.equal(request.fallbackVoice, 'nova');
});
