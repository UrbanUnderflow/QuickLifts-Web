import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import { generateDailyAssignmentAdmin } from './utils/dailyCurriculumAdmin';

/**
 * POST /.netlify/functions/ensure-todays-curriculum-assignment
 *
 * Ensures the signed-in athlete has a curriculum-engine six-item slate for
 * today (athlete-local). Called by iOS on home-screen appear so the
 * "Today" card is never empty — even before the morning cron has fired.
 *
 * Idempotent: if the athlete already has three protocol assignments and
 * three simulation assignments for sourceDate=today, returns without writing.
 * Partial legacy days are topped up by the generator.
 *
 * Doctrine: athletes always have something to train. The cron handles
 * the bulk path; this endpoint covers (a) brand-new athletes onboarded
 * mid-day, (b) athletes whose phone clock crosses midnight before the
 * cron sweeps their timezone, and (c) iOS first-launch races.
 *
 * Body (optional): { timezone: string, sourceDate: 'YYYY-MM-DD' }
 *   - timezone defaults to athlete's stored timezone or America/New_York
 *   - sourceDate defaults to athlete-local today
 *
 * Returns: { ok: true, assignmentExisted: boolean, generated: CurriculumGenerationResult | null }
 *   - assignmentExisted=true means a curriculum-engine doc already existed; no work done
 *   - assignmentExisted=false + generated=non-null means a new assignment was written
 *   - assignmentExisted=false + generated=null means generation failed (pool too thin, engine off, etc.)
 */

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

const hasText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const isCoherentAssignment = (
  data: admin.firestore.DocumentData,
  expectedKind: 'protocol' | 'simulation',
): boolean => {
  if (expectedKind === 'protocol') {
    return hasText(data.protocolId)
      && hasText(data.protocolLabel)
      && !hasText(data.simSpecId)
      && !hasText(data.simName);
  }
  return hasText(data.simSpecId)
    && hasText(data.simName)
    && !hasText(data.protocolId)
    && !hasText(data.protocolLabel);
};

const assignmentAssetId = (
  data: admin.firestore.DocumentData,
  kind: 'protocol' | 'simulation',
): string | undefined => {
  const value = kind === 'protocol' ? data.protocolId : data.simSpecId;
  return hasText(value) ? String(value).trim() : undefined;
};

const assignmentPillar = (
  data: admin.firestore.DocumentData,
): 'composure' | 'focus' | 'decision' | undefined => {
  const intent = data.curriculumIntent && typeof data.curriculumIntent === 'object'
    ? data.curriculumIntent as Record<string, unknown>
    : undefined;
  const raw = data.cognitivePillar
    || intent?.cognitivePillar
    || intent?.drivingPillar;
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (normalized === 'composure' || normalized === 'focus' || normalized === 'decision') {
    return normalized;
  }
  return undefined;
};

const hasCompleteSkillCoverage = (
  docs: admin.firestore.QueryDocumentSnapshot[],
  kind: 'protocol' | 'simulation',
): boolean => {
  const actionTypes = kind === 'protocol'
    ? new Set(['protocol'])
    : new Set(['simulation', 'sim']);
  const assets = new Set<string>();
  const pillars = new Set<string>();

  for (const doc of docs) {
    const data = doc.data();
    const actionType = String(data.actionType || '').toLowerCase();
    if (!actionTypes.has(actionType) || !isCoherentAssignment(data, kind)) continue;
    const assetId = assignmentAssetId(data, kind);
    const pillar = assignmentPillar(data);
    if (assetId) assets.add(assetId);
    if (pillar) pillars.add(pillar);
  }

  return assets.size >= 3
    && pillars.has('composure')
    && pillars.has('focus')
    && pillars.has('decision');
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

  let body: { timezone?: string; sourceDate?: string } = {};
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as any) || {};
  } catch {
    body = {};
  }

  // Resolve athlete's team membership to derive teamId / sportId — required
  // by the generator for per-sport pillar weights + assignment metadata.
  let athleteMembership: admin.firestore.DocumentData | null = null;
  let athleteMembershipId: string | null = null;
  try {
    const memSnap = await db
      .collection('pulsecheck-team-memberships')
      .where('userId', '==', auth.uid)
      .where('role', '==', 'athlete')
      .limit(1)
      .get();
    if (!memSnap.empty) {
      const doc = memSnap.docs[0];
      athleteMembership = doc.data();
      athleteMembershipId = doc.id;
    }
  } catch {
    /* tolerate */
  }
  if (!athleteMembership) {
    return {
      statusCode: 404,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'no_athlete_membership' }),
    };
  }

  const tz =
    body.timezone ||
    (athleteMembership.timezone as string | undefined) ||
    'America/New_York';
  const sourceDate = body.sourceDate || formatYmdInTz(new Date(), tz);

  // Idempotency check — if curriculum-engine already wrote today's full
  // six-item slate, short-circuit. Partial legacy days are topped up below.
  const existing = await db
    .collection('pulsecheck-daily-assignments')
    .where('athleteId', '==', auth.uid)
    .where('sourceDate', '==', sourceDate)
    .where('assignedBy', '==', 'curriculum-engine')
    .limit(12)
    .get()
    .catch(() => null);
  const existingDocs = existing?.docs ?? [];
  if (
    hasCompleteSkillCoverage(existingDocs, 'protocol')
    && hasCompleteSkillCoverage(existingDocs, 'simulation')
  ) {
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: true,
        assignmentExisted: true,
        generated: null,
      }),
    };
  }

  // Generate.  The admin-SDK adapter handles config read, pillar balance,
  // and Firestore writes.  Returns null if engine is disabled or asset
  // pool is too thin — caller treats null as "no assignment available".
  let generated;
  try {
    generated = await generateDailyAssignmentAdmin(db, {
      athleteUserId: auth.uid,
      teamId: (athleteMembership.teamId as string | undefined) || '',
      teamMembershipId: athleteMembershipId || '',
      sportId:
        (athleteMembership.sportId as string | undefined) ||
        ((athleteMembership.athleteOnboarding as { sportId?: string } | undefined)?.sportId),
      sourceDate,
      timezone: tz,
    });
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: 'generation_failed',
        detail: err?.message || String(err),
      }),
    };
  }

  return {
    statusCode: 200,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      ok: true,
      assignmentExisted: false,
      generated,
    }),
  };
};
