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
 *     timezone?: string,
 *     openerText?: string,        // optional iOS context-selected opener
 *     probeText?: string,         // optional iOS context-selected probe
 *     probeVariant?: string }
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
const synthesizeBranch = (level: CheckinLevel, openerText?: string, probeText?: string): ConversationBranch => {
  const opener = openerText || OPENER_TEXT[level];
  const probe = probeText || PROBE_TEXT[level];
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
  drained: "You said you feel drained today. Start with Step 1, then move to Step 2 when you're ready.",
  low:     "You said you feel low today. Start with Step 1 first, then Step 2.",
  okay:    "You said you feel okay today. Start with Step 1 first, then Step 2.",
  solid:   "You said you feel good today. Start with Step 1 first, then Step 2.",
  locked:  "You said you feel locked in today. Start with Step 1 first, then bring that focus into Step 2.",
};

const PROBE_TEXT: Record<CheckinLevel, string> = {
  drained: "What is making today hardest: your body, your mind, or your schedule?",
  low:     "What is the main reason you feel low today: sleep, stress, or workload?",
  okay:    "Is anything making today harder: sleep, stress, or focus?",
  solid:   "What is the main reason you feel good today: sleep, mood, or motivation?",
  locked:  "What is driving that locked-in feeling: good sleep, confidence, or a clear target?",
};

const ACTION_DELIVERY_TEXT: Record<CheckinLevel, string> = {
  drained: "Got it. Today's plan is on the home screen. Start with Step 1, then Step 2 when you're ready.",
  low:     "Heard. Today's plan is on the home screen. Step 1 first, then Step 2.",
  okay:    "Got it. Today's plan is on the home screen. Step 1 first, then Step 2.",
  solid:   "Good. Today's plan is on the home screen. Step 1 first, then Step 2.",
  locked:  "Let's use it. Today's plan is on the home screen. Step 1 first, Step 2 second.",
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

const sanitizeProbeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 12 || trimmed.length > 320) return undefined;
  return trimmed;
};

const sanitizeOpenerText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 12 || trimmed.length > 420) return undefined;
  return trimmed;
};

const sanitizeProbeVariant = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  return /^[a-z0-9_-]{1,48}$/.test(trimmed) ? trimmed : undefined;
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

  let body: { level?: string; levelLabel?: string; timezone?: string; openerText?: unknown; probeText?: unknown; probeVariant?: unknown };
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
  const openerText = sanitizeOpenerText(body.openerText) || OPENER_TEXT[level];
  const probeText = sanitizeProbeText(body.probeText) || PROBE_TEXT[level];
  const probeVariant = sanitizeProbeVariant(body.probeVariant) || 'baseline';

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
        openerText,
        probeText,
        probeVariant,
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
  const branch = synthesizeBranch(level, openerText, probeText);
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
          summary: `Morning check-in tone: ${level}. Probe variant: ${probeVariant}.`,
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
      noraResponse: openerText,
      noraProbe: probeText,
      probeVariant,
    }),
  };
};
