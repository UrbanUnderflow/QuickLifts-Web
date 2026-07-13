import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import { openConversationFromTrigger } from '../../src/api/firebase/noraConversation/orchestrator';
import type { ConversationBranch, TranslationDomain } from '../../src/api/firebase/adaptiveFramingLayer/types';

/**
 * POST /.netlify/functions/junior-lesson-conversation
 *
 * Junior Track athlete started a lesson (or unit checkpoint) in the
 * guided curriculum. Opens a Nora conversation through the Phase D
 * orchestrator so the lesson's scripted opener/probe become a real,
 * replyable thread that flows through Phase C voice + guardrails on
 * the action delivery.
 *
 * Spec: PulseCheck repo, docs/specs/junior-track-guided-curriculum-spec.md.
 *
 * Content source of truth is the `junior-curriculum/{lessonId}` doc
 * (seeded via scripts/seedJuniorCurriculum.cjs). Scripts are never
 * accepted from the client: a junior surface must not be able to put
 * arbitrary text into Nora's mouth.
 *
 * Trigger mapping:
 *   kind == 'lesson'     -> 'junior-lesson-open'
 *   kind == 'checkpoint' -> 'junior-unit-checkpoint'
 * The lesson-close beat is the action-delivery turn of this same
 * conversation ('junior-lesson-close' stays reserved in the allowlist).
 *
 * Dedupe: one conversation per athlete per lesson per local day. The
 * orchestrator dedupes on {uid}_{trigger}_{dayKey}, so we pass a
 * composite dayKey of `${ymd}_${lessonId}` — replaying the same lesson
 * on the same day reuses the thread; a different lesson gets its own.
 *
 * Track guard: only athletes on a junior/rookie team may open these
 * (team `commercialConfig.youthTrack`). Athletes with no team resolve
 * to the junior default, mirroring PulseCheckYouthTrackService on iOS.
 *
 * Body: { lessonId: string, timezone?: string }
 * Returns: { ok, conversationId, state, trigger }
 */

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type JuniorLessonDoc = {
  pillarId?: string;
  unitTitle?: string;
  title?: string;
  kind?: string;
  noraOpener?: string;
  noraProbe?: string;
  takeawayCue?: string;
};

const LESSON_ID_PATTERN = /^[a-z0-9-]{3,64}$/;

// All junior lessons deliver a skill-practice action; 'load' is the
// closest existing translation domain (training/session guidance) and
// keeps the reply classifier grounded in training language.
const JUNIOR_ACTION_DOMAIN: TranslationDomain = 'load';

const synthesizeJuniorBranch = (
  lessonId: string,
  lesson: JuniorLessonDoc,
): ConversationBranch => {
  const isCheckpoint = (lesson.kind || 'lesson') === 'checkpoint';
  const trigger = isCheckpoint ? 'junior-unit-checkpoint' : 'junior-lesson-open';
  const branchId = `${trigger}-${lessonId}`;
  const opener = (lesson.noraOpener || '').trim();
  const probe = (lesson.noraProbe || '').trim();
  // Action delivery closes the loop with the takeaway cue. This string
  // is also the guardrail fallback if the LLM translation is rejected.
  const action = `${(lesson.takeawayCue || '').trim()} Nice work today. Your next session is on the home screen tomorrow.`.trim();
  return {
    id: branchId,
    trigger,
    description: `Junior curriculum ${isCheckpoint ? 'unit checkpoint' : 'lesson'}: ${lesson.title || lessonId} (${lesson.unitTitle || 'unit'}).`,
    opener: { nodeId: `${branchId}-opener`, text: opener, voiceReviewStatus: 'reviewed' },
    probe: { nodeId: `${branchId}-probe`, text: probe, voiceReviewStatus: 'reviewed' },
    actionDelivery: { nodeId: `${branchId}-action`, text: action, voiceReviewStatus: 'reviewed' },
    revisionId: 'junior-curriculum-v1',
    createdBy: 'system:junior-lesson-conversation',
  };
};

const stripUndefinedDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, item]) => {
      if (item === undefined) return acc;
      acc[key] = stripUndefinedDeep(item);
      return acc;
    }, {});
  }
  return value;
};

