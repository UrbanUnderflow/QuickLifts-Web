import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';

// ---------------------------------------------------------------------------
// exercise-doc-validator
//
// Heals mislabeled `exercises` docs reported by generation-time validation in
// FWP (e.g. "Chest Supported Rows" tagged shoulders). The client NEVER writes
// the catalog; it reports here, and this function:
//   1. verifies the caller's Firebase ID token,
//   2. independently re-derives the decisive region from the exercise NAME
//      (never trusts the client's proposal),
//   3. updates primaryBodyParts ONLY if the doc still carries the observed
//      wrong region, with a full audit trail on the doc.
//
// Decisive-only: ambiguous names are rejected, not guessed at.
// ---------------------------------------------------------------------------

type Region = 'chest' | 'back' | 'shoulders' | 'arms' | 'traps' | 'core'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves';

const tokenize = (name: string): string[] =>
  name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/// Mirror of FWP's RegionValidator.decisiveRegion — must stay in lockstep.
const decisiveRegion = (name: string): Region | null => {
  const tokens = tokenize(name);
  const set = new Set(tokens);
  const joined = ` ${tokens.join(' ')} `;
  const has = (phrase: string) => joined.includes(` ${phrase} `);
  const any = (...words: string[]) => words.some((w) => set.has(w));

  if (has('face pull')) return 'traps';
  if (any('shrug', 'shrugs', 'trapezius', 'trap', 'traps')) return 'traps';
  // Upright rows are a delt/trap accessory — NOT a back pull.
  if (set.has('upright')) return 'shoulders';
  if (!any('tricep', 'triceps')) {
    if (any('row', 'rows', 'pulldown', 'pulldowns', 'pullup', 'pullups', 'chinup', 'chinups')
      || has('pull down') || has('pull downs') || has('pull up') || has('pull ups') || has('chin up')) {
      return 'back';
    }
  }
  if (any('plank', 'planks', 'crunch', 'crunches', 'situp', 'situps') || has('sit up')) return 'core';
  if (has('leg curl') || has('hamstring curl')) return 'hamstrings';
  if (any('deadlift', 'deadlifts', 'rdl')) return 'hamstrings';
  if (has('hip thrust') || any('glute', 'glutes')) return 'glutes';
  if (any('calf', 'calves')) return 'calves';
  if (has('leg press') || any('squat', 'squats', 'lunge', 'lunges')) return 'quads';
  if (has('lateral raise') || has('lateral raises') || has('shoulder press')
    || has('overhead press') || has('arnold press') || any('delt', 'delts')) return 'shoulders';
  if (any('curl', 'curls', 'tricep', 'triceps')) return 'arms';
  if (any('bench') || has('chest press') || has('chest fly')
    || any('fly', 'flye', 'flyes', 'pushup', 'pushups')) return 'chest';
  return null;
};

/// Map a stored primaryBodyParts entry to our coarse region (mirror of FWP's
/// ExerciseInfo.region).
const coarseRegion = (bodyPart: string): Region | null => {
  switch (bodyPart.toLowerCase()) {
    case 'chest': return 'chest';
    case 'quadriceps': case 'quads': return 'quads';
    case 'hamstrings': return 'hamstrings';
    case 'glutes': return 'glutes';
    case 'calves': return 'calves';
    case 'shoulders': case 'deltoids': return 'shoulders';
    case 'biceps': case 'triceps': case 'forearms': return 'arms';
    case 'back': case 'lats': case 'rhomboids': case 'lowerback': return 'back';
    case 'traps': return 'traps';
    case 'abs': case 'core': return 'core';
    default: return null;
  }
};

/// What to WRITE for a corrected region.
const bodyPartFor: Record<Region, string> = {
  chest: 'chest', back: 'back', shoulders: 'shoulders', arms: 'biceps',
  traps: 'traps', core: 'abs', quads: 'quadriceps', hamstrings: 'hamstrings',
  glutes: 'glutes', calves: 'calves',
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'POST only' }) };
  }

  // 1. Authenticated callers only.
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

  let exerciseName = '';
  let observedRegion = '';
  try {
    const body = JSON.parse(event.body || '{}');
    exerciseName = String(body.exerciseName || '').trim();
    observedRegion = String(body.observedRegion || '').trim().toLowerCase();
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  if (!exerciseName || !observedRegion) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'exerciseName and observedRegion required' }) };
  }

  // 2. Re-derive independently — the client's proposal is advisory only.
  const derived = decisiveRegion(exerciseName);
  if (!derived || derived === observedRegion) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ updated: 0, reason: derived ? 'doc already matches' : 'name not decisive' }),
    };
  }

  // 3. Find the doc(s) by name variants and heal only those still carrying
  //    the observed wrong region.
  const variants = [...new Set([
    exerciseName,
    exerciseName.toLowerCase(),
    exerciseName.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()),
  ])];
  const snapshot = await db.collection('exercises').where('name', 'in', variants).get();

  let updated = 0;
  for (const docSnap of snapshot.docs) {
    const parts: string[] = docSnap.data().primaryBodyParts || [];
    const currentRegion = parts.map(coarseRegion).find((r: Region | null) => r !== null) || null;
    if (currentRegion !== observedRegion || currentRegion === derived) continue;
    await docSnap.ref.update({
      primaryBodyParts: [bodyPartFor[derived]],
      regionAutoCorrected: {
        from: parts,
        to: bodyPartFor[derived],
        at: Date.now(),
        source: 'fwp-generation-validator',
        reportedBy: uid,
      },
    });
    updated += 1;
  }

  console.log(`[exercise-doc-validator] "${exerciseName}" ${observedRegion}→${derived} updated=${updated}`);
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ updated, correctedTo: derived }) };
};

export { handler };
