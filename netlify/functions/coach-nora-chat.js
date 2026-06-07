// Coach ↔ Nora Chat Function
// ----------------------------------------------------------------------------
// A coach-facing conversation with Nora that does two jobs:
//   1) Train Nora — when the coach says things like "remember this",
//      "make a note of this", or "train on this", Nora extracts a clean note
//      and writes it straight into the coach's knowledge vault
//      (coach-nora-vault), the same store the athlete-facing Nora reads from.
//   2) Team insight — the coach can ask "how is the team doing?",
//      "who should I check on?", etc. Nora answers from the live athlete
//      digest (sentiment + status derived from real athlete conversations)
//      and any recent escalation alerts.
//
// Request (POST):
//   {
//     coachId: string,
//     message: string,
//     history?: Array<{ role: 'user' | 'assistant', content: string }>,
//     athletes?: Array<{ displayName, status, sentimentScore,
//                        conversationCount, totalSessions, lastActiveDays }>
//   }
//
// Response:
//   { reply: string, savedNote: { id, title, category } | null }

const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');

const VAULT_COLLECTION = 'coach-nora-vault';
const ESCALATIONS_COLLECTION = 'escalation-records';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const truncate = (value, max) => {
  const str = String(value || '').trim();
  return str.length > max ? `${str.slice(0, max)}…` : str;
};

// Build a compact, text-only snapshot of the coach's vault for grounding.
async function loadVaultContext(db, coachId) {
  try {
    const snap = await db
      .collection(VAULT_COLLECTION)
      .where('coachId', '==', coachId)
      .get();
    return snap.docs
      .map((d) => d.data())
      .map((e) => {
        const label = e.category ? `[${e.category}] ` : '';
        const body = e.content || (e.type === 'file' || e.type === 'image' ? `(file: ${e.fileName || e.title})` : '');
        return `- ${label}${e.title}: ${truncate(body, 400)}`;
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('[coach-nora-chat] vault load failed', err);
    return [];
  }
}

// Pull recent active escalations for the coach's athletes (best-effort).
async function loadEscalationContext(db, athletes) {
  const ids = (athletes || [])
    .map((a) => a && a.id)
    .filter(Boolean)
    .slice(0, 30);
  if (ids.length === 0) return [];
  const nameById = new Map((athletes || []).map((a) => [a.id, a.displayName]));
  const lines = [];
  try {
    // Firestore `in` supports up to 30 values per query.
    const snap = await db
      .collection(ESCALATIONS_COLLECTION)
      .where('userId', 'in', ids)
      .get();
    snap.docs.forEach((d) => {
      const e = d.data() || {};
      if (e.status && e.status !== 'active') return;
      const who = nameById.get(e.userId) || 'An athlete';
      const sev = e.severity || e.category || 'flagged';
      const needsReview = e.requiresCoachReview ? ' — needs coach review' : '';
      lines.push(`- ${who}: ${sev}${needsReview}`);
    });
  } catch (err) {
    console.warn('[coach-nora-chat] escalation load failed', err);
  }
  return lines.slice(0, 20);
}

function buildAthleteDigest(athletes) {
  if (!Array.isArray(athletes) || athletes.length === 0) return [];
  return athletes.map((a) => {
    const last =
      a.lastActiveDays === null || a.lastActiveDays === undefined
        ? 'no check-ins yet'
        : a.lastActiveDays === 0
        ? 'checked in today'
        : `${a.lastActiveDays}d since last check-in`;
    const mood =
      typeof a.sentimentScore === 'number' ? `mood ${a.sentimentScore.toFixed(2)}` : 'mood —';
    return `- ${a.displayName} (${a.status || 'unknown'}): ${mood}, ${a.conversationCount || 0} conversations, ${last}`;
  });
}

function buildSystemPrompt({ coachName, vaultLines, athleteLines, escalationLines }) {
  return [
    `You are Nora, the team's assistant, talking directly with ${coachName || 'the coach'} inside their coaching dashboard.`,
    `Speak like a sharp, supportive coach — plain and human. Never sound clinical or academic. Keep replies short and directional: one idea at a time, no walls of text.`,
    ``,
    `You help the coach in two ways:`,
    `1) TRAINING — The coach can teach you facts about the team (schedules, policies, playbook details, logistics). When the coach clearly wants you to retain something — e.g. "remember this", "make a note", "train on this", or they simply state a durable team fact — capture it as a note so athletes can ask you about it later.`,
    `2) INSIGHT — The coach can ask how the team is doing, who to check on, or about trends. Answer from the ATHLETE SNAPSHOT and ALERTS below. You speak with athletes regularly, so surface what's pertinent. Never invent specifics you don't have; if you lack the detail, say what you'd watch and suggest the coach check in directly. Never expose private clinical detail — keep it to coaching-relevant signal.`,
    ``,
    `=== KNOWLEDGE VAULT (what you already know) ===`,
    vaultLines.length ? vaultLines.join('\n') : '(empty — nothing trained yet)',
    ``,
    `=== ATHLETE SNAPSHOT (live, from real check-ins) ===`,
    athleteLines.length ? athleteLines.join('\n') : '(no connected athletes yet)',
    ``,
    `=== ALERTS ===`,
    escalationLines.length ? escalationLines.join('\n') : '(no active alerts)',
    ``,
    `Respond with STRICT JSON only, no markdown, in this exact shape:`,
    `{`,
    `  "reply": "<your message to the coach>",`,
    `  "note": null OR { "title": "<short title>", "content": "<the fact to remember, self-contained>", "category": "<optional one-word group like Schedule, Policy, Playbook, or empty string>" }`,
    `}`,
    `Set "note" to a value ONLY when the coach is teaching you something to retain. For insight questions or chit-chat, set "note" to null. Echo back in "reply" what you saved when you save a note.`,
  ].join('\n');
}

async function callOpenAi({ systemPrompt, history, message }) {
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) throw new Error('Missing OPEN_AI_SECRET_KEY');

  const trimmedHistory = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-10)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: String(message).slice(0, 2000) },
  ];

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  const completion = await response.json();
  const raw = completion?.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch (_err) {
    // Model didn't return clean JSON — treat the whole thing as a plain reply.
    return { reply: String(raw).trim(), note: null };
  }
}

