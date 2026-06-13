import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';

// ---------------------------------------------------------------------------
// award-pulse-points
//
// The ONE server-side path that writes the shared Pulse rank economy
// (users/{uid}.lifetimePulsePoints + categoryPoints.{discipline}). Required
// because security rules forbid clients from writing those fields directly —
// so every app (FWP and FitClub) routes its point award through here.
//
// Two modes (idempotent per award id, capped, authenticated):
//
//   FWP mode      { sessionId, streakDays }
//                 → server computes FitClub's lift formula:
//                   base 100 + first-completion 50 + streak×25
//
//   Explicit mode { awardId, discipline, points }
//                 → awards a precomputed total (FitClub already computes its
//                   PulsePoints for lift/run/burn); server bounds + dedupes it.
//
// Markers live at users/{uid}/pulse-point-awards/{awardId}.
// ---------------------------------------------------------------------------

const BASE_COMPLETION = 100;
const FIRST_COMPLETION = 50;
const STREAK_PER_DAY = 25;
const STREAK_DAY_CAP = 30;            // bounds the streak bonus (≤ 750)
const MAX_POINTS_PER_AWARD = 5000;    // hard ceiling on any single award
const VALID_DISCIPLINES = new Set(['strength', 'endurance', 'burn', 'flexibility', 'aqua']);

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'POST only' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Missing token' }) };
  }
  let uid: string;
  try {
    uid = (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Resolve award id + discipline (both modes).
  const awardId = String(body.awardId || body.sessionId || '').trim();
  if (!awardId) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'awardId required' }) };
  }
  const disciplineRaw = String(body.discipline || 'strength').trim().toLowerCase();
  const discipline = VALID_DISCIPLINES.has(disciplineRaw) ? disciplineRaw : 'strength';

  // Explicit mode if `points` provided; else FWP-formula mode.
  const explicitPoints = body.points != null
    ? Math.max(0, Math.min(MAX_POINTS_PER_AWARD, Math.floor(Number(body.points) || 0)))
    : null;
  const streakDays = Math.max(0, Math.min(STREAK_DAY_CAP, Math.floor(Number(body.streakDays) || 0)));

  const userRef = db.collection('users').doc(uid);
  const awardsRef = userRef.collection('pulse-point-awards');
  const markerRef = awardsRef.doc(awardId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const marker = await tx.get(markerRef);
      if (marker.exists) {
        return { alreadyAwarded: true, awarded: marker.data()?.points ?? 0 };
      }

      let points: number;
      let firstCompletion = false;
      if (explicitPoints != null) {
        points = explicitPoints;
      } else {
        // FWP formula. First award ever (no prior markers) → welcome bonus.
        const priorAwards = await tx.get(awardsRef.limit(1));
        firstCompletion = priorAwards.empty;
        points = BASE_COMPLETION + (firstCompletion ? FIRST_COMPLETION : 0) + streakDays * STREAK_PER_DAY;
      }

      if (points <= 0) return { alreadyAwarded: false, awarded: 0 };

      tx.set(markerRef, {
        points, discipline, firstCompletion, streakDays,
        awardedAt: Date.now(), source: explicitPoints != null ? 'explicit' : 'fwp',
      });
      tx.set(userRef, {
        lifetimePulsePoints: admin.firestore.FieldValue.increment(points),
        categoryPoints: { [discipline]: admin.firestore.FieldValue.increment(points) },
      }, { merge: true });

      return { alreadyAwarded: false, awarded: points };
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
  } catch (error) {
    console.error(`[award-pulse-points] failed for ${uid}:`, error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Award failed' }) };
  }
};

export { handler };
