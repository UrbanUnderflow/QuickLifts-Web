import React, { useCallback, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../api/firebase/config';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  runAthletePhrasingGuardrails,
} from '../../api/firebase/adaptiveFramingLayer/guardrails';
import {
  TRANSLATION_TABLE_COLLECTION,
  OFF_LIMITS_CONFIG_COLLECTION,
  OFF_LIMITS_CONFIG_DOCUMENT_ID,
  TRANSLATION_LOG_COLLECTION,
  type TranslationRow,
  type OffLimitsConfig,
  type ValidationIssue,
} from '../../api/firebase/adaptiveFramingLayer/types';
import { NORA_ATHLETE_TRANSLATION } from '../../api/anthropic/featureRouting';

// =====================================================================
// Lever framework
// =====================================================================

type LogLine = { ts: number; level: 'info' | 'warn' | 'err'; text: string };

type LeverHandle = {
  log: (text: string, level?: LogLine['level']) => void;
  setProgress: (current: number, total: number) => void;
};

type LeverResult = {
  summary: string;
  changed: number;
  skipped: number;
  total: number;
};

type Lever = {
  id: string;
  title: string;
  description: string;
  destructive?: boolean;
  supportsDryRun: boolean;
  run: (args: { dryRun: boolean; handle: LeverHandle }) => Promise<LeverResult>;
};

type SmokeTargetId =
  | 'scheduled-nora-conversation'
  | 'nora-timeout-sweep'
  | 'daily-curriculum-assignment'
  | 'curriculum-reminder'
  | 'curriculum-assessment';

type SmokeTarget = {
  id: SmokeTargetId;
  label: string;
  description: string;
  endpoint: string;
};

type SmokeRunResult = {
  ok: boolean;
  targetId: SmokeTargetId;
  label: string;
  endpoint: string;
  upstreamStatus?: number;
  durationMs?: number;
  payload?: unknown;
  error?: string;
};

// =====================================================================
// Levers
// =====================================================================

// Same alphabet as the iOS client (no I, L, O, 0, 1).
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');

function makeCandidateJoinCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return out;
}

async function isJoinCodeFree(code: string, claimedThisRun: Set<string>): Promise<boolean> {
  if (claimedThisRun.has(code)) return false;
  const snap = await getDocs(query(collection(db, 'clubs'), where('joinCode', '==', code)));
  return snap.empty;
}

async function generateUniqueJoinCode(claimedThisRun: Set<string>): Promise<string> {
  let length = 6;
  let attempts = 0;
  // Cap iterations to avoid runaways; pad length on repeated collisions.
  while (attempts < 50) {
    const candidate = makeCandidateJoinCode(length);
    // eslint-disable-next-line no-await-in-loop
    if (await isJoinCodeFree(candidate, claimedThisRun)) {
      claimedThisRun.add(candidate);
      return candidate;
    }
    attempts += 1;
    if (attempts > 0 && attempts % 4 === 0) length += 2;
  }
  throw new Error('Could not allocate a unique join code after 50 attempts');
}

