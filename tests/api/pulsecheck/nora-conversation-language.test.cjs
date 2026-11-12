const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const language = require(path.join(__dirname, '../../../netlify/functions/utils/noraConversationLanguage.js'));

test('a message is read by the athlete language rules', () => {
  const cases = [
    ['I had a rough practice today', 'en'],
    ['Me and my coach talked about it', 'en'],
    ['오늘 연습 너무 힘들었어', 'ko'],
    ['오늘 practice 힘들었어', 'ko'], // a borrowed word alone does not make it English
    ['I was so tired but 오늘 연습 갔어', 'en'], // English mixed with another language is English
    ['오늘 너무 피곤해, pero tengo práctica', 'ko'], // two other languages: the one they started in
    ['Hoy estoy muy cansado y no quiero entrenar', 'es'],
    ['¿Qué puedo hacer cuando mi coach dice "next play"?', 'es'], // a quoted English cue
    ['hola', 'es'],
    ["Je suis fatigué aujourd'hui", 'fr'],
    ['Hoje eu estou muito cansado', 'pt'],
    ['今天训练很累', 'zh'],
    ['今日は練習がきつかった', 'ja'],
  ];
  for (const [message, expected] of cases) assert.equal(language.detectMessageLanguage(message), expected, message);
  for (const unclear of ['ok', 'yes', 'Nora', 'thanks Nora', '👍']) assert.equal(language.detectMessageLanguage(unclear), null, unclear);
});

test('writing in another language switches it, and short or unclear turns keep it', () => {
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'en', message: '오늘 연습 힘들었어' }), { code: 'ko', changed: true, detected: true });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'ko', message: 'I had a rough practice today' }), { code: 'en', changed: true, detected: true });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'ko', message: 'ok' }), { code: 'ko', changed: false, detected: false });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'es', message: 'Hoy estoy muy cansado' }), { code: 'es', changed: false, detected: false });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'zh-Hans', message: '今天训练很累' }), { code: 'zh', changed: false, detected: false });
});

test('asking switches too, and older builds without a choice keep the per-turn rules', () => {
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'en', message: 'Can we talk in Korean?' }), { code: 'ko', changed: true, detected: false });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: undefined, message: '오늘 연습 힘들었어' }), { code: null, changed: false, detected: false });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: undefined, message: '한국어로 이야기해요' }), { code: 'ko', changed: true, detected: false });
});

test('Nora writes in the turn language and acknowledges a switch', () => {
  const steady = language.buildConversationLanguageSection('ko');
  assert.match(steady, /Reply in Korean/);
  assert.match(steady, /overrides the per-turn language rules/);
  assert.doesNotMatch(steady, /just switched/);
  assert.match(language.buildConversationLanguageSection('ko', { switched: true }), /just switched to Korean.*noticed/);
  assert.equal(language.buildConversationLanguageSection(null), '');
});

test('every language has a greeting for a turn with no topic', () => {
  for (const code of Object.keys(language.CONVERSATION_LANGUAGES)) assert.ok(language.TOPICLESS_GREETING[code], code);
});
