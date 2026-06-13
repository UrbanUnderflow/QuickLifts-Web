import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';

// ---------------------------------------------------------------------------
// award-pulse-points
//
// Awards Pulse Points for a completed FWP workout using the SAME formula
// FitClub uses for a lift workout (WorkoutSessionService):
//
//   base completion ...... 100   (always)
//   first completion ...... 50   (the user's first Pulse workout award only)
//   streak bonus ......... 25 × consecutive training days
//
// Points land on the SHARED economy (users/{uid}.lifetimePulsePoints +
// categoryPoints.strength), so a workout is worth the same whether it was
// done in FWP or FitClub. Done server-side because security rules (correctly)
// forbid clients from writing the points fields directly.
//
// Idempotent per workout: an award marker at
// users/{uid}/fitWithPulse-pointAwards/{sessionId} prevents double-awarding
// the same session (retries, replays).
// ---------------------------------------------------------------------------

const BASE_COMPLETION = 100;
const FIRST_COMPLETION = 50;
const STREAK_PER_DAY = 25;
const STREAK_DAY_CAP = 30;        // bounds the streak bonus (≤ 750)
const DISCIPLINE = 'strength';

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

  let sessionId = '';
  let streakDays = 0;
  try {
    const body = JSON.parse(event.body || '{}');
    sessionId = String(body.sessionId || '').trim();
    streakDays = Math.max(0, Math.min(STREAK_DAY_CAP, Math.floor(Number(body.streakDays) || 0)));
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  if (!sessionId) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'sessionId required' }) };
  }

  const userRef = db.collection('users').doc(uid);
  const awardsRef = userRef.collection('fitWithPulse-pointAwards');
  const markerRef = awardsRef.doc(sessionId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const marker = await tx.get(markerRef);
      if (marker.exists) {
        return { alreadyAwarded: true, awarded: marker.data()?.points ?? 0 };
      }
      // First award ever for this user (no prior markers) → first-completion bonus.
      const priorAwards = await tx.get(awardsRef.limit(1));
      const isFirst = priorAwards.empty;

      const points = BASE_COMPLETION
        + (isFirst ? FIRST_COMPLETION : 0)
        + streakDays * STREAK_PER_DAY;

      tx.set(markerRef, {
        points, streakDays, firstCompletion: isFirst,
        awardedAt: Date.now(), source: 'fwp',
      });
      tx.set(userRef, {
        lifetimePulsePoints: admin.firestore.FieldValue.increment(points),
        categoryPoints: { [DISCIPLINE]: admin.firestore.FieldValue.increment(points) },
      }, { merge: true });

      return { alreadyAwarded: false, awarded: points };
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error(`[award-pulse-points] failed for ${uid}:`, error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Award failed' }) };
  }
};

export { handler };
