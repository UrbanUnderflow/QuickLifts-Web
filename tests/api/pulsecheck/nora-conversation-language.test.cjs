const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const language = require(path.join(__dirname, '../../../netlify/functions/utils/noraConversationLanguage.js'));

test('the chosen language holds until the athlete explicitly asks for another', () => {
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'ko', message: '오늘 연습 힘들었어' }), { code: 'ko', changed: false });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'ko', message: 'I had a rough practice today' }), { code: 'ko', changed: false },
    'writing in English does not change a chosen language');
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'ko', message: "Can we talk in English?" }), { code: 'en', changed: true });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'auto', message: '한국어로 이야기해요' }), { code: 'ko', changed: true },
    'asking in automatic mode switches the app too');
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'es', message: 'hablemos en español' }), { code: 'es', changed: false });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: undefined, message: 'hey' }), { code: null, changed: false });
  assert.deepEqual(language.resolveConversationLanguage({ chosen: 'zh-Hans', message: '今天训练很累' }), { code: 'zh', changed: false });
});

test('Nora is told to write in the chosen language over the per-turn rules', () => {
  const section = language.buildConversationLanguageSection('ko');
  assert.match(section, /chose Korean/);
  assert.match(section, /overrides the Conversation language rules/);
  assert.match(section, /asks to talk in another language, switch/);
  assert.equal(language.buildConversationLanguageSection(null), '');
  assert.equal(language.buildConversationLanguageSection('xx'), '');
});

test('every chosen language has a greeting for a turn with no topic', () => {
  for (const code of Object.keys(language.CONVERSATION_LANGUAGES)) {
    assert.ok(language.TOPICLESS_GREETING[code], code);
  }
  assert.equal(language.TOPICLESS_GREETING.en, 'Hi. What would you like to talk about today?');
});
