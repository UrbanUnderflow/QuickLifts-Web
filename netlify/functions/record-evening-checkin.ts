import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CheckinLevel = 'drained' | 'low' | 'okay' | 'solid' | 'locked';

const VALID_LEVELS: ReadonlyArray<CheckinLevel> = ['drained', 'low', 'okay', 'solid', 'locked'];
const VALID_REFLECTIONS = new Set([
  'My energy',
  'My mood',
  'School',
  'Practice or a game',
  'Something else',
  'Friends or family',
  'Nothing big',
  'I handled something well',
  'Training or a competition',
  'Training or a race',
  'Training or a meet',
  'Practice or a match',
  'Practice or a meet',
  'Practice or a tournament',
]);

const DEFAULT_OPENERS: Record<CheckinLevel, string> = {
  drained: 'That sounds like a tough day. Thanks for checking in.',
  low: 'Sounds like today took a lot out of you. Thanks for noticing it.',
  okay: 'Today felt okay. Thanks for taking a minute to look back.',
  solid: "Sounds like today felt good. Let's notice what helped.",
  locked: "Sounds like today felt great. Let's notice what you want to remember.",
};

const DEFAULT_PROBES: Record<CheckinLevel, string> = {
  drained: 'What made today feel hardest?',
  low: 'What took the most out of you today?',
  okay: 'What stands out when you think about today?',
  solid: 'What helped today feel good?',
  locked: 'What is one part of today you want to remember?',
};

const DEFAULT_ACTION = 'Thanks. You noticed what shaped your day. That awareness counts.';

const verifyAuth = async (authHeader?: string): Promise<{ uid: string } | null> => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
};

const formatYmdInTz = (nowUtc: Date, timeZone: string): string => {
  const local = new Date(nowUtc.toLocaleString('en-US', { timeZone }));
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sanitizeText = (value: unknown, fallback: string, maxLength: number): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > maxLength) return fallback;
  return trimmed;
};

const sanitizeReflection = (value: unknown): string | undefined => (
  typeof value === 'string' && VALID_REFLECTIONS.has(value) ? value : undefined
);

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  await initAdmin();
  const db = await getFirestore();
  const auth = await verifyAuth(event.headers?.authorization || event.headers?.Authorization);
  if (!auth) {
    return { statusCode: 401, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'unauthenticated' }) };
  }

  let body: Record<string, unknown>;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as Record<string, unknown>) || {};
  } catch {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const level = String(body.level || '').trim().toLowerCase() as CheckinLevel;
  if (!VALID_LEVELS.includes(level)) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'invalid_level', valid: VALID_LEVELS }),
    };
  }

  let timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'America/New_York';
  let teamId = '';
  try {
    const membership = await db
      .collection('pulsecheck-team-memberships')
      .where('userId', '==', auth.uid)
      .where('role', '==', 'athlete')
      .limit(1)
      .get();
    if (!membership.empty) {
      const membershipData = membership.docs[0].data();
      teamId = String(membershipData.teamId || '');
      if (!body.timezone && membershipData.timezone) timezone = String(membershipData.timezone);
    }
  } catch {
    // A new athlete may not have a membership yet; the personal check-in still persists.
  }

  const now = Date.now();
  const dayKey = formatYmdInTz(new Date(), timezone);
  const checkinDocId = `${auth.uid}_${dayKey}`;
  const docRef = db.collection('pulsecheck-morning-checkins').doc(checkinDocId);
  const reflection = sanitizeReflection(body.reflection);
  const replaceExisting = body.replaceExisting === true;
  const openerText = sanitizeText(body.openerText, DEFAULT_OPENERS[level], 420);
  const probeText = sanitizeText(body.probeText, DEFAULT_PROBES[level], 320);
  const actionText = sanitizeText(body.actionText, DEFAULT_ACTION, 320);

  try {
    const existing = await docRef.get();
    const existingEvening = (existing.data()?.eveningCheckIn || {}) as Record<string, unknown>;
    const eveningCheckIn: Record<string, unknown> = {
      ...existingEvening,
      level,
      levelLabel: sanitizeText(body.levelLabel, level, 48),
      openerText,
      probeText,
      actionText,
      timezone,
      createdAt: existingEvening.createdAt || now,
      updatedAt: now,
    };
    if (replaceExisting) {
      delete eveningCheckIn.reflection;
      eveningCheckIn.revisionCount = Number(existingEvening.revisionCount || 0) + 1;
    }
    if (reflection) eveningCheckIn.reflection = reflection;

    await docRef.set(
      {
        id: checkinDocId,
        athleteUserId: auth.uid,
        teamId,
        dayKey,
        timezone,
        eveningCheckIn,
      },
      { merge: true },
    );
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'persist_failed', detail: error?.message || String(error) }),
    };
  }

  return {
    statusCode: 200,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      ok: true,
      checkinDocId,
      noraResponse: openerText,
      noraProbe: probeText,
      noraAction: actionText,
      reflection: reflection || null,
    }),
  };
};

export const __internal = {
  formatYmdInTz,
  sanitizeReflection,
  sanitizeText,
};
