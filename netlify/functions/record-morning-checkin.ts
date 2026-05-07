import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import { openConversationFromTrigger } from '../../src/api/firebase/noraConversation/orchestrator';
import type { ConversationBranch, TranslationDomain } from '../../src/api/firebase/adaptiveFramingLayer/types';

/**
 * POST /.netlify/functions/record-morning-checkin
 *
 * Athlete tapped a readiness emoji on the home screen. Two things happen
 * server-side as a single transaction:
 *
 *   1. Persist the readiness pick to `pulsecheck-morning-checkins/{userId}_{dayKey}`
 *      so the rest of the system (curriculum, coach reports, framing
 *      layer) can read the tone signal.
 *
 *   2. Open a Nora conversation via the Phase D orchestrator with
 *      trigger='morning-checkin-tone' and the level-specific opener
 *      pulled from the matched branch (synthesized in-memory until
 *      Phase B seed promotes them to Firestore).
 *
 * Returns the conversation id so iOS can deep-link the athlete into
 * NoraInboxView. The opener turn is already populated; athlete sees
 * Nora's level-specific message + can reply naturally.
 *
 * Doctrine alignment: instead of static in-place noraResponse text, the
 * check-in becomes a real conversation that flows through Phase D's
 * state machine + Phase C's voice + guardrails on the action delivery.
 *
 * Body:
 *   { level: 'drained' | 'low' | 'okay' | 'solid' | 'locked',
 *     levelLabel?: string,        // optional display label override
 *     timezone?: string }
 */

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CheckinLevel = 'drained' | 'low' | 'okay' | 'solid' | 'locked';
const VALID_LEVELS: ReadonlyArray<CheckinLevel> = ['drained', 'low', 'okay', 'solid', 'locked'];

