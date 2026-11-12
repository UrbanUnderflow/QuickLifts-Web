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

// Function words that mark a language. Words shared across Spanish, French and Portuguese
// ("que", "de", "como") are left out so the sets do not vote for each other.
const MARKERS = {
  en: new Set(['i', "i'm", 'im', 'the', 'and', 'my', 'to', 'is', 'but', 'it', 'you', 'what', 'was', 'have', 'this', 'that', 'me', 'of', 'in', 'with', 'for', 'am', 'are', "don't", 'just', 'so', 'not', 'can', 'how', 'we', 'be', 'at', 'on', 'really', 'feel', 'feeling', 'want', 'need', 'about', 'did', 'do', 'had', 'has', 'been', 'after', 'before', 'today', 'tonight', 'they', 'he', 'she', 'our', 'your', 'there', 'when', 'why', 'if', 'will', 'would', 'should', 'could', 'got', 'get', 'went', 'game', 'practice', 'went', 'think', 'know']),
  es: new Set(['el', 'los', 'las', 'y', 'pero', 'estoy', 'tengo', 'muy', 'hoy', 'cómo', 'qué', 'también', 'quiero', 'puedo', 'hola', 'gracias', 'eso', 'esto', 'yo', 'mucho', 'nada', 'cuando', 'está', 'siento', 'entrenamiento', 'partido', 'necesito', 'mañana', 'hablar', 'hablemos', 'sí']),
  fr: new Set(['je', 'suis', 'le', 'les', 'et', 'mais', 'mon', 'ma', 'est', 'pas', 'très', "aujourd'hui", "j'ai", "c'est", 'avec', 'pour', 'bonjour', 'salut', 'merci', 'entraînement', 'quoi', 'comment', 'pourquoi', 'aussi', 'veux', 'peux', 'ne', 'nous', 'vous', 'tu', 'il', 'elle', 'oui']),
  pt: new Set(['eu', 'estou', 'não', 'muito', 'hoje', 'mas', 'meu', 'minha', 'é', 'um', 'uma', 'com', 'para', 'você', 'treino', 'jogo', 'obrigado', 'obrigada', 'olá', 'oi', 'quero', 'posso', 'tô', 'tá', 'isso', 'sim', 'falar', 'estava']),
};
// One of these alone is enough ("hola", "merci").
const STRONG = { es: ['hola', 'gracias'], fr: ['bonjour', 'salut', 'merci'], pt: ['olá', 'obrigado', 'obrigada'] };

/**
 * The language a message is written in, by the athlete's rules: English mixed with another
 * language counts as English, two other languages count as the one they started in.
 * Returns a code, or null when the message is too short or unclear to tell.
 */
function detectMessageLanguage(message) {
  const text = String(message || '').toLowerCase().replace(/[’]/g, "'");
  const hasKana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
  const sequence = [];
  const counts = { en: 0, es: 0, fr: 0, pt: 0, ko: 0, zh: 0, ja: 0 };
  let strong = null;
  for (const [unit] of text.matchAll(/[\p{Script=Latin}']+|\p{Script=Hangul}|\p{Script=Han}|[\p{Script=Hiragana}\p{Script=Katakana}]/gu)) {
    let code = null;
    if (/\p{Script=Hangul}/u.test(unit)) code = 'ko';
    else if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(unit)) code = 'ja';
    else if (/\p{Script=Han}/u.test(unit)) code = hasKana ? 'ja' : 'zh';
    else {
      const word = unit.replace(/^'+|'+$/g, '');
      code = Object.keys(MARKERS).find((language) => MARKERS[language].has(word)) || null;
      for (const [language, words] of Object.entries(STRONG)) if (words.includes(word)) strong = strong || language;
    }
    if (code) { counts[code] += 1; sequence.push(code); }
  }
  const dense = (code) => counts[code] >= 2;
  const latin = (code) => counts[code] >= 2 || strong === code;
  const present = ['ko', 'zh', 'ja'].filter(dense).concat(['es', 'fr', 'pt'].filter(latin));
  if (counts.en >= 2 && present.length) return 'en';
  if (present.length > 1) return sequence.find((code) => present.includes(code)) || null;
  if (present.length === 1) return present[0];
  return counts.en >= 2 ? 'en' : null;
}

/**
 * The language for this turn. Without a choice from the app (older builds) Nora keeps her
 * per-turn rules. With one, an explicit request or a message clearly in another language
 * switches it. Returns { code, changed, detected }: code null means per-turn rules.
 */
function resolveConversationLanguage({ chosen, message }) {
  const current = normalizeConversationLanguage(chosen);
  const requested = requestedConversationLanguage(message || '');
  if (requested && requested.code !== current) return { code: requested.code, changed: true, detected: false };
  if (!current) return { code: null, changed: false, detected: false };
  const spoken = requested ? null : detectMessageLanguage(message);
  if (spoken && spoken !== current) return { code: spoken, changed: true, detected: true };
  return { code: current, changed: false, detected: false };
}

function buildConversationLanguageSection(code, { switched = false } = {}) {
  const name = CONVERSATION_LANGUAGES[code];
  if (!name) return '';
  const acknowledge = switched
    ? ` The athlete just switched to ${name}. Start with a few words in ${name} that show you noticed and are switching with them, then answer what they said.`
    : '';
  return `\n\n### Conversation language\nReply in ${name}.${acknowledge} Write every reply in ${name}; this overrides the per-turn language rules above. Keep a quoted coaching cue in its original words inside quotation marks if that helps, but write everything around it in ${name}.`;
}

module.exports = {
  CONVERSATION_LANGUAGES,
  TOPICLESS_GREETING,
  normalizeConversationLanguage,
  detectMessageLanguage,
  resolveConversationLanguage,
  buildConversationLanguageSection,
};
