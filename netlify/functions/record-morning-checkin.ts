import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import { resolveUnambiguousAthleteScope } from './utils/pulsecheckAthleteScope';
import { openConversationFromTrigger } from '../../src/api/firebase/noraConversation/orchestrator';
import type { ConversationBranch, TranslationDomain } from '../../src/api/firebase/adaptiveFramingLayer/types';

/**
 * POST /.netlify/functions/record-morning-checkin
 *
 * Athlete completed the two-part morning check-in on the home screen.
 *
 *   1. Persist the readiness pick to `pulsecheck-morning-checkins/{userId}_{dayKey}`
 *      so the rest of the system (curriculum, coach reports, framing
 *      layer) can read the tone signal.
 *
 *   2. Only when `startConversation` is true, open the athlete-requested
 *      Nora conversation with a level-specific question.
 *
 * A completed check-in otherwise returns a warm acknowledgement and no
 * conversation id. This keeps the check-in athlete-led and avoids turning
 * every self-report into an unsolicited probe.
 *
 * Doctrine alignment: instead of static in-place noraResponse text, the
 * check-in becomes a real conversation that flows through Phase D's
 * state machine + Phase C's voice + guardrails on the action delivery.
 *
 * Body:
 *   { level: 'drained' | 'low' | 'okay' | 'solid' | 'locked',
 *     subjectiveRecoveryLevel?: 1 | 2 | 3 | 4 | 5,
 *     levelLabel?: string,        // optional display label override
 *     timezone?: string,
 *     openerText?: string,        // optional iOS context-selected opener
 *     probeText?: string,         // optional iOS context-selected probe
 *     probeVariant?: string,
 *     startConversation?: boolean,
 *     replaceExisting?: boolean } // same-day athlete correction
 */

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CheckinLevel = 'drained' | 'low' | 'okay' | 'solid' | 'locked';
const VALID_LEVELS: ReadonlyArray<CheckinLevel> = ['drained', 'low', 'okay', 'solid', 'locked'];
const CHECKIN_ACKNOWLEDGEMENT = 'Thanks for checking in. If you have a little time, we can talk more about what is behind it.';

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

const markMorningConversationAwaitingReply = async (
  db: admin.firestore.Firestore,
  conversation: any,
): Promise<any> => {
  if (!conversation?.id || !Array.isArray(conversation.turns)) return conversation;
  if (conversation.state !== 'opened') return conversation;

  const now = Date.now();
  const updatedConversation = {
    ...conversation,
    state: 'awaiting-reply',
    updatedAt: now,
  };

  await db
    .collection('pulsecheck-nora-conversations')
    .doc(conversation.id)
    .set(stripUndefinedDeep(updatedConversation) as Record<string, unknown>, { merge: false });
  return updatedConversation;
};

const buildRevisedMorningConversation = (
  conversation: any,
  branch: ConversationBranch,
  actionDomain: TranslationDomain,
  evidenceSummary: string,
  now = Date.now(),
): any => {
  const {
    actionState: _actionState,
    closedAt: _closedAt,
    revokedByUserId: _revokedByUserId,
    revokedReason: _revokedReason,
    ...retained
  } = conversation || {};
  return {
    ...retained,
    branchId: branch.id,
    actionDomain,
    state: 'awaiting-reply',
    turns: [
      {
        turnId: `${conversation.id}_t0`,
        index: 0,
        role: 'nora-opener',
        text: branch.opener.text,
        voiceReviewStatus: branch.opener.voiceReviewStatus,
        createdAt: now + 1,
      },
    ],
    triggerEvidence: { summary: evidenceSummary },
    updatedAt: now + 1,
  };
};

const reviseMorningConversation = async (
  db: admin.firestore.Firestore,
  conversation: any,
  branch: ConversationBranch,
  actionDomain: TranslationDomain,
  evidenceSummary: string,
): Promise<any> => {
  if (!conversation?.id || conversation.state === 'closed-revoked') return conversation;
  const revised = buildRevisedMorningConversation(
    conversation,
    branch,
    actionDomain,
    evidenceSummary,
  );
  await db.collection('pulsecheck-nora-conversations').doc(conversation.id).set(
    stripUndefinedDeep(revised) as Record<string, unknown>,
    { merge: false },
  );
  return revised;
};

// Used only after the athlete chooses to talk with Nora. Completing the
// check-in itself returns CHECKIN_ACKNOWLEDGEMENT and does not open a thread.
const OPENER_TEXT: Record<CheckinLevel, string> = {
  drained: 'What feels most important to talk through about feeling drained today?',
  low:     'What feels most important to talk through about feeling low today?',
  okay:    'What would be useful to talk through about how you feel today?',
  solid:   'What feels most worth talking through about feeling good today?',
  locked:  'What feels most worth talking through about feeling locked in today?',
};

const PROBE_TEXT: Record<CheckinLevel, string> = {
  drained: "What is making today hardest: your body, your mind, or your schedule?",
  low:     "What is the main reason you feel low today: sleep, stress, or workload?",
  okay:    "Is anything making today harder: sleep, stress, or focus?",
  solid:   "What is the main reason you feel good today: sleep, mood, or motivation?",
  locked:  "What is driving that locked-in feeling: good sleep, confidence, or a clear target?",
};