const backfillClubJoinCodes: Lever = {
  id: 'backfill-club-join-codes',
  title: 'Backfill Club Join Codes',
  description:
    'Scans every club document, generates a unique 6-char joinCode (alphabet excludes 0, 1, I, L, O), and writes it back. Skips clubs that already have one. Idempotent — safe to re-run.',
  supportsDryRun: true,
  async run({ dryRun, handle }) {
    handle.log(`Starting backfill${dryRun ? ' (dry run)' : ''}…`);

    const clubsSnap = await getDocs(collection(db, 'clubs'));
    const total = clubsSnap.size;
    handle.log(`Found ${total} club document(s).`);
    handle.setProgress(0, total);

    // Track existing codes so we never propose a duplicate, plus codes we
    // claim during this run so a single batch can't double-assign.
    const claimed = new Set<string>();
    clubsSnap.forEach((d) => {
      const existing = ((d.data().joinCode as string | undefined) || '').trim().toUpperCase();
      if (existing) claimed.add(existing);
    });

    let changed = 0;
    let skipped = 0;
    let processed = 0;

    for (const d of clubsSnap.docs) {
      const data = d.data();
      const existing = ((data.joinCode as string | undefined) || '').trim().toUpperCase();
      if (existing) {
        skipped += 1;
        processed += 1;
        handle.setProgress(processed, total);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const code = await generateUniqueJoinCode(claimed);
      handle.log(`${d.id} (${data.name || '<unnamed>'}) → ${code}`);

      if (!dryRun) {
        // eslint-disable-next-line no-await-in-loop
        await updateDoc(doc(db, 'clubs', d.id), {
          joinCode: code,
          updatedAt: serverTimestamp(),
        });
      }

      changed += 1;
      processed += 1;
      handle.setProgress(processed, total);
    }

    return {
      summary: dryRun
        ? `Would assign ${changed} code(s); skipped ${skipped} already-coded clubs.`
        : `Assigned ${changed} code(s); skipped ${skipped} already-coded clubs.`,
      changed,
      skipped,
      total,
    };
  },
};

// ---------------------------------------------------------------------
// Lever 2: Reclassify Legacy Challenge Types
// ---------------------------------------------------------------------

type ChallengeTypeValue =
  | 'lift'
  | 'run'
  | 'bike'
  | 'burn'
  | 'stretch'
  | 'hybrid'
  | 'nutrition';

const VALID_CHALLENGE_TYPES: ChallengeTypeValue[] = [
  'lift',
  'run',
  'bike',
  'burn',
  'stretch',
  'hybrid',
  'nutrition',
];

// Treat anything outside this set as "needs reclassification". The legacy
// fallback in iOS (`init(fromLegacy:)`) silently coerces these to .lift on
// read but never writes the field back, so the source-of-truth doc is wrong.
const LEGACY_TYPE_VALUES = new Set(['workout', 'steps', 'calories', '']);

const CLASSIFIER_MODEL = 'gpt-4o-mini';
const CLASSIFIER_FEATURE_ID = 'classifyChallengeType';

const CLASSIFIER_SYSTEM_PROMPT = `You classify a fitness challenge into one of seven canonical types.

The seven valid values are exactly:
  - "lift"      → Weight training, strength workouts (squats, bench, deadlifts, hypertrophy, powerlifting, push/pull/legs, etc.)
  - "run"       → Running, cardio runs, 5k/10k/half/marathon training, track work
  - "bike"      → Cycling, indoor cycling, peloton, road cycling, gravel
  - "burn"      → HIIT, fat burn, conditioning, metabolic, circuits with high heart-rate intent
  - "stretch"   → Flexibility, mobility, yoga, recovery, foam rolling, dynamic warmups, prehab/rehab
  - "hybrid"    → Genuinely mixed strength + cardio (e.g. CrossFit-style WODs combining lifts and cardio)
  - "nutrition" → Nutrition-focused: hit calorie/macro target, no workouts

Rules:
1. Pick the SINGLE best match based on the workout names + challenge title/subtitle.
2. If the workouts are obviously a mobility/flexibility/yoga focus, use "stretch" — that bucket explicitly covers mobility.
3. Use "hybrid" only when it's clearly a cardio-AND-strength program. A lift program with one cardio finisher is still "lift".
4. Default to "lift" only if the evidence genuinely points there, NOT as a fallback for ambiguous cases. Use "low" confidence when unsure.
5. Reply with strict JSON, no surrounding text. Schema:
   {"inferredType":"<one of: lift|run|bike|burn|stretch|hybrid|nutrition>","confidence":"<high|medium|low>","reasoning":"<one short sentence>"}
`;

interface ClassificationResult {
  inferredType: ChallengeTypeValue;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  model: string;
}

const buildClassifierUserPrompt = (args: {
  challengeTitle: string;
  challengeSubtitle?: string;
  workoutTitles: string[];
}): string => {
  const lines: string[] = [];
  lines.push(`Challenge title: ${args.challengeTitle?.trim() || '(blank)'}`);
  if (args.challengeSubtitle?.trim()) {
    lines.push(`Subtitle: ${args.challengeSubtitle.trim()}`);
  }
  const titles = (args.workoutTitles || [])
    .map((t) => t?.trim())
    .filter((t): t is string => !!t);
  if (titles.length > 0) {
    lines.push('');
    lines.push(`Workout names (${titles.length}):`);
    titles.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
  } else {
    lines.push('');
    lines.push('No workout names available — classify from title/subtitle only and use "low" confidence.');
  }
  lines.push('');
  lines.push('Respond with JSON only.');
  return lines.join('\n');
};

async function classifyChallengeViaApi(args: {
  challengeId: string;
  challengeTitle: string;
  challengeSubtitle?: string;
  workoutTitles: string[];
}): Promise<ClassificationResult> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Not signed in');

  // Route through the existing openai-bridge so we reuse the OPENAI_API_KEY
  // already configured in Netlify and inherit its admin token verification +
  // per-feature rate limits.
  const res = await fetch('/api/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${idToken}`,
      'openai-organization': CLASSIFIER_FEATURE_ID,
    },
    body: JSON.stringify({
      model: CLASSIFIER_MODEL,
      max_tokens: 256,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
        { role: 'user', content: buildClassifierUserPrompt(args) },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Classifier ${res.status}: ${text.slice(0, 240)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() || '';
  if (!raw) throw new Error('Empty model response');

  let parsed: any;
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse model JSON: ${raw.slice(0, 200)}`);
  }

  const inferredType = String(parsed?.inferredType || '').toLowerCase() as ChallengeTypeValue;
  if (!VALID_CHALLENGE_TYPES.includes(inferredType)) {
    throw new Error(`Model returned invalid type: ${parsed?.inferredType}`);
  }
  const confidence = (['high', 'medium', 'low'] as const).includes(parsed?.confidence)
    ? parsed.confidence
    : 'medium';
  const reasoning = typeof parsed?.reasoning === 'string' ? parsed.reasoning : '';

  return { inferredType, confidence, reasoning, model: CLASSIFIER_MODEL };
}

const reclassifyLegacyChallengeTypes: Lever = {
  id: 'reclassify-legacy-challenge-types',
  title: 'Reclassify Legacy Challenge Types',
  description:
    'Finds challenges whose challenge.challengeType is missing or set to a legacy value (workout/steps/calories), then asks gpt-4o-mini (via the existing openai-bridge) to pick the right canonical enum based on the challenge title and the denormalized workout names. In live mode, writes the inferred value plus an audit trail (challengeTypeInferredAt + challengeTypeInferredFrom + challengeTypeInferredConfidence).',
  supportsDryRun: true,
  async run({ dryRun, handle }) {
    handle.log(`Scanning sweatlist-collection${dryRun ? ' (dry run)' : ''}…`);

    const allSnap = await getDocs(collection(db, 'sweatlist-collection'));
    handle.log(`Total docs: ${allSnap.size}`);

    type Candidate = {
      docId: string;
      challengeTitle: string;
      challengeSubtitle: string;
      workoutTitles: string[];
      currentType: string | undefined;
      reason: 'missing' | 'legacy';
    };

    const candidates: Candidate[] = [];
    allSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const challenge = (data.challenge as Record<string, unknown> | undefined) || undefined;
      if (!challenge) return; // Some sweatlist-collection docs don't carry a challenge at all.

      const rawType = challenge.challengeType;
      const currentType =
        typeof rawType === 'string' ? rawType.trim().toLowerCase() : undefined;

      const isMissing = !currentType;
      const isLegacy = !!currentType && LEGACY_TYPE_VALUES.has(currentType);
      const isUnknownNonLegacy =
        !!currentType &&
        !VALID_CHALLENGE_TYPES.includes(currentType as ChallengeTypeValue) &&
        !isLegacy;
      if (!isMissing && !isLegacy && !isUnknownNonLegacy) return;

      const challengeTitle =
        typeof challenge.title === 'string'
          ? challenge.title
          : typeof data.title === 'string'
          ? (data.title as string)
          : '';
      const challengeSubtitle =
        typeof challenge.subtitle === 'string' ? (challenge.subtitle as string) : '';

      const sweatlistIds = Array.isArray(data.sweatlistIds)
        ? (data.sweatlistIds as Array<Record<string, unknown>>)
        : [];
      const workoutTitles = sweatlistIds
        .map((s) => (typeof s.sweatlistName === 'string' ? s.sweatlistName : ''))
        .filter((t) => !!t);

      candidates.push({
        docId: d.id,
        challengeTitle,
        challengeSubtitle,
        workoutTitles,
        currentType,
        reason: isMissing ? 'missing' : 'legacy',
      });
    });

    handle.log(`Candidates needing reclassification: ${candidates.length}`);
    handle.setProgress(0, candidates.length);

    let changed = 0;
    let skipped = 0;
    let processed = 0;

    // Helper: produce a one-line "fingerprint" for log readability — leads
    // with the human-readable challenge title, then a small sample of
    // workout names so the admin can sanity-check the AI's call against
    // real data without leaving the lever.
    const fingerprint = (cand: Candidate): string => {
      const titleSnippet = cand.challengeTitle ? `"${cand.challengeTitle}"` : '<no title>';
      const sample = cand.workoutTitles
        .slice(0, 2)
        .map((t) => `"${t.length > 40 ? t.slice(0, 37) + '…' : t}"`)
        .join(', ');
      const more = cand.workoutTitles.length > 2 ? `, +${cand.workoutTitles.length - 2} more` : '';
      const sampleText = cand.workoutTitles.length > 0 ? `: ${sample}${more}` : '';
      return `${titleSnippet} (${cand.workoutTitles.length} wks${sampleText}) [${cand.docId}]`;
    };

    for (const cand of candidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await classifyChallengeViaApi({
          challengeId: cand.docId,
          challengeTitle: cand.challengeTitle,
          challengeSubtitle: cand.challengeSubtitle,
          workoutTitles: cand.workoutTitles,
        });

        const fromLabel = cand.currentType ? `"${cand.currentType}"` : 'missing';
        handle.log(
          `${fingerprint(cand)} ${fromLabel} → ${result.inferredType} [${result.confidence}] — ${result.reasoning}`
        );

        if (!dryRun) {
          // eslint-disable-next-line no-await-in-loop
          await updateDoc(doc(db, 'sweatlist-collection', cand.docId), {
            'challenge.challengeType': result.inferredType,
            'challenge.challengeTypeInferredAt': serverTimestamp(),
            'challenge.challengeTypeInferredFrom': `${result.model}:v1`,
            'challenge.challengeTypeInferredConfidence': result.confidence,
          });
        }
        changed += 1;
      } catch (e: any) {
        handle.log(`${fingerprint(cand)} FAILED: ${e?.message || String(e)}`, 'err');
        skipped += 1;
      }
      processed += 1;
      handle.setProgress(processed, candidates.length);
    }

    return {
      summary: dryRun
        ? `Would reclassify ${changed} challenge(s); ${skipped} failed during inference.`
        : `Reclassified ${changed} challenge(s); ${skipped} failed during inference.`,
      changed,
      skipped,
      total: candidates.length,
    };
  },
};

// ---------------------------------------------------------------------
// Lever 3: Repair pulsecheck-protocols legacyExerciseId mismatches
// ---------------------------------------------------------------------
//
// Symptom: home shows "4-7-8 Relaxation Breathing" but tapping it runs
// Box Breathing (or some other exercise). Cause: the published
// `pulsecheck-protocols` doc whose `label` is "4-7-8 Relaxation
// Breathing" has its `legacyExerciseId` field set to a different
// exercise's id (e.g. `breathing-box`) — so the iOS resolver loads the
// wrong MentalExercise.
//
// Fix: compare every protocol doc's label against the canonical
// `pulsecheck-mental-exercises` library; if a name match exists and
// the protocol's legacyExerciseId disagrees, write the corrected id.

const PULSECHECK_PROTOCOLS_COLLECTION = 'pulsecheck-protocols';
// The legacy mental-exercise library lives at `mental-exercises` — same
// collection MentalTrainingService.swift hits via `exerciseCollection`.
// Earlier guess `pulsecheck-mental-exercises` was wrong (returns 0 docs).
const PULSECHECK_EXERCISES_COLLECTION = 'mental-exercises';

const normalizeName = (text: unknown): string =>
  String(text || '').trim().toLowerCase();

const repairPulseCheckProtocolLegacyExerciseIds: Lever = {
  id: 'repair-pulsecheck-protocol-legacy-exercise-ids',
  title: 'Repair PulseCheck Protocol legacyExerciseId',
  description:
    'Audits every pulsecheck-protocols doc against the mental-exercises library. When a protocol\'s label matches an exercise by name but its legacyExerciseId points to a different exercise, write the corrected id. Idempotent — safe to re-run. Use this when the home shows the right protocol label but the wrong exercise actually runs.',
  supportsDryRun: true,
  async run({ dryRun, handle }) {
    handle.log(`Loading exercise library (${PULSECHECK_EXERCISES_COLLECTION})…`);
    const exercisesSnap = await getDocs(collection(db, PULSECHECK_EXERCISES_COLLECTION));
    const exerciseIdByName = new Map<string, string>();
    const exerciseDuplicateNames = new Map<string, string[]>();
    exercisesSnap.forEach((d) => {
      const data = d.data() as { name?: string };
      const key = normalizeName(data?.name);
      if (!key) return;
      const existing = exerciseDuplicateNames.get(key) ?? [];
      existing.push(d.id);
      exerciseDuplicateNames.set(key, existing);
      // Last write wins on the lookup map; duplicates are reported separately.
      exerciseIdByName.set(key, d.id);
    });
    handle.log(`Loaded ${exerciseIdByName.size} unique-name exercise(s) (${exercisesSnap.size} docs).`);

    // Surface any duplicate names in the library — those are the
    // smoking gun if a label resolves to the wrong exercise.
    let dupCount = 0;
    exerciseDuplicateNames.forEach((ids, name) => {
      if (ids.length > 1) {
        dupCount += 1;
        handle.log(
          `Duplicate exercise name "${name}": ${ids.join(', ')}`,
          'warn',
        );
      }
    });
    if (dupCount === 0) {
      handle.log('No duplicate exercise names found.');
    } else {
      handle.log(`${dupCount} duplicate exercise name(s) found — see warnings above.`, 'warn');
    }
    handle.log('---');
    handle.log('Full exercise library (id → name):');
    Array.from(exerciseDuplicateNames.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([name, ids]) => {
        ids.forEach((id) => handle.log(`  ${id}  →  "${name}"`));
      });
    handle.log('---');

    handle.log(`Scanning ${PULSECHECK_PROTOCOLS_COLLECTION}…`);
    const protocolsSnap = await getDocs(collection(db, PULSECHECK_PROTOCOLS_COLLECTION));
    const total = protocolsSnap.size;
    handle.log(`Found ${total} protocol doc(s).`);
    handle.log('---');
    handle.log('Full audit (every protocol → expected exercise → current exercise):');
    handle.setProgress(0, total);

    let changed = 0;
    let alreadyCorrect = 0;
    let unmatched = 0;
    let processed = 0;

    for (const docSnap of protocolsSnap.docs) {
      const data = docSnap.data() as {
        label?: string;
        legacyExerciseId?: string;
      };
      const label = (data?.label || '').trim();
      const currentLegacyId = (data?.legacyExerciseId || '').trim();
      processed += 1;
      handle.setProgress(processed, total);

      if (!label) {
        handle.log(`${docSnap.id}: no label — skipping.`, 'warn');
        unmatched += 1;
        continue;
      }

      const expectedLegacyId = exerciseIdByName.get(normalizeName(label));
      if (!expectedLegacyId) {
        handle.log(
          `${docSnap.id} label="${label}" current=${currentLegacyId || '(empty)'} → no exercise matches this label by name in mental-exercises`,
          'warn',
        );
        unmatched += 1;
        continue;
      }

      const isCorrect = normalizeName(expectedLegacyId) === normalizeName(currentLegacyId);
      if (isCorrect) {
        handle.log(
          `${docSnap.id} label="${label}" → legacyExerciseId="${currentLegacyId}" ✓`,
        );
        alreadyCorrect += 1;
        continue;
      }

      handle.log(
        `${docSnap.id} label="${label}":  ${currentLegacyId || '(empty)'}  →  ${expectedLegacyId}  (would repair)`,
        'warn',
      );

      if (!dryRun) {
        // eslint-disable-next-line no-await-in-loop
        await updateDoc(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, docSnap.id), {
          legacyExerciseId: expectedLegacyId,
          updatedAt: serverTimestamp(),
        });
      }

      changed += 1;
    }

    handle.log('---');
    handle.log(
      `Tally: ${alreadyCorrect} already correct, ${changed} ${dryRun ? 'would be repaired' : 'repaired'}, ${unmatched} unmatched (label has no exercise by name).`,
    );

    return {
      summary: dryRun
        ? `Would repair ${changed} doc(s); ${alreadyCorrect} already correct; ${unmatched} unmatched.`
        : `Repaired ${changed} doc(s); ${alreadyCorrect} already correct; ${unmatched} unmatched.`,
      changed,
      skipped: alreadyCorrect + unmatched,
      total,
    };
  },
};

// ---------------------------------------------------------------------
// Lever 4: Audit my recent PulseCheck daily assignments
// ---------------------------------------------------------------------
//
// Read-only diagnostic. Pulls the signed-in admin's most recent
// `pulsecheck-daily-assignments` docs and prints the fields the iOS
// home actually reads (sourceDate, actionType, status, legacyExerciseId,
// protocolId, protocolLabel, simSpecId, simName). When the home shows one label
// but a different exercise actually runs, this lever lets us see
// whether protocolId, legacyExerciseId, and protocolLabel disagree at the source.

const PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';

const auditMyRecentPulseCheckAssignments: Lever = {
  id: 'audit-my-recent-pulsecheck-assignments',
  title: 'Audit My Recent PulseCheck Assignments',
  description:
    'Read-only. Pulls the signed-in admin\'s most recent pulsecheck-daily-assignments docs (last 14 days) and prints sourceDate, actionType, legacyExerciseId, protocolId, protocolLabel, simSpecId, simName, status. Use to confirm whether the home label matches the actual launch id.',
  supportsDryRun: false,
  async run({ handle }) {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      handle.log('Not signed in.', 'err');
      return { summary: 'Not signed in.', changed: 0, skipped: 0, total: 0 };
    }
    handle.log(`Loading recent assignments for athleteId=${uid}…`);

    const q = query(
      collection(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION),
      where('athleteId', '==', uid),
    );
    const snap = await getDocs(q);
    const total = snap.size;
    handle.log(`Found ${total} assignment(s).`);

    type Row = {
      id: string;
      sourceDate?: string;
      actionType?: string;
      status?: string;
      legacyExerciseId?: string;
      protocolId?: string;
      protocolLabel?: string;
      simSpecId?: string;
      simName?: string;
      isPrimaryForDate?: boolean;
      revision?: number;
      assignedBy?: string;
    };

    const rows: Row[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        sourceDate: typeof data.sourceDate === 'string' ? (data.sourceDate as string) : undefined,
        actionType: typeof data.actionType === 'string' ? (data.actionType as string) : undefined,
        status: typeof data.status === 'string' ? (data.status as string) : undefined,
        legacyExerciseId: typeof data.legacyExerciseId === 'string' ? (data.legacyExerciseId as string) : undefined,
        protocolId: typeof data.protocolId === 'string' ? (data.protocolId as string) : undefined,
        protocolLabel: typeof data.protocolLabel === 'string' ? (data.protocolLabel as string) : undefined,
        simSpecId: typeof data.simSpecId === 'string' ? (data.simSpecId as string) : undefined,
        simName: typeof data.simName === 'string' ? (data.simName as string) : undefined,
        isPrimaryForDate: typeof data.isPrimaryForDate === 'boolean' ? (data.isPrimaryForDate as boolean) : undefined,
        revision: typeof data.revision === 'number' ? (data.revision as number) : undefined,
        assignedBy: typeof data.assignedBy === 'string' ? (data.assignedBy as string) : undefined,
      };
    });

    rows.sort((a, b) => (b.sourceDate || '').localeCompare(a.sourceDate || ''));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const recent = rows.filter((r) => !r.sourceDate || r.sourceDate >= cutoffISO);

    handle.log(`Showing ${recent.length} assignment(s) from the last 14 days:`);
    handle.log('---');
    for (const r of recent) {
      const isPrimary = r.isPrimaryForDate === true ? ' [PRIMARY]' : '';
      const rev = typeof r.revision === 'number' ? ` rev=${r.revision}` : '';
      const assignedBy = r.assignedBy ? ` by=${r.assignedBy}` : '';
      handle.log(
        `[${r.sourceDate ?? 'no-date'}]${isPrimary} ${r.actionType ?? '?'} status=${r.status ?? '?'}${rev}${assignedBy} id=${r.id}`,
      );
      if (r.actionType === 'protocol') {
        handle.log(
          `   legacyExerciseId="${r.legacyExerciseId ?? ''}"  protocolId="${r.protocolId ?? ''}"  protocolLabel="${r.protocolLabel ?? ''}"`,
        );
      } else if (r.actionType === 'simulation') {
        handle.log(
          `   simSpecId="${r.simSpecId ?? ''}"  simName="${r.simName ?? ''}"`,
        );
      } else {
        handle.log(`   protocolId="${r.protocolId ?? ''}"  simSpecId="${r.simSpecId ?? ''}"`);
      }
    }
    handle.log('---');

    return {
      summary: `Audited ${recent.length} recent assignment(s).`,
      changed: 0,
      skipped: 0,
      total: recent.length,
    };
  },
};

const LEVERS: Lever[] = [
  backfillClubJoinCodes,
  reclassifyLegacyChallengeTypes,
  repairPulseCheckProtocolLegacyExerciseIds,
  auditMyRecentPulseCheckAssignments,
];

// =====================================================================
// UI
// =====================================================================

const AdminLevers: React.FC = () => (
  <AdminRouteGuard>
    <Head>
      <title>Admin · Levers</title>
    </Head>
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <ShieldAlert className="text-yellow-400" />
          <h1 className="text-3xl font-bold tracking-tight">Admin Levers</h1>
        </div>
        <p className="text-zinc-400 text-sm mb-8">
          Heavy-duty operations. Each lever runs as the signed-in admin against the live
          Firestore project that this build is pointed at. Use dry-run first when available.
        </p>

        <div className="space-y-6">
          <PulseCheckSmokeLeversCard />
          {LEVERS.map((lever) => (
            <LeverCard key={lever.id} lever={lever} />
          ))}
          <NoraTranslationPreviewCard />
        </div>
      </div>
    </div>
  </AdminRouteGuard>
);

const PulseCheckSmokeLeversCard: React.FC = () => {
  const [targets, setTargets] = useState<SmokeTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [runningTarget, setRunningTarget] = useState<SmokeTargetId | null>(null);
  const [results, setResults] = useState<Record<string, SmokeRunResult>>({});
  const [error, setError] = useState<string | null>(null);

  const buildAdminHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not signed in');
    const headers: Record<string, string> = {
      authorization: `Bearer ${idToken}`,
    };
    if (auth.currentUser?.email) headers['x-admin-email'] = auth.currentUser.email;
    return headers;
  }, []);

  const refreshTargets = useCallback(async () => {
    setLoadingTargets(true);
    setError(null);
    try {
      const headers = await buildAdminHeaders();
      const res = await fetch('/api/admin/pulsecheck/smoke-levers', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Smoke target load failed (${res.status})`);
      setTargets(Array.isArray(data.targets) ? data.targets : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingTargets(false);
    }
  }, [buildAdminHeaders]);

  React.useEffect(() => {
    refreshTargets();
  }, [refreshTargets]);

  const runTarget = useCallback(
    async (targetId: SmokeTargetId) => {
      if (runningTarget) return;
      setRunningTarget(targetId);
      setError(null);
      try {
        const headers = await buildAdminHeaders();
        const res = await fetch('/api/admin/pulsecheck/smoke-levers', {
          method: 'POST',
          headers: {
            ...headers,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ targetId }),
        });
        const data = await res.json();
        setResults((prev) => ({ ...prev, [targetId]: data }));
        if (!res.ok) throw new Error(data?.error || `Smoke run failed (${res.status})`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setRunningTarget(null);
      }
    },
    [buildAdminHeaders, runningTarget],
  );

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
      <div className="flex items-start gap-3 mb-2">
        <Terminal className="text-cyan-300 mt-1" size={18} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">PulseCheck Nora / Phase I Smoke</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-cyan-200 bg-cyan-400/10 border border-cyan-300/30 px-2 py-0.5 rounded-full">
              DEV SMOKE
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
            Admin-authenticated controls for scheduled Nora conversations, timeout cleanup, daily curriculum
            assignment, reminders, and assessment checks. Function calls route through a server API; no
            firebase-admin code is imported into this page.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshTargets}
          disabled={loadingTargets}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:cursor-wait disabled:text-zinc-600"
          aria-label="Refresh smoke endpoints"
          title="Refresh smoke endpoints"
        >
          <RefreshCw size={15} className={loadingTargets ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {targets.map((target) => {
          const result = results[target.id];
          const running = runningTarget === target.id;
          return (
            <div key={target.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-100">{target.label}</div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">{target.description}</p>
                  <a
                    href={target.endpoint}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-1 text-xs text-cyan-200 hover:text-cyan-100"
                  >
                    <span className="truncate font-mono">{target.endpoint}</span>
                    <ExternalLink size={12} className="flex-shrink-0" />
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => runTarget(target.id)}
                  disabled={Boolean(runningTarget)}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    running
                      ? 'bg-zinc-800 text-zinc-400 cursor-wait'
                      : 'bg-cyan-300 text-zinc-950 hover:bg-cyan-200 disabled:bg-zinc-800 disabled:text-zinc-500'
                  }`}
                >
                  {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  {running ? 'Running...' : 'Run smoke'}
                </button>
              </div>

              {result && (
                <div
                  className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                    result.ok
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
                      : 'border-red-500/30 bg-red-500/5 text-red-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {result.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    <span className="font-semibold">
                      {result.ok ? 'Completed' : 'Failed'}
                      {typeof result.upstreamStatus === 'number' ? ` · upstream ${result.upstreamStatus}` : ''}
                      {typeof result.durationMs === 'number' ? ` · ${result.durationMs}ms` : ''}
                    </span>
                  </div>
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded bg-black/60 p-2 font-mono text-[11px] text-zinc-300">
                    {JSON.stringify(result.payload ?? { error: result.error }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href="#nora-translation-preview" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800">
          Translation Preview
        </a>
        <a href="/admin/noraGuard" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800">
          Nora Guard
        </a>
        <a href="/admin/curriculumLayer" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800">
          Curriculum Layer
        </a>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
    </div>
  );
};

const LeverCard: React.FC<{ lever: Lever }> = ({ lever }) => {
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<LeverResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle: LeverHandle = useMemo(
    () => ({
      log: (text, level = 'info') => {
        setLogs((prev) => [...prev, { ts: Date.now(), level, text }]);
      },
      setProgress: (current, total) => {
        setProgress({ current, total });
      },
    }),
    []
  );

  const onRun = useCallback(async () => {
    if (running) return;
    if (!dryRun) {
      const ok = window.confirm(
        `Run "${lever.title}" against the LIVE Firestore project?\n\n` +
          `This will write to production data. Click Cancel to abort.`
      );
      if (!ok) return;
    }
    setLogs([]);
    setProgress(null);
    setResult(null);
    setError(null);
    setRunning(true);
    try {
      const r = await lever.run({ dryRun, handle });
      setResult(r);
      handle.log(r.summary, 'info');
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      handle.log(`Failed: ${msg}`, 'err');
    } finally {
      setRunning(false);
    }
  }, [running, dryRun, lever, handle]);

  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start gap-3 mb-2">
        <Sparkles className="text-yellow-400 mt-1" size={18} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{lever.title}</h2>
            {lever.destructive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-red-400 bg-red-400/10 border border-red-400/30 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} /> DESTRUCTIVE
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{lever.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        {lever.supportsDryRun && (
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="accent-yellow-400"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={running}
            />
            Dry run
          </label>
        )}
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            running
              ? 'bg-zinc-800 text-zinc-400 cursor-wait'
              : dryRun
              ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
              : 'bg-yellow-400 text-black hover:bg-yellow-300'
          }`}
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? 'Running…' : dryRun ? 'Run dry' : 'Run live'}
        </button>
      </div>

      {progress && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>
              {progress.current} / {progress.total}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {result && !error && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={14} />
          {result.summary}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-black/60 max-h-72 overflow-auto">
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] tracking-wider text-zinc-500 border-b border-zinc-800">
            <Terminal size={12} /> LOG
          </div>
          <div className="px-3 py-2 font-mono text-xs leading-relaxed">
            {logs.map((line, i) => (
              <div
                key={i}
                className={
                  line.level === 'err'
                    ? 'text-red-300'
                    : line.level === 'warn'
                    ? 'text-yellow-300'
                    : 'text-zinc-300'
                }
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// Nora Translation Preview (Phase C)
//
// Mirrors the client-side pattern of the other levers on this page:
//   1. Read translation row + off-limits config from Firestore via the
//      client SDK (already authenticated as the signed-in admin user;
//      Firestore rules govern access).
//   2. Build the prompt and POST to /api/anthropic/v1/messages — the
//      shared Anthropic bridge handles ANTHROPIC_API_KEY, model gating,
//      and per-feature token caps via the `anthropic-organization` header.
//   3. Run the five guardrails locally (pure functions in guardrails.ts).
//   4. Fall back to the seed phrasing on guardrail violation or bridge error.
//   5. If persistLog is on, write one document to pulsecheck-nora-translation-log
//      directly via the client SDK (admin user has write permission).
//
// This avoids the cross-project credential mismatch that bites server-side
// admin endpoints in local dev (dev service-account vs. prod Firestore).
// =====================================================================

const TRANSLATION_DOMAIN_OPTIONS = ['sleep', 'travel', 'autonomic', 'load', 'circadian'] as const;
type TranslationDomainOption = (typeof TRANSLATION_DOMAIN_OPTIONS)[number];

const STATE_PRESETS: Record<TranslationDomainOption, string[]> = {
  sleep: ['strong', 'adequate', 'debt', 'deficit'],
  travel: ['pre-departure', 'day-of-arrival', 'day-2-post'],
  autonomic: ['sympathetic-dominant', 'parasympathetic-restored'],
  load: ['acwr-climbing', 'acwr-settled'],
  circadian: ['settled', 'mild_shift', 'travel_signature', 'jetlag_significant'],
};

interface TranslationPreviewResult {
  phrasing: string;
  providerUsed: 'anthropic' | 'fallback-seed';
  fallbackTriggered: boolean;
  fallbackReason?: 'guardrail-violation' | 'anthropic-error' | 'row-missing';
  guardrailViolations: Array<{ field: string; message: string }>;
  voiceReviewStatus: string;
  translationRowRevision: string;
  claudeOutputRaw?: string;
}

const DEFAULT_SIGNAL_JSON = JSON.stringify(
  { band: 'travel_signature', sleepMidpointShiftMinutes: 95 },
  null,
  2,
);

const NoraTranslationPreviewCard: React.FC = () => {
  const [domain, setDomain] = useState<TranslationDomainOption>('circadian');
  const [state, setState] = useState<string>('travel_signature');
  const [signalJson, setSignalJson] = useState<string>(DEFAULT_SIGNAL_JSON);
  const [persistLog, setPersistLog] = useState<boolean>(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TranslationPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRun = useCallback(async () => {
    if (running) return;
    setError(null);
    setResult(null);

    let parsedSignal: Record<string, unknown> = {};
    if (signalJson.trim().length > 0) {
      try {
        const parsed = JSON.parse(signalJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedSignal = parsed;
        } else {
          setError('Signal must be a JSON object.');
          return;
        }
      } catch (e) {
        setError(`Signal JSON is invalid: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }

    if (persistLog) {
      const ok = window.confirm(
        'persistLog is ON — this preview will write a row to pulsecheck-nora-translation-log. Proceed?',
      );
      if (!ok) return;
    }

    setRunning(true);
    try {
      // 1) Load translation row + off-limits config via client SDK.
      const rowId = `${domain}-${state}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const [rowSnap, offLimitsSnap] = await Promise.all([
        getDoc(doc(db, TRANSLATION_TABLE_COLLECTION, rowId)),
        getDoc(doc(db, OFF_LIMITS_CONFIG_COLLECTION, OFF_LIMITS_CONFIG_DOCUMENT_ID)),
      ]);

      if (!rowSnap.exists()) {
        throw new Error(`No translation row for (${domain}, ${state}). Expected doc id "${rowId}".`);
      }
      const rowData = rowSnap.data() as Partial<TranslationRow>;
      const row: TranslationRow = {
        id: rowSnap.id,
        domain: (rowData.domain ?? domain) as TranslationRow['domain'],
        state: String(rowData.state ?? state),
        athletePhrasing: String(rowData.athletePhrasing ?? ''),
        requiredActionVerbs: Array.isArray(rowData.requiredActionVerbs)
          ? rowData.requiredActionVerbs.map(String)
          : [],
        forbiddenTokens: Array.isArray(rowData.forbiddenTokens) ? rowData.forbiddenTokens.map(String) : [],
        voiceReviewStatus: (rowData.voiceReviewStatus ?? 'seed-pending-review') as TranslationRow['voiceReviewStatus'],
        revisionId: String(rowData.revisionId ?? ''),
        createdBy: String(rowData.createdBy ?? ''),
      };

      const offLimitsRaw = offLimitsSnap.exists() ? (offLimitsSnap.data() as Partial<OffLimitsConfig>) : null;
      const offLimits = {
        numericValueRules: Array.isArray(offLimitsRaw?.numericValueRules)
          ? offLimitsRaw!.numericValueRules!
          : [],
        forbiddenPhrasePatterns: Array.isArray(offLimitsRaw?.forbiddenPhrasePatterns)
          ? offLimitsRaw!.forbiddenPhrasePatterns!.map(String)
          : [],
      };

      // 2) Build prompt and call Anthropic bridge.
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in');

      const systemPrompt = [
        "You are Nora, a warm but direct performance coach speaking 1:1 with an athlete.",
        '',
        '=== VOICE ===',
        'First-person to the athlete. Action-led, calm, present-tense. Coach-adjacent: warm but not saccharine, never pathologizing.',
        '',
        '=== ABSOLUTE CONSTRAINTS ===',
        '1. Output 1\u20133 sentences. No more, no less.',
        '2. NEVER include numeric values paired with units like ms, bpm, \u00b0F, \u00b0C, or %.',
        '3. NEVER mention these markers by name: hrv, sleepScore, readiness, recovery, rhr, tempDev, daytimeStress, acwr, compositeScores.',
        "4. NEVER use negative-priming language: 'your X is low/poor/bad', 'your numbers look...', 'you've been...'. Athletes do not see scores; they receive guidance.",
        '5. Lead with an action verb. Required verbs to surface (use at least one): ' +
          (row.requiredActionVerbs.length > 0 ? row.requiredActionVerbs.join(', ') : '(none specified)') +
          '.',
        '6. No emoji. No markdown. No headers. Plain prose only.',
        '',
        '=== REFERENCE VOICE (the seed phrasing for this state \u2014 match its tone) ===',
        `"${row.athletePhrasing}"`,
        '',
        'Generate a fresh paraphrase appropriate to the supplied signal context. Your response is exactly the athlete-facing line \u2014 nothing else, no preamble, no quotation marks.',
      ].join('\n');

      const userMessage = [
        `Domain: ${domain}`,
        `State: ${state}`,
        `Signal context (structured, do not echo numbers verbatim \u2014 translate the band into guidance):`,
        JSON.stringify(parsedSignal),
        'Write the athlete-facing line now.',
      ].join('\n');

      let claudeOutputRaw: string | undefined;
      let bridgeError: string | undefined;
      try {
        // Hit the Netlify function URL directly. The /api/anthropic/* redirect
        // exists in netlify.toml but @netlify/plugin-nextjs intercepts /api/*
        // paths in dev before the redirect fires. The bridge defaults to
        // /v1/messages when no v1 subpath is present (see anthropic-bridge.ts).
        const bridgeRes = await fetch('/.netlify/functions/anthropic-bridge', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${idToken}`,
            'anthropic-organization': NORA_ATHLETE_TRANSLATION.featureId,
          },
          body: JSON.stringify({
            model: NORA_ATHLETE_TRANSLATION.model,
            max_tokens: NORA_ATHLETE_TRANSLATION.maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          }),
        });

        const bridgeText = await bridgeRes.text();
        if (!bridgeRes.ok) {
          throw new Error(`Bridge ${bridgeRes.status}: ${bridgeText.slice(0, 240)}`);
        }
        const bridgePayload = JSON.parse(bridgeText) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const text = (bridgePayload.content || [])
          .filter((b) => b.type === 'text' && typeof b.text === 'string')
          .map((b) => b.text as string)
          .join('')
          .trim();
        if (!text) throw new Error('Anthropic returned no text content');
        claudeOutputRaw = text;
      } catch (e) {
        bridgeError = e instanceof Error ? e.message : String(e);
      }

      // 3) Decide outcome.
      let finalResult: TranslationPreviewResult;

      if (bridgeError || !claudeOutputRaw) {
        finalResult = {
          phrasing: row.athletePhrasing,
          providerUsed: 'fallback-seed',
          fallbackTriggered: true,
          fallbackReason: 'anthropic-error',
          guardrailViolations: [],
          voiceReviewStatus: row.voiceReviewStatus,
          translationRowRevision: row.revisionId,
          claudeOutputRaw,
        };
      } else {
        const guardrails = runAthletePhrasingGuardrails(claudeOutputRaw, row, offLimits);
        if (guardrails.ok) {
          finalResult = {
            phrasing: claudeOutputRaw,
            providerUsed: 'anthropic',
            fallbackTriggered: false,
            guardrailViolations: [],
            voiceReviewStatus: row.voiceReviewStatus,
            translationRowRevision: row.revisionId,
            claudeOutputRaw,
          };
        } else {
          finalResult = {
            phrasing: row.athletePhrasing,
            providerUsed: 'fallback-seed',
            fallbackTriggered: true,
            fallbackReason: 'guardrail-violation',
            guardrailViolations: guardrails.violations as ValidationIssue[],
            voiceReviewStatus: row.voiceReviewStatus,
            translationRowRevision: row.revisionId,
            claudeOutputRaw,
          };
        }
      }

      // 4) Optional audit log write (client SDK; admin user has write).
      // Firestore rejects undefined field values — strip them before writing
      // so optional fields (claudeOutputRaw, fallbackReason, errorMessage)
      // simply omit when not set instead of failing the write.
      if (persistLog) {
        const logEntry: Record<string, unknown> = {
          athleteUserId: `admin-preview:${auth.currentUser?.email ?? 'unknown'}`,
          signal: parsedSignal,
          domain,
          state,
          providerUsed: finalResult.providerUsed,
          fallbackTriggered: finalResult.fallbackTriggered,
          guardrailViolations: finalResult.guardrailViolations,
          finalPhrasing: finalResult.phrasing,
          seedPhrasing: row.athletePhrasing,
          voiceReviewStatus: row.voiceReviewStatus,
          translationRowRevision: row.revisionId,
          modelUsed: NORA_ATHLETE_TRANSLATION.model,
          timestamp: serverTimestamp(),
        };
        if (finalResult.fallbackReason !== undefined) logEntry.fallbackReason = finalResult.fallbackReason;
        if (claudeOutputRaw !== undefined) logEntry.claudeOutputRaw = claudeOutputRaw;
        if (bridgeError !== undefined) logEntry.errorMessage = bridgeError;

        try {
          await addDoc(collection(db, TRANSLATION_LOG_COLLECTION), logEntry);
        } catch (logErr) {
          console.warn('[nora-translation-preview] Failed to write audit log:', logErr);
        }
      }

      setResult(finalResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [domain, state, signalJson, persistLog, running]);

  const presetStates = STATE_PRESETS[domain] ?? [];

  return (
    <div id="nora-translation-preview" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start gap-3 mb-2">
        <Sparkles className="text-purple-300 mt-1" size={18} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Nora Translation Preview</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-purple-300 bg-purple-500/10 border border-purple-400/30 px-2 py-0.5 rounded-full">
              PHASE C
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
            Generates an athlete-facing line for a (domain, state) translation row using Sonnet 4.6,
            then runs the five guardrails. Falls back to the seed phrasing on guardrail violation
            or Anthropic error. Defaults to dry-run (no audit log write).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1">Domain</label>
          <select
            value={domain}
            onChange={(e) => {
              const next = e.target.value as TranslationDomainOption;
              setDomain(next);
              const presets = STATE_PRESETS[next];
              if (presets && !presets.includes(state)) setState(presets[0] ?? '');
            }}
            disabled={running}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
          >
            {TRANSLATION_DOMAIN_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1">State</label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            disabled={running}
            list="nora-state-presets"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
          />
          <datalist id="nora-state-presets">
            {presetStates.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1">
          Signal (JSON object)
        </label>
        <textarea
          value={signalJson}
          onChange={(e) => setSignalJson(e.target.value)}
          disabled={running}
          rows={4}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="accent-purple-300"
            checked={persistLog}
            onChange={(e) => setPersistLog(e.target.checked)}
            disabled={running}
          />
          persistLog (write to pulsecheck-nora-translation-log)
        </label>
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            running ? 'bg-zinc-800 text-zinc-400 cursor-wait' : 'bg-purple-300 text-zinc-950 hover:bg-purple-200'
          }`}
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? 'Translating…' : 'Run preview'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {result && !error && (
        <div className="mt-4 space-y-3">
          <div
            className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
              result.fallbackTriggered
                ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-200'
                : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
            }`}
          >
            {result.fallbackTriggered ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            <span>
              {result.fallbackTriggered
                ? `Fallback to seed (${result.fallbackReason ?? 'unknown reason'})`
                : `Anthropic output passed all guardrails`}
            </span>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-black/60 px-3 py-3">
            <div className="text-[11px] tracking-wider text-zinc-500 mb-1">FINAL PHRASING (shown to athlete)</div>
            <div className="text-sm text-zinc-100 whitespace-pre-wrap">{result.phrasing}</div>
          </div>

          {result.claudeOutputRaw && result.claudeOutputRaw !== result.phrasing && (
            <div className="rounded-lg border border-zinc-800 bg-black/60 px-3 py-3">
              <div className="text-[11px] tracking-wider text-zinc-500 mb-1">CLAUDE RAW OUTPUT</div>
              <div className="text-sm text-zinc-300 whitespace-pre-wrap">{result.claudeOutputRaw}</div>
            </div>
          )}

          {result.guardrailViolations.length > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-3">
              <div className="text-[11px] tracking-wider text-yellow-300 mb-1">
                GUARDRAIL VIOLATIONS ({result.guardrailViolations.length})
              </div>
              <ul className="text-xs text-yellow-200 list-disc list-inside space-y-1">
                {result.guardrailViolations.map((v, i) => (
                  <li key={i}>
                    <span className="text-yellow-400">{v.field}:</span> {v.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <div className="rounded border border-zinc-800 px-2 py-1">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">provider</div>
              <div className="text-zinc-200">{result.providerUsed}</div>
            </div>
            <div className="rounded border border-zinc-800 px-2 py-1">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">voice review</div>
              <div className="text-zinc-200">{result.voiceReviewStatus}</div>
            </div>
            <div className="rounded border border-zinc-800 px-2 py-1 col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">row revision</div>
              <div className="text-zinc-200 font-mono">{result.translationRowRevision || '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLevers;
