/**
 * Nora guide for the journal composer (PulseCheck journal TDD, section 8.3).
 *
 * Endpoint: POST /.netlify/functions/journal-guide
 * Body: { draftId, type, moment, action?, previousQuestions? }
 * Auth: the athlete's own Firebase ID token.
 *
 * Every turn runs the safety check first, as every Nora turn does. A Tier 2 or Tier 3 draft escalates exactly like a
 * saved entry (decision D5) and gets no coaching question. Otherwise Nora returns one short follow-up question.
 * The guide is a Nora conversation, so only the pro youth track gets a question; the safety check still runs for every
 * track so a draft never skips escalation. Drafts are never stored here; only metadata is logged.
 *
 * Returns: { question }, { safety: { status: 'checkIn' | 'critical', escalationId, handoff? } },
 * or 403 { errorCode: 'nora_track_restricted' } for a clear draft on a junior or rookie track.
 */

const { initializeFirebaseAdmin, getFirebaseAdminApp, headers, admin } = require('./config/firebase');
const { runtimeHelpers: chatRuntime } = require('./pulsecheck-chat');
const { escalateJournalClassification, classifierMessage, _private: screenPrivate } = require('./journal-safety-screen');
const { resolvePulseCheckYouthTrack, allowsDirectNoraChat } = require('./utils/pulsecheck-youth-track');

const TYPES = ['evidence', 'gratitude', 'freewrite', 'injury'];
const MOMENT_LIMITS = { evidence: 4000, gratitude: 4000, freewrite: 8000, injury: 4000 };
const MAX_QUESTION_WORDS = 20;

const GUIDE_FOCUS = {
  injury: 'Ask about their own feelings about injury recovery or support they chose today. Rest counts. Never suggest rehab, exercise, treatment, recovery timelines, or return-to-play decisions.',
  evidence: 'Help them name what they did and what helped, so the entry works as proof they can handle a hard moment.',
  gratitude: 'Help them land on one concrete detail, person, or moment that made it matter.',
  freewrite: 'Follow their lead. Ask an open question about what they wrote. Do not steer them toward a lesson.',
};

function validate(body) {
  const type = TYPES.includes(body?.type) ? body.type : null;
  const moment = typeof body?.moment === 'string' ? body.moment.trim() : '';
  const action = typeof body?.action === 'string' ? body.action.trim() : '';
  const draftId = typeof body?.draftId === 'string' ? body.draftId.toLowerCase() : '';
  const previousQuestions = Array.isArray(body?.previousQuestions)
    ? body.previousQuestions.filter((q) => typeof q === 'string').slice(-3).map((q) => q.slice(0, 200))
    : [];
  if (!type || !/^[0-9a-f-]{36}$/.test(draftId)) return { error: 'Invalid request.' };
  if (!moment) return { error: 'Write a little first, then ask Nora.' };
  if (moment.length > MOMENT_LIMITS[type] || action.length > 2000) return { error: 'This draft is too long for the guide.' };
  return { type, moment, action: type === 'freewrite' ? '' : action, draftId, previousQuestions };
}

function guidePrompt({ type, moment, action, previousQuestions }) {
  const system = [
    'You are Nora, an AI mental-performance coach for athletes, helping an athlete write a private journal entry.',
    'Reply with exactly one question, at most 20 words, in plain words a smart 13-year-old understands.',
    GUIDE_FOCUS[type],
    'Stay on the topic they chose. Never write the entry for them, suggest sentences, rewrite, or summarize what they wrote.',
    'Do not ask about trauma, childhood, diagnoses, or hidden causes. Do not use em dashes. Output only the question.',
  ].join(' ');
  const user = [
    `Their draft so far:\n${moment}`,
    action ? `\nTheir second answer:\n${action}` : '',
    previousQuestions.length ? `\nQuestions you already asked, do not repeat them:\n- ${previousQuestions.join('\n- ')}` : '',
  ].join('');
  return { system, user };
}