const ACTION_DELIVERY_TEXT: Record<CheckinLevel, string> = {
  drained: "Got it. Your skill training is unlocked on the home screen whenever you're ready.",
  low:     "Heard. Your skill training is unlocked on the home screen whenever you're ready.",
  okay:    "Got it. Your skill training is unlocked on the home screen whenever you're ready.",
  solid:   "Good. Your skill training is unlocked on the home screen whenever you're ready.",
  locked:  "Let's use it. Your skill training is unlocked on the home screen whenever you're ready.",
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

  let body: {
    level?: string;
    levelLabel?: string;
    timezone?: string;
    openerText?: unknown;
    probeText?: unknown;
    probeVariant?: unknown;
    subjectiveRecoveryLevel?: unknown;
    subjectiveRecoveryLabel?: unknown;
    startConversation?: boolean;
    replaceExisting?: boolean;
  };
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

  const subjectiveRecoveryLevel = body.subjectiveRecoveryLevel === undefined
    ? null
    : Number(body.subjectiveRecoveryLevel);
  if (
    subjectiveRecoveryLevel !== null
    && (!Number.isInteger(subjectiveRecoveryLevel) || subjectiveRecoveryLevel < 1 || subjectiveRecoveryLevel > 5)
  ) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'invalid_subjective_recovery_level', valid: [1, 2, 3, 4, 5] }),
    };
  }

  // Resolve the exact team and organization scope for coach visibility.
  // Very-fresh athletes may not have a membership yet; their personal
  // check-in still persists but remains outside every coach workspace.
  let teamId = '';
  let organizationId = '';
  let scopeWarning: string | null = null;
  let timezone = body.timezone || 'America/New_York';
  try {
    const resolution = await resolveUnambiguousAthleteScope(db, auth.uid);
    scopeWarning = resolution.warning;
    if (resolution.scope) {
      teamId = resolution.scope.teamId;
      organizationId = resolution.scope.organizationId;
      if (!body.timezone && resolution.scope.timezone) {
        timezone = resolution.scope.timezone;
      }
    } else {
      console.warn('Morning check-in saved without coach team scope.', {
        athleteUserId: auth.uid,
        scopeWarning,
        validScopeCount: resolution.validScopeCount,
      });
    }
  } catch (error) {
    scopeWarning = 'scope_resolution_failed';
    console.warn('Morning check-in team scope resolution failed.', {
      athleteUserId: auth.uid,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const dayKey = formatYmdInTz(new Date(), timezone);
  const checkinDocId = `${auth.uid}_${dayKey}`;
  const now = Date.now();
  const openerText = OPENER_TEXT[level];
  const probeText = sanitizeProbeText(body.probeText) || PROBE_TEXT[level];
  const probeVariant = sanitizeProbeVariant(body.probeVariant) || 'baseline';
  const startConversation = body.startConversation === true;
  const replaceExisting = body.replaceExisting === true;

  // Persist check-in.  This is the first source of truth for "athlete
  // started their day with tone X" — read by curriculum, coach reports,
  // and the framing layer.
  try {
    const checkInRef = db.collection('pulsecheck-morning-checkins').doc(checkinDocId);
    const previous = (await checkInRef.get()).data();
    const checkInWrite: Record<string, unknown> = {
      id: checkinDocId,
      athleteUserId: auth.uid,
      dayKey,
      level,
      levelLabel: body.levelLabel || level,
      acknowledgementText: CHECKIN_ACKNOWLEDGEMENT,
      conversationOpenerText: openerText,
      probeText,
      probeVariant,
      timezone,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
    if (subjectiveRecoveryLevel !== null) {
      checkInWrite.subjectiveRecoveryLevel = subjectiveRecoveryLevel;
      const recoveryLabel = typeof body.subjectiveRecoveryLabel === 'string'
        ? body.subjectiveRecoveryLabel.trim().slice(0, 80)
        : '';
      if (recoveryLabel) checkInWrite.subjectiveRecoveryLabel = recoveryLabel;
    }
    if (teamId && organizationId) {
      checkInWrite.teamId = teamId;
      checkInWrite.organizationId = organizationId;
    } else {
      checkInWrite.teamId = admin.firestore.FieldValue.delete();
      checkInWrite.organizationId = admin.firestore.FieldValue.delete();
    }
    if (replaceExisting) {
      checkInWrite.revisionCount = admin.firestore.FieldValue.increment(1);
      checkInWrite.signalValidation = admin.firestore.FieldValue.delete();
    }
    await checkInRef.set(checkInWrite, { merge: true });
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'persist_failed', detail: err?.message || String(err) }),
    };
  }

  if (!startConversation) {
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: true,
        conversationId: null,
        checkinDocId,
        noraResponse: CHECKIN_ACKNOWLEDGEMENT,
        noraProbe: null,
        probeVariant,
        scopeWarning,
      }),
    };
  }

  // The athlete explicitly chose to talk with Nora. The first visible
  // message is the contextual question, and the thread is ready for one
  // natural reply rather than presenting a stacked scripted exchange.
  const branch = synthesizeBranch(level, openerText, probeText);
  const evidenceSummary = `Morning check-in tone: ${level}. Probe variant: ${probeVariant}.`;
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
          summary: evidenceSummary,
        },
        dayKey,
      },
      { firestore: db },
    );
    conversation = replaceExisting
      ? await reviseMorningConversation(
          db,
          conversation,
          branch,
          ACTION_DOMAIN[level],
          evidenceSummary,
        )
      : await markMorningConversationAwaitingReply(db, conversation);
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
      conversationId: conversation.state === 'closed-revoked' ? null : conversation.id,
      checkinDocId,
      noraResponse: CHECKIN_ACKNOWLEDGEMENT,
      conversationOpener: openerText,
      noraProbe: probeText,
      probeVariant,
      scopeWarning,
    }),
  };
};

export const __internal = {
  buildRevisedMorningConversation,
  CHECKIN_ACKNOWLEDGEMENT,
  markMorningConversationAwaitingReply,
  synthesizeBranch,
};
