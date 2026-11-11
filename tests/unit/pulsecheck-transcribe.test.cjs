const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../../netlify/functions/pulsecheck-transcribe');

const audio = Buffer.from('fake-m4a-bytes').toString('base64');

test('accepts a short m4a turn', () => {
  const parsed = _test.parseAudioRequest({ audio, mimeType: 'audio/m4a' });
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.fileName, 'turn.m4a');
});

test('rejects missing, unsupported and oversized audio', () => {
  assert.ok(_test.parseAudioRequest({ mimeType: 'audio/m4a' }).error);
  assert.ok(_test.parseAudioRequest({ audio, mimeType: 'video/mp4' }).error);
  const big = Buffer.alloc(_test.MAX_AUDIO_BYTES + 1).toString('base64');
  assert.ok(_test.parseAudioRequest({ audio: big, mimeType: 'audio/m4a' }).error);
});

test('sends the audio for automatic language detection and returns the text as spoken', async () => {
  let sent;
  const fetchImpl = async (url, options) => {
    sent = { url, options };
    return { ok: true, json: async () => ({ text: ' 오늘 너무 피곤해, but I still want to practice. ' }) };
  };
  const parsed = _test.parseAudioRequest({ audio, mimeType: 'audio/m4a' });
  const text = await _test.transcribe(parsed, 'test-key', fetchImpl);
  assert.equal(text, '오늘 너무 피곤해, but I still want to practice.');
  assert.match(sent.url, /audio\/transcriptions$/);
  assert.equal(sent.options.body.get('model'), _test.TRANSCRIPTION_MODEL);
  // No fixed language: the model detects it per recording.
  assert.equal(sent.options.body.get('language'), null);
  assert.match(sent.options.body.get('prompt'), /Do not translate/);
  // The coach's name is spelled out so it is not heard as "Laura".
  assert.match(sent.options.body.get('prompt'), /"Nora"/);
});

test('a provider failure surfaces as an error so the app keeps its own transcript', async () => {
  const parsed = _test.parseAudioRequest({ audio, mimeType: 'audio/m4a' });
  await assert.rejects(_test.transcribe(parsed, 'test-key', async () => ({ ok: false, status: 500 })), /returned 500/);
});
