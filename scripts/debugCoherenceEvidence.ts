// =============================================================================
// debugCoherenceEvidence — read-only, day-by-day trace of why one athlete's
// Coherence score is (or isn't) established.
//
// Reuses the production scoring code (src/utils/pulsecheckScoringV2.ts) and
// the production day-building logic (netlify/functions/get-pulsecheck-scorecard.ts
// __internal) so this can never drift from what the app actually computes.
//
// Usage:
//   npx tsx scripts/debugCoherenceEvidence.ts <athleteUidOrEmail> [--dev]
//
// Requires serviceAccountKey.json at the repo root (gitignored) — the same
// file scripts/verifyPartnerOnboardRuntime.ts uses. Pass --dev to read the
// dev project instead of prod. NEVER writes anything.
// =============================================================================

import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import serviceAccount from '../serviceAccountKey.json';
import {
  calculatePulseCheckScorecardV2,
  PULSECHECK_SCORING_VERSION,
} from '../src/utils/pulsecheckScoringV2';
import { __internal } from '../netlify/functions/get-pulsecheck-scorecard';
import type { PulseCheckCommitmentSignal } from '../src/utils/pulsecheckScoringV2';

// Mirrors the unexported commitmentOutcome() in pulsecheckScoringV2.ts —
// duplicated here only for diagnostic display, not used in the score itself.
const commitmentOutcome = (
  commitment: PulseCheckCommitmentSignal,
  dateKey: string,
  latestDateKey: string,
): number | null => {
  switch (commitment.state) {
    case 'completed':
      return 1;
    case 'planned_rest':
      return commitment.plannedRestWithinPlan !== false && commitment.weeklyFollowThroughMet !== false ? 1 : 0;
    case 'missed':
    case 'rest_over_plan':
      return 0;
    case 'accepted':
    case 'replacement_accepted':
      return dateKey < latestDateKey ? 0 : null;
    case 'coach_excused':
    case 'technical_failure':
    case 'no_assignment':
      return null;
  }
};

const SCORECARD_COLLECTION = 'pulsecheck-scorecards';
const CHECKIN_COLLECTION = 'pulsecheck-morning-checkins';
const ASSIGNMENT_COLLECTION = 'pulsecheck-daily-assignments';
const HEALTH_COLLECTION = 'health-context-snapshots';
const WELLBEING_COLLECTION = 'pulsecheck-wellbeing-assessments';
const SCORE_INPUT_DAYS = 60;

type FirestoreRecord = { id: string; data: Record<string, any> };

const getDocumentsById = async (
  db: Firestore,
  collectionName: string,
  ids: string[],
): Promise<FirestoreRecord[]> => {
  const records: FirestoreRecord[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const references = ids.slice(index, index + 100).map((id) => db.collection(collectionName).doc(id));
    const snapshots = await db.getAll(...references);
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) records.push({ id: snapshot.id, data: snapshot.data() || {} });
    });
  }
  return records;
};