// Mirrors primeMorningCheckinProbe in record-morning-checkin.ts: the
// probe is part of the scripted open beat, so the thread should already
// be awaiting the athlete's reply when iOS shows it.
const primeJuniorProbe = async (
  db: admin.firestore.Firestore,
  conversation: any,
  branch: ConversationBranch,
): Promise<any> => {
  if (!conversation?.id || !Array.isArray(conversation.turns)) return conversation;
  const alreadyHasProbe = conversation.turns.some((turn: any) => turn?.role === 'nora-probe');
  if (alreadyHasProbe) return conversation;

  const now = Date.now();
  const probeTurn = {
    turnId: `${conversation.id}_t${conversation.turns.length}`,
    index: conversation.turns.length,
    role: 'nora-probe',
    text: branch.probe.text,
    voiceReviewStatus: branch.probe.voiceReviewStatus,
    createdAt: now + 1,
  };
  const updatedConversation = {
    ...conversation,
    state: 'awaiting-reply',
    turns: [...conversation.turns, probeTurn],
    updatedAt: now + 1,
  };

  await db
    .collection('pulsecheck-nora-conversations')
    .doc(conversation.id)
    .set(stripUndefinedDeep(updatedConversation) as Record<string, unknown>, { merge: false });
  return updatedConversation;
};

const verifyAuth = async (
  authHeader?: string,
): Promise<{ uid: string; email?: string } | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
};

const formatYmdInTz = (nowUtc: Date, timeZone: string): string => {
  const local = new Date(nowUtc.toLocaleString('en-US', { timeZone }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  await initAdmin();
  const db = await getFirestore();

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const auth = await verifyAuth(authHeader);
  if (!auth) {
    return { statusCode: 401, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'unauthenticated' }) };
  }

  let body: { lessonId?: string; timezone?: string };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as any) || {};
  } catch {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const lessonId = (body.lessonId || '').trim().toLowerCase();
  if (!LESSON_ID_PATTERN.test(lessonId)) {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'invalid_lesson_id' }) };
  }

  // Content source of truth: the seeded curriculum doc.
  const lessonSnap = await db.collection('junior-curriculum').doc(lessonId).get();
  if (!lessonSnap.exists) {
    return { statusCode: 404, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'lesson_not_found' }) };
  }
  const lesson = lessonSnap.data() as JuniorLessonDoc;
  if (!(lesson.noraOpener || '').trim() || !(lesson.noraProbe || '').trim()) {
    return { statusCode: 422, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'lesson_missing_scripts' }) };
  }

  // Resolve team + enforce the junior/rookie track guard.
  let teamId = '';
  let timezone = body.timezone || 'America/New_York';
  try {
    const memSnap = await db
      .collection('pulsecheck-team-memberships')
      .where('userId', '==', auth.uid)
      .where('role', '==', 'athlete')
      .limit(1)
      .get();
    if (!memSnap.empty) {
      const data = memSnap.docs[0].data();
      teamId = (data.teamId as string | undefined) || '';
      if (!body.timezone && data.timezone) timezone = String(data.timezone);
    }
  } catch {
    /* tolerate — no-team athletes default to junior below */
  }

  if (teamId) {
    try {
      const teamSnap = await db.collection('pulsecheck-teams').doc(teamId).get();
      const youthTrack = String(teamSnap.data()?.commercialConfig?.youthTrack || 'junior').toLowerCase();
      if (youthTrack !== 'junior' && youthTrack !== 'rookie') {
        return { statusCode: 403, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'junior_track_required' }) };
      }
    } catch {
      /* tolerate — unreadable team falls back to junior default */
    }
  }

  const branch = synthesizeJuniorBranch(lessonId, lesson);
  const ymd = formatYmdInTz(new Date(), timezone);
  // Composite key: per-lesson-per-day dedupe (see header comment).
  const dayKey = `${ymd}_${lessonId}`;

  let conversation;
  try {
    conversation = await openConversationFromTrigger(
      {
        athleteUserId: auth.uid,
        teamId,
        trigger: branch.trigger,
        branch,
        actionDomain: JUNIOR_ACTION_DOMAIN,
        evidence: {
          summary: `Junior curriculum ${branch.trigger === 'junior-unit-checkpoint' ? 'checkpoint' : 'lesson'} started: ${lesson.title || lessonId} (${lesson.unitTitle || 'unit'}).`,
        },
        dayKey,
      },
      { firestore: db },
    );
    conversation = await primeJuniorProbe(db, conversation, branch);
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ ok: false, error: 'open_conversation_failed', detail: err?.message || String(err) }),
    };
  }

  return {
    statusCode: 200,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      ok: true,
      conversationId: conversation.id,
      state: conversation.state,
      trigger: branch.trigger,
    }),
  };
};

// Exposed for unit tests (mirrors the __internal convention used by the
// Nora orchestrator tests).
export const __internal = {
  synthesizeJuniorBranch,
  formatYmdInTz,
  LESSON_ID_PATTERN,
};