function cleanQuestion(text) {
  let question = String(text || '').split('\n').map((line) => line.trim()).find(Boolean) || '';
  question = question.replace(/^["'“]+|["'”]+$/g, '').replace(/\s*[—–]\s*/g, ', ').trim();
  const words = question.split(/\s+/);
  if (words.length > MAX_QUESTION_WORDS) return null;
  return question.endsWith('?') ? question : null;
}

async function requestQuestion(draft, fetchImpl = fetch) {
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) throw new Error('Guide model unavailable');
  const { system, user } = guidePrompt(draft);
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 60,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!response.ok) throw new Error(`Guide model failed: ${response.status}`);
  const payload = await response.json();
  return cleanQuestion(payload?.choices?.[0]?.message?.content);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  const startedAt = Date.now();
  try {
    const request = { headers: event.headers || {} };
    initializeFirebaseAdmin(request);
    const app = getFirebaseAdminApp(request);
    const caller = await chatRuntime.verifyPulseCheckCaller(app, event);
    const draft = validate(JSON.parse(event.body || '{}'));
    if (draft.error) return { statusCode: 400, headers, body: JSON.stringify({ error: draft.error }) };
    const db = app.firestore();

    const message = classifierMessage({ type: draft.type, moment: draft.moment, action: draft.action });
    const [classification, youthTrack] = await Promise.all([
      chatRuntime.classifyEscalation(db, caller.userId, message, [], `journal_draft-${draft.draftId}`),
      resolvePulseCheckYouthTrack(db, caller.userId),
    ]);
    if (!classification) {
      // Fail closed, as Nora chat does: no coaching reply without a completed safety check.
      return { statusCode: 503, headers, body: JSON.stringify({ error: 'Nora could not check in right now. If you may be in immediate danger or need urgent help, call 911 or call or text 988 now.' }) };
    }
    let tier = Number(classification.tier) || 0;
    const requiresClinicalReview = tier === 3 && (Number(classification.confidence) || 0) < screenPrivate.TIER_3_CONFIDENCE_FLOOR;
    if (requiresClinicalReview) tier = 2;

    const escalated = await escalateJournalClassification({
      db,
      userId: caller.userId,
      messaging: app.messaging ? app.messaging() : admin.messaging(),
      message,
      classification: { ...classification, tier },
      requiresClinicalReview,
      sourceType: 'journal_draft',
      sourceRef: draft.draftId,
      excerpt: screenPrivate.approvedExcerpt({ moment: draft.moment }),
    });
    if (escalated.outcome !== 'clear') {
      console.log('[journal-guide]', JSON.stringify({ type: draft.type, outcome: escalated.outcome, ms: Date.now() - startedAt }));
      return { statusCode: 200, headers, body: JSON.stringify({ safety: { status: escalated.outcome, escalationId: escalated.escalationId, handoff: escalated.handoff } }) };
    }

    if (!allowsDirectNoraChat(youthTrack.track)) {
      console.log('[journal-guide]', JSON.stringify({ type: draft.type, outcome: 'track_restricted', track: youthTrack.track, ms: Date.now() - startedAt }));
      return { statusCode: 403, headers, body: JSON.stringify({ errorCode: 'nora_track_restricted', error: 'Nora journal questions are not part of your team plan.' }) };
    }

    const question = (await requestQuestion(draft)) || (await requestQuestion(draft));
    console.log('[journal-guide]', JSON.stringify({ type: draft.type, outcome: question ? 'question' : 'no_question', ms: Date.now() - startedAt }));
    if (!question) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Nora could not think of a question right now. Try again in a moment.' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ question }) };
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return { statusCode, headers, body: JSON.stringify({ error: statusCode === 401 ? 'Sign in is required.' : 'Nora could not check in right now. Try again in a moment.' }) };
  }
};

exports._private = { validate, guidePrompt, cleanQuestion };
