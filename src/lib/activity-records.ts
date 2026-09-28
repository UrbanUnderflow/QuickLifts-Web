import type { firestore } from 'firebase-admin';

// Workout and food records created from Workout and Food journal entries, the quick log, or connected sessions.
// They live apart from the journal so an athlete can correct or remove them without touching their writing.
// See PulseCheck/docs/specs/pulsecheck-workout-food-logging-tdd.pdf.
export const ACTIVITY_COLLECTION = 'pulsecheck-activity-records';
export const RECORD_KINDS = ['workout', 'meal'] as const;
export type RecordKind = typeof RECORD_KINDS[number];
const SUBCOLLECTION: Record<RecordKind, string> = { workout: 'workouts', meal: 'meals' };

export const TRAINING_BUCKETS = ['steady_cardio', 'long_endurance', 'burst_sprints', 'explosive_bursts', 'heavy_resistance', 'mixed_conditioning', 'game_or_practice', 'active_recovery'] as const;
export const MEAL_TIMINGS = ['before_training', 'after_training'] as const;
export const MEAL_CONTEXTS = ['rushed', 'traveling', 'on_the_go', 'with_team', 'late'] as const;

export class ActivityError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validRecordId = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
const text = (value: unknown, max: number, field: string, required = false) => {
  if (value == null || value === '') { if (required) throw new ActivityError(400, `Add ${field}.`); return null; }
  if (typeof value !== 'string' || value.length > max) throw new ActivityError(400, `${field} is too long.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new ActivityError(400, `Add ${field}.`);
  return trimmed || null;
};
const int = (value: unknown, min: number, max: number, field: string) => {
  if (value == null) return null;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new ActivityError(400, `${field} must be a whole number from ${min} to ${max}.`);
  return value as number;
};
const num = (value: unknown, min: number, max: number, field: string) => {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new ActivityError(400, `${field} is out of range.`);
  return Math.round(value * 10) / 10;
};
const oneOf = <T extends readonly string[]>(value: unknown, options: T, field: string): T[number] | null => {
  if (value == null) return null;
  if (typeof value !== 'string' || !(options as readonly string[]).includes(value)) throw new ActivityError(400, `Choose a valid ${field}.`);
  return value as T[number];
};
const timestamp = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1_500_000_000_000 || value > Date.now() + 86_400_000) throw new ActivityError(400, 'Choose a valid time.');
  return Math.round(value);
};

export function parseWorkout(body: any, uid: string) {
  if (!validRecordId(body?.recordId)) throw new ActivityError(400, 'Provide a valid record ID.');
  const source = oneOf(body.source, ['journal', 'quick', 'connected'] as const, 'source');
  if (!source) throw new ActivityError(400, 'Choose a valid source.');
  const entryId = body.entryId == null ? null : validRecordId(body.entryId) ? body.entryId.toLowerCase() : (() => { throw new ActivityError(400, 'Invalid entry.'); })();
  const durationMinutes = int(body.durationMinutes, 1, 600, 'Duration');
  // Principle 1: a rating exists only when the athlete chose one; nothing here derives it from their words.
  const effortRating = int(body.effortRating, 1, 10, 'Effort');
  const details = Array.isArray(body.details) ? body.details.slice(0, 30).map((detail: any) => ({
    exercise: text(detail?.exercise, 100, 'Exercise', true),
    sets: int(detail?.sets, 1, 50, 'Sets'),
    reps: int(detail?.reps, 1, 500, 'Reps'),
    weight: num(detail?.weight, 0, 2000, 'Weight'),
    unit: oneOf(detail?.unit, ['lb', 'kg'] as const, 'unit'),
  })) : [];
  return {
    id: body.recordId.toLowerCase(), kind: 'workout' as const, ownerId: uid, source, entryId,
    connectedSessionId: body.connectedSessionId == null ? null : /^whoop:[A-Za-z0-9_-]{1,120}$/.test(String(body.connectedSessionId)) ? String(body.connectedSessionId) : (() => { throw new ActivityError(400, 'Invalid session.'); })(),
    sourceLane: body.connectedSessionId ? 'whoop' : null,
    activity: text(body.activity, 200, 'what you did', true),
    bucket: oneOf(body.bucket, TRAINING_BUCKETS, 'training type'),
    startedAt: timestamp(body.startedAt),
    timeKnown: body.timeKnown === true,
    durationMinutes,
    effortWords: text(body.effortWords, 200, 'Effort words'),
    effortRating,
    // Session load only exists when the athlete gave both numbers.
    sessionLoad: effortRating != null && durationMinutes != null ? effortRating * durationMinutes : null,
    details,
  };
}

export function parseMeal(body: any, uid: string) {
  if (!validRecordId(body?.recordId)) throw new ActivityError(400, 'Provide a valid record ID.');
  const source = oneOf(body.source, ['journal', 'chat', 'quick'] as const, 'source');
  if (!source) throw new ActivityError(400, 'Choose a valid source.');
  const entryId = body.entryId == null ? null : validRecordId(body.entryId) ? body.entryId.toLowerCase() : (() => { throw new ActivityError(400, 'Invalid entry.'); })();
  const photoStoragePath = body.photoStoragePath == null ? null : String(body.photoStoragePath);
  // Journal photos, and photos the Nora chat card already stored for this athlete.
  if (photoStoragePath && !photoStoragePath.startsWith(`pulsecheck-journal-photos/${uid}/`) && !photoStoragePath.startsWith(`users/${uid}/mealPhotos/`)) throw new ActivityError(403, 'That photo belongs to another account.');
  const description = text(body.description, 500, 'what you ate');
  if (!description && !photoStoragePath) throw new ActivityError(400, 'Add what you ate or a photo.');
  const context = Array.isArray(body.context) ? [...new Set(body.context.map((item: unknown) => oneOf(item, MEAL_CONTEXTS, 'context')))].slice(0, 5) : [];
  const estimate = body.detail?.estimate;
  // Principle 5: nutrition numbers only exist inside detailed tracking the athlete opened.
  const detail = body.detail ? {
    portions: text(body.detail.portions, 300, 'Portions'),
    estimate: estimate ? {
      calories: num(estimate.calories, 0, 10000, 'Calories'),
      protein: num(estimate.protein, 0, 1000, 'Protein'),
      carbs: num(estimate.carbs, 0, 2000, 'Carbs'),
      fat: num(estimate.fat, 0, 1000, 'Fat'),
    } : null,
  } : null;
  return {
    id: body.recordId.toLowerCase(), kind: 'meal' as const, ownerId: uid, source, entryId, description, photoStoragePath,
    // The Nora chat card's own meal id, so its older mealLogs copy is not shown twice.
    chatMealId: body.chatMealId == null ? null : /^nora-[A-Za-z0-9_-]{1,160}$/.test(String(body.chatMealId)) ? String(body.chatMealId) : (() => { throw new ActivityError(400, 'Invalid chat meal.'); })(),
    eatenAt: timestamp(body.eatenAt),
    timeKnown: body.timeKnown === true,
    timing: oneOf(body.timing, MEAL_TIMINGS, 'timing'),
    context,
    detail,
  };
}

export const recordsFor = (db: firestore.Firestore, uid: string, kind: RecordKind) =>
  db.collection(ACTIVITY_COLLECTION).doc(uid).collection(SUBCOLLECTION[kind]);

export async function saveRecord(db: firestore.Firestore, uid: string, record: ReturnType<typeof parseWorkout> | ReturnType<typeof parseMeal>, now: number) {
  const ref = recordsFor(db, uid, record.kind).doc(record.id);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    const saved = { ...record, createdAt: existing.exists ? existing.data()!.createdAt : now, updatedAt: now };
    tx.set(ref, saved);
    return { record: saved, created: !existing.exists };
  });
}

// ---------- Connected sessions ----------

export type ConnectedSession = {
  id: string; sourceLane: 'whoop'; sport: string | null; startedAt: number; durationMinutes: number | null; linkedRecordId: string | null;
};

/**
 * WHOOP workouts already synced into health-context-source-records, read by their deterministic day ids
 * ({uid}_whoop_training_{dateKey}) so no collection query or new index is needed.
 */
export async function connectedSessions(db: firestore.Firestore, uid: string, from: number, to: number): Promise<Omit<ConnectedSession, 'linkedRecordId'>[]> {
  const dayMs = 86_400_000;
  const keys: string[] = [];
  for (let t = from - dayMs; t <= to + dayMs; t += dayMs) keys.push(new Date(t).toISOString().slice(0, 10));
  const refs = [...new Set(keys)].map((key) => db.collection('health-context-source-records').doc(`${uid}_whoop_training_${key}`));
  const docs = refs.length ? await db.getAll(...refs) : [];
  const sessions = new Map<string, Omit<ConnectedSession, 'linkedRecordId'>>();
  for (const doc of docs) {
    const data = doc.exists ? doc.data() : null;
    if (!data || data.athleteUserId !== uid || data.status !== 'active') continue;
    for (const workout of Array.isArray(data.payload?.workouts) ? data.payload.workouts : []) {
      const startedAt = Number(workout?.startAt) * 1000;
      if (!workout?.id || !Number.isFinite(startedAt) || startedAt < from || startedAt > to) continue;
      sessions.set(`whoop:${workout.id}`, {
        id: `whoop:${workout.id}`, sourceLane: 'whoop',
        sport: typeof workout.sportName === 'string' ? workout.sportName : null,
        startedAt,
        durationMinutes: Number.isInteger(workout.durationMinutes) ? workout.durationMinutes : null,
      });
    }
  }
  return [...sessions.values()].sort((a, b) => b.startedAt - a.startedAt);
}

// ---------- Legacy chat meals ----------

/** Meals saved from the Nora chat card before it wrote shared records (decision F6). Descriptions only, never numbers. */
export async function legacyChatMeals(db: firestore.Firestore, uid: string, from: number, to: number) {
  const snapshot = await db.collection('users').doc(uid).collection('mealLogs')
    .where('createdAt', '>=', from / 1000).where('createdAt', '<=', to / 1000).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id, kind: 'meal', source: 'chat', entryId: null, description: typeof data.name === 'string' ? data.name : null,
      photoStoragePath: null, eatenAt: Math.round(Number(data.createdAt) * 1000), timeKnown: true, timing: null, context: [], detail: null,
    };
  });
}

// ---------- Sharing with coaches ----------

export const settingsRef = (db: firestore.Firestore, uid: string) => db.collection(ACTIVITY_COLLECTION).doc(uid);
const STAFF_ROLES = ['team-admin', 'coach', 'performance-staff', 'athletic-trainer'];

/** True when the caller is active staff on a team the athlete belongs to. */
export async function isCoachOfAthlete(db: firestore.Firestore, callerUid: string, athleteId: string) {
  const athleteMemberships = await db.collection('pulsecheck-team-memberships').where('userId', '==', athleteId).get();
  for (const membership of athleteMemberships.docs) {
    const teamId = String(membership.data()?.teamId || '');
    if (!teamId) continue;
    const staff = await db.collection('pulsecheck-team-memberships').doc(`${teamId}_${callerUid}`).get();
    const role = String(staff.data()?.role || '').toLowerCase();
    const status = String(staff.data()?.status || 'active').toLowerCase();
    if (staff.exists && STAFF_ROLES.includes(role) && !['removed', 'inactive', 'archived'].includes(status)) return true;
  }
  return false;
}

/**
 * What a coach sees when the athlete turned sharing on (decision F1): sessions, minutes, and load where rated.
 * Never effort words, exercise details, food, or anything from the journal.
 */
export function coachSummary(workouts: Array<Record<string, any>>, sessions: Array<Omit<ConnectedSession, 'linkedRecordId'>>) {
  const linked = new Set(workouts.map((w) => w.connectedSessionId).filter(Boolean));
  const rows = [
    ...workouts.map((w) => ({ startedAt: w.startedAt, activity: w.activity, durationMinutes: w.durationMinutes ?? null, effortRating: w.effortRating ?? null, sessionLoad: w.sessionLoad ?? null, fromDevice: Boolean(w.connectedSessionId) })),
    ...sessions.filter((s) => !linked.has(s.id)).map((s) => ({ startedAt: s.startedAt, activity: s.sport || 'Workout', durationMinutes: s.durationMinutes, effortRating: null, sessionLoad: null, fromDevice: true })),
  ].sort((a, b) => b.startedAt - a.startedAt);
  const withMinutes = rows.filter((r) => r.durationMinutes != null);
  const rated = rows.filter((r) => r.sessionLoad != null);
  return {
    workouts: rows,
    totals: {
      workoutCount: rows.length,
      minutes: withMinutes.reduce((sum, r) => sum + (r.durationMinutes as number), 0),
      workoutsWithMinutes: withMinutes.length,
      load: rated.reduce((sum, r) => sum + (r.sessionLoad as number), 0),
      ratedWorkouts: rated.length,
      unratedWorkouts: rows.length - rated.length,
    },
  };
}