// In-memory branch synthesis. Mirrors the iOS `noraResponse` strings
// 1:1 so the athlete sees the same opener text regardless of where they
// land (in-place quick response OR full chat). Single source of truth
// can move to Firestore via a Phase B seed update; deferred for v1 so
// the morning check-in path doesn't depend on a new seeder run.
//
// Voice review status is 'reviewed' rather than 'seed-pending-review'
// because these strings already exist and have been used in production
// via the iOS in-place display.
const synthesizeBranch = (level: CheckinLevel): ConversationBranch => {
  const opener = OPENER_TEXT[level];
  const probe = PROBE_TEXT[level];
  const action = ACTION_DELIVERY_TEXT[level];
  const branchId = `morning-checkin-tone-${level}`;
  return {
    id: branchId,
    trigger: 'morning-checkin-tone',
    description: `Morning check-in (${level}) — opens after athlete taps the readiness emoji on the home screen.`,
    opener: { nodeId: `${branchId}-opener`, text: opener, voiceReviewStatus: 'reviewed' },
    probe: { nodeId: `${branchId}-probe`, text: probe, voiceReviewStatus: 'reviewed' },
    actionDelivery: { nodeId: `${branchId}-action`, text: action, voiceReviewStatus: 'reviewed' },
    revisionId: 'morning-checkin-synthetic-v1',
    createdBy: 'system:morning-checkin',
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

const primeMorningCheckinProbe = async (
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

// Mirrors NoraDailyView.ReadinessLevel.noraResponse on iOS. Keep these
// byte-identical with PulseCheck/Views/Chat/NoraDailyView.swift's
// `noraResponse` cases — both must pass the Nora voice rubric (10
// questions) documented at the top of that file.
const OPENER_TEXT: Record<CheckinLevel, string> = {
  drained: "You came in drained today — low fuel. We'll lower the pace and cut the sim if it won't help.",
  low:     "You came in low today — less fuel than usual. We'll start with the protocol and keep the sim optional.",
  okay:    "You came in steady today — not flat, not flying. We'll keep today's protocol and sim at the normal pace.",
  solid:   "You came in with good energy today. We'll start controlled, then raise pressure in the sim.",
  locked:  "You came in locked today — high energy. We'll put that into today's sim, not extra volume.",
};

const PROBE_TEXT: Record<CheckinLevel, string> = {
  drained: "Where's the drag worst — body, head, or schedule? I'll cut the sim or lower the pace.",
  low:     "What's pulling you down most — sleep, stress, or workload? I'll choose the lighter protocol or sim path.",
  okay:    "Anything weighing on you — sleep, life, or focus? I'll use that to lower or raise today's pace.",
  solid:   "What's clicking — sleep, headspace, or motivation? I'll use that to choose the first pressure level.",
  locked:  "What lit you up — sleep, mindset, or a target? I'll use that to set today's sim intensity.",
};

const ACTION_DELIVERY_TEXT: Record<CheckinLevel, string> = {
  drained: "Got it. Today's plan is on the home screen — start with the protocol; sim is optional. Hydrate.",
  low:     "Heard. Today's plan is on the home screen — protocol first, sim when you're ready.",
  okay:    "Got it. Today's plan is on the home screen — knock out both when you can.",
  solid:   "Nice. Today's plan is on the home screen — both protocol and sim are queued up.",
  locked:  "Let's go. Today's plan is on the home screen — protocol's the warm-up, sim's the work.",
};

// Domain mapping for Phase C translation lookups during the action-delivery
// turn (when athlete replies to the probe and the orchestrator generates
// final guidance via translateForAthlete).  Drained/low map to autonomic
// because the priority is regulation; okay/solid/locked map to load
// because the priority is matching today's session.
const ACTION_DOMAIN: Record<CheckinLevel, TranslationDomain> = {
  drained: 'autonomic',
  low:     'autonomic',
  okay:    'load',
  solid:   'load',
  locked:  'load',
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

  let body: { level?: string; levelLabel?: string; timezone?: string };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as any) || {};
  } catch {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const level = (body.level || '').trim().toLowerCase() as CheckinLevel;
  if (!VALID_LEVELS.includes(level)) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'invalid_level', valid: VALID_LEVELS }),
    };
  }

  // Resolve teamId for orchestrator.  Tolerate missing membership doc
  // (very-fresh athletes might not have one) by falling back to ''.
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
    /* tolerate */
  }

  const dayKey = formatYmdInTz(new Date(), timezone);
  const checkinDocId = `${auth.uid}_${dayKey}`;
  const now = Date.now();

  // Persist check-in.  This is the first source of truth for "athlete
  // started their day with tone X" — read by curriculum, coach reports,
  // and the framing layer.
  try {
    await db.collection('pulsecheck-morning-checkins').doc(checkinDocId).set(
      {
        id: checkinDocId,
        athleteUserId: auth.uid,
        teamId,
        dayKey,
        level,
        levelLabel: body.levelLabel || level,
        timezone,
        createdAt: now,
      },
      { merge: true },
    );
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'persist_failed', detail: err?.message || String(err) }),
    };
  }

  // Open the Nora conversation.  Synthesized branch contains the iOS
  // noraResponse text as the opener so the athlete experiences a
  // continuous narrative whether they stay on the home screen or
  // navigate into the chat thread.
  const branch = synthesizeBranch(level);
  let conversation;
  try {
    conversation = await openConversationFromTrigger(
      {
        athleteUserId: auth.uid,
        teamId,
        trigger: 'morning-checkin-tone',
        branch,
        actionDomain: ACTION_DOMAIN[level],
        evidence: {
          summary: `Morning check-in tone: ${level}.`,
        },
        dayKey,
      },
      { firestore: db },
    );
    conversation = await primeMorningCheckinProbe(db, conversation, branch);
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: 'open_conversation_failed',
        detail: err?.message || String(err),
      }),
    };
  }

  return {
    statusCode: 200,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      ok: true,
      conversationId: conversation.id,
      checkinDocId,
      noraResponse: OPENER_TEXT[level],
    }),
  };
};