async function main() {
  const args = process.argv.slice(2);
  const useDev = args.includes('--dev');
  const identifier = args.find((arg) => !arg.startsWith('--'));
  if (!identifier) {
    console.error('Usage: npx tsx scripts/debugCoherenceEvidence.ts <athleteUidOrEmail> [--dev]');
    process.exit(1);
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount as any) });
  }
  const db = getFirestore();
  const auth = getAuth();

  const athleteId = identifier.includes('@')
    ? (await auth.getUserByEmail(identifier)).uid
    : identifier;

  const timezone = 'America/New_York';
  const throughDateKey = __internal.dateKeyInTimeZone(new Date(), timezone);
  const dateKeys = Array.from({ length: SCORE_INPUT_DAYS }, (_, index) =>
    __internal.shiftDateKey(throughDateKey, -(SCORE_INPUT_DAYS - 1 - index)));
  const checkInIds = dateKeys.map((dateKey) => `${athleteId}_${dateKey}`);
  const healthIds = dateKeys.map((dateKey) => `${athleteId}_daily_${dateKey}`);
  const documentId = `${athleteId}_v${PULSECHECK_SCORING_VERSION.split('.')[0]}`;

  const [checkIns, healthSnapshots, assignmentSnapshot, wellbeingSnapshot, userDoc, existingScorecardDoc] =
    await Promise.all([
      getDocumentsById(db, CHECKIN_COLLECTION, checkInIds),
      getDocumentsById(db, HEALTH_COLLECTION, healthIds),
      db.collection(ASSIGNMENT_COLLECTION).where('athleteId', '==', athleteId).get(),
      db.collection(WELLBEING_COLLECTION).where('athleteUserId', '==', athleteId).get().catch(() => null),
      db.collection('users').doc(athleteId).get(),
      db.collection(SCORECARD_COLLECTION).doc(documentId).get(),
    ]);

  const assignments = assignmentSnapshot.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
  const wellbeingRecords = wellbeingSnapshot
    ? wellbeingSnapshot.docs.map((d) => ({ id: d.id, data: d.data() || {} }))
    : [];
  const days = __internal.buildScoringDays({ dateKeys, checkIns, assignments, healthSnapshots });
  const whoFive = __internal.whoFiveFromRecords(wellbeingRecords, throughDateKey);

  const userData = userDoc.data() || {};
  let accountCreatedAtMillis: number | null =
    userData.createdAt?.toMillis?.() ?? (userData.createdAt ? Date.parse(userData.createdAt) : null);
  if (accountCreatedAtMillis === null) {
    try {
      const authUser = await auth.getUser(athleteId);
      accountCreatedAtMillis = Date.parse(authUser.metadata.creationTime);
    } catch {
      accountCreatedAtMillis = null;
    }
  }
  const accountCreatedDateKey = accountCreatedAtMillis !== null && Number.isFinite(accountCreatedAtMillis)
    ? __internal.dateKeyInTimeZone(new Date(accountCreatedAtMillis), timezone)
    : null;
  const accountAgeDays = accountCreatedDateKey
    ? __internal.dayDifferenceFromKeys(throughDateKey, accountCreatedDateKey)
    : null;

  const existingScorecard = existingScorecardDoc.data() || {};
  const establishedCoherenceScore = typeof existingScorecard.coherence?.score === 'number'
    ? existingScorecard.coherence.score
    : null;

  const scorecard = calculatePulseCheckScorecardV2({
    days,
    whoFive,
    accountAgeDays,
    establishedCoherenceScore,
  });

  const currentWindowDays = days.slice(-14);
  const latestDateKey = currentWindowDays[currentWindowDays.length - 1]?.dateKey ?? '';

  console.log(`\nAthlete: ${identifier} (uid=${athleteId}), project=${useDev ? 'dev' : 'prod'}`);
  console.log(`Account age: ${accountAgeDays ?? 'unknown'} days (created ${accountCreatedDateKey ?? 'unknown'})`);
  console.log(`Persisted establishedCoherenceScore going in: ${establishedCoherenceScore ?? 'none'}`);
  console.log(`\nCurrent 14-day window (${currentWindowDays[0]?.dateKey} .. ${latestDateKey}):\n`);
  console.log(
    ['date', 'checkIn?', 'level', 'commitment?', 'state', 'outcome', 'countsForCongruence'].join('\t'),
  );
  for (const day of currentWindowDays) {
    const hasCheckIn = day.wellbeingLevel !== null && day.wellbeingLevel !== undefined;
    const commitment = day.commitment;
    const outcome = commitment ? commitmentOutcome(commitment, day.dateKey, latestDateKey) : null;
    const countsForCongruence = hasCheckIn && commitment && outcome !== null;
    console.log(
      [
        day.dateKey,
        hasCheckIn ? 'yes' : 'no',
        day.wellbeingLevel ?? '-',
        commitment ? 'yes' : 'no',
        commitment?.state ?? '-',
        outcome === null ? 'pending/excluded' : outcome === 1 ? 'followed through' : 'not followed through',
        countsForCongruence ? 'YES' : 'no',
      ].join('\t'),
    );
  }

  console.log('\nFinal scorecard:');
  console.log(`  Adherence:  score=${scorecard.adherence.score} status=${scorecard.adherence.status} coverage=${scorecard.adherence.evidenceCoveragePercent}% observedDays=${scorecard.adherence.observedDays}`);
  console.log(`  Coherence:  score=${scorecard.coherence.score} status=${scorecard.coherence.status} coverage=${scorecard.coherence.evidenceCoveragePercent}% observedDays=${scorecard.coherence.observedDays}`);
  scorecard.coherence.components.forEach((c) => {
    console.log(`    - ${c.label}: score=${c.score} detail="${c.detail}"`);
  });
  const stateCounts = new Map<string, number>();
  for (const record of assignments) {
    const state = __internal.commitmentStateFrom(record.data);
    stateCounts.set(state, (stateCounts.get(state) || 0) + 1);
  }
  console.log(`\n  Commitment state distribution across ALL ${assignments.length} assignment docs (any date):`);
  for (const [state, count] of [...stateCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${state}: ${count}`);
  }
  const sampleMissed = assignments.find((r) => __internal.commitmentStateFrom(r.data) === 'missed');
  if (sampleMissed) {
    console.log(`\n  Sample "missed" doc (${sampleMissed.id}) raw fields:`);
    console.log(`    status=${JSON.stringify(sampleMissed.data.status)} completedAt=${JSON.stringify(sampleMissed.data.completedAt)} commitmentOutcomeState=${JSON.stringify(sampleMissed.data.commitmentOutcomeState)}`);
  }
  console.log(`\n  Total assignment docs found for this athlete (any date): ${assignments.length}`);
  console.log(`  Total check-in docs found in last ${SCORE_INPUT_DAYS} days: ${checkIns.length}`);
  console.log(`  Days in current window with a commitment record at all: ${currentWindowDays.filter((d) => d.commitment).length} / 14`);
  console.log(`  Days in current window with a check-in at all: ${currentWindowDays.filter((d) => d.wellbeingLevel !== null && d.wellbeingLevel !== undefined).length} / 14`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