async function saveNote(db, coachId, note) {
  if (!note || !note.content || !String(note.content).trim()) return null;
  const docRef = db.collection(VAULT_COLLECTION).doc();
  const payload = {
    id: docRef.id,
    coachId,
    type: 'note',
    title: String(note.title || '').trim() || 'Note from chat',
    content: String(note.content).trim(),
    category: note.category ? String(note.category).trim() : null,
    url: null,
    source: 'coach-chat',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await docRef.set(payload);
  return { id: payload.id, title: payload.title, category: payload.category };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let db;
  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    db = admin.firestore();
  } catch (err) {
    console.error('[coach-nora-chat] Firebase init error', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Firebase initialization failed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_err) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON in request body' }) };
  }

  const { coachId, message, history, athletes, coachName } = body;
  if (!coachId || !message || !String(message).trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing coachId or message' }) };
  }

  try {
    const [vaultLines, escalationLines] = await Promise.all([
      loadVaultContext(db, coachId),
      loadEscalationContext(db, athletes),
    ]);
    const athleteLines = buildAthleteDigest(athletes);

    const systemPrompt = buildSystemPrompt({ coachName, vaultLines, athleteLines, escalationLines });
    const result = await callOpenAi({ systemPrompt, history, message });

    const reply =
      (result && typeof result.reply === 'string' && result.reply.trim()) ||
      "I'm here — tell me what to remember, or ask me how the team's doing.";

    let savedNote = null;
    if (result && result.note && typeof result.note === 'object') {
      savedNote = await saveNote(db, coachId, result.note);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ reply, savedNote }) };
  } catch (err) {
    console.error('[coach-nora-chat] handler error', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Chat failed', detail: err.message }),
    };
  }
};
