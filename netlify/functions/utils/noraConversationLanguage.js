// The language the athlete chose for talking with Nora. "Auto" (no choice) keeps the
// Conversation language rules, which follow each turn. A choice holds until the athlete
// changes it in the app or explicitly asks Nora to talk in another language.

const { requestedConversationLanguage } = require('./noraEngagementPolicy');

const CONVERSATION_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Brazilian Portuguese',
  zh: 'Mandarin Chinese, written in Simplified characters',
  ko: 'Korean',
  ja: 'Japanese',
};

const TOPICLESS_GREETING = {
  en: 'Hi. What would you like to talk about today?',
  es: 'Hola. ¿De qué quieres hablar hoy?',
  fr: 'Salut. De quoi veux-tu parler aujourd’hui ?',
  pt: 'Oi. Sobre o que você quer conversar hoje?',
  zh: '你好。你今天想聊些什么？',
  ko: '안녕하세요. 오늘은 어떤 이야기를 하고 싶어요?',
  ja: 'こんにちは。今日は何について話したいですか？',
};

function normalizeConversationLanguage(value) {
  const code = String(value || '').trim().toLowerCase().split(/[-_]/)[0];
  return Object.prototype.hasOwnProperty.call(CONVERSATION_LANGUAGES, code) ? code : null;
}

/**
 * The language for this turn: an explicit request in the message wins over the app's choice.
 * Returns { code, changed } where code is null for automatic.
 */
function resolveConversationLanguage({ chosen, message }) {
  const current = normalizeConversationLanguage(chosen);
  const requested = requestedConversationLanguage(message || '');
  if (requested && requested.code !== current) return { code: requested.code, changed: true };
  return { code: current, changed: false };
}

function buildConversationLanguageSection(code) {
  const name = CONVERSATION_LANGUAGES[code];
  if (!name) return '';
  return `\n\n### Chosen conversation language\nThe athlete chose ${name} for this conversation. Write every reply in ${name}, whatever language their message is written in. This overrides the Conversation language rules above. Keep a quoted coaching cue in its original words inside quotation marks if that helps, but write everything around it in ${name}. If the athlete asks to talk in another language, switch to it.`;
}

module.exports = {
  CONVERSATION_LANGUAGES,
  TOPICLESS_GREETING,
  normalizeConversationLanguage,
  resolveConversationLanguage,
  buildConversationLanguageSection,
};
