// =============================================================================
// Athlete Sport Profile Mirror — keeps `users/{uid}.athleteSport*` in sync
// with the canonical sport selection from PulseCheck team membership and
// the Macra profile.
//
// Why this exists: the Sports Intelligence Layer Spec says athlete sport
// fields are "mirrored to root users/{uid}.athleteSport for cross-product
// reads." Macra daily insight, Nora chat, and the coach-report generator
// all read the root mirror. Until this service shipped, the mirror was
// read-only — nothing wrote it after onboarding. Any drift between the
// canonical sport (in PulseCheck membership / Macra profile) and the
// mirror leaks into bad reports.
//
// Contract:
//   1. PulseCheck team membership is the canonical source for an athlete's
//      sport on a given team.
//   2. Macra profile is the canonical source for non-PulseCheck athletes.
//   3. The mirror at `users/{uid}.athleteSport`, `athleteSportName`,
//      `athleteSportPosition` should always reflect the most recent
//      canonical write.
//   4. If both sources disagree, PulseCheck membership wins (it is the
//      source for sport-aware coach reports, which is the highest-stakes
//      consumer of the mirror).
// =============================================================================

import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './config';

const USERS_COLLECTION = 'users';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const MACRA_PROFILE_PATH = (uid: string) => doc(db, USERS_COLLECTION, uid, 'macra', 'profile');

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export interface AthleteSportMirrorFields {
  athleteSport?: string;
  athleteSportName?: string;
  athleteSportPosition?: string;
}

export type AthleteSportMirrorSource = 'pulsecheck_membership' | 'macra_profile' | 'manual_override';

export interface AthleteSportMirrorResult {
  uid: string;
  source: AthleteSportMirrorSource | 'no_source';
  applied: AthleteSportMirrorFields;
  previous: AthleteSportMirrorFields;
  changed: boolean;
}

/**
 * Source-of-truth resolution. Reads PulseCheck team memberships first
 * (preferred), then Macra profile, returning the first canonical sport
 * tuple it finds along with the source identifier.
 */
export const resolveCanonicalAthleteSport = async (
  uid: string,
): Promise<{ source: AthleteSportMirrorSource | 'no_source'; fields: AthleteSportMirrorFields }> => {
  const normalizedUid = normalizeString(uid);
  if (!normalizedUid) {
    throw new Error('[AthleteSportMirror] uid is required.');
  }

  const membershipsSnap = await getDocs(
    query(
      collection(db, TEAM_MEMBERSHIPS_COLLECTION),
      where('userId', '==', normalizedUid),
      where('status', '==', 'active'),
    ),
  );

  for (const docSnap of membershipsSnap.docs) {
    const data = docSnap.data() || {};
    const onboarding = (data.athleteOnboarding || {}) as Record<string, unknown>;
    const sport = normalizeString(onboarding.sportId || data.sportId || onboarding.athleteSport);
    if (!sport) continue;
    return {
      source: 'pulsecheck_membership',
      fields: {
        athleteSport: sport,
        athleteSportName: normalizeString(onboarding.sportName || data.sportName || onboarding.athleteSportName) || undefined,
        athleteSportPosition: normalizeString(onboarding.sportPosition || data.sportPosition || onboarding.athleteSportPosition) || undefined,
      },
    };
  }

  const macraSnap = await getDoc(MACRA_PROFILE_PATH(normalizedUid));
  if (macraSnap.exists()) {
    const data = macraSnap.data() || {};
    const sport = normalizeString(data.sportId || data.athleteSport);
    if (sport) {
      return {
        source: 'macra_profile',
        fields: {
          athleteSport: sport,
          athleteSportName: normalizeString(data.sportName || data.athleteSportName) || undefined,
          athleteSportPosition: normalizeString(data.sportPosition || data.athleteSportPosition) || undefined,
        },
      };
    }
  }

  return { source: 'no_source', fields: {} };
};

/**
 * Apply the mirror writes to the root user doc. Idempotent: skips the
 * Firestore write if the canonical fields already match.
 *
 * @param options.dryRun When true, returns the diff without writing.
 */
export const applyAthleteSportMirror = async (
  uid: string,
  options: {
    dryRun?: boolean;
    overrideFields?: AthleteSportMirrorFields;
    overrideSource?: AthleteSportMirrorSource;
  } = {},
): Promise<AthleteSportMirrorResult> => {
  const normalizedUid = normalizeString(uid);
  if (!normalizedUid) {
    throw new Error('[AthleteSportMirror] uid is required.');
  }

  const userRef = doc(db, USERS_COLLECTION, normalizedUid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error(`[AthleteSportMirror] User ${normalizedUid} does not exist.`);
  }

  const existing = userSnap.data() || {};
  const previous: AthleteSportMirrorFields = {
    athleteSport: normalizeString(existing.athleteSport) || undefined,
    athleteSportName: normalizeString(existing.athleteSportName) || undefined,
    athleteSportPosition: normalizeString(existing.athleteSportPosition) || undefined,
  };

  let resolved: { source: AthleteSportMirrorSource | 'no_source'; fields: AthleteSportMirrorFields };
  if (options.overrideFields && options.overrideSource) {
    resolved = { source: options.overrideSource, fields: options.overrideFields };
  } else {
    resolved = await resolveCanonicalAthleteSport(normalizedUid);
  }

  const next: AthleteSportMirrorFields = {
    athleteSport: normalizeString(resolved.fields.athleteSport) || undefined,
    athleteSportName: normalizeString(resolved.fields.athleteSportName) || undefined,
    athleteSportPosition: normalizeString(resolved.fields.athleteSportPosition) || undefined,
  };

  const changed =
    previous.athleteSport !== next.athleteSport ||
    previous.athleteSportName !== next.athleteSportName ||
    previous.athleteSportPosition !== next.athleteSportPosition;

  if (changed && !options.dryRun) {
    await updateDoc(userRef, {
      athleteSport: next.athleteSport ?? null,
      athleteSportName: next.athleteSportName ?? null,
      athleteSportPosition: next.athleteSportPosition ?? null,
      athleteSportMirroredAt: serverTimestamp(),
      athleteSportMirroredSource: resolved.source,
    });
  }

  return {
    uid: normalizedUid,
    source: resolved.source,
    applied: next,
    previous,
    changed,
  };
};

/**
 * Backfill the mirror across every PulseCheck team member. Returns a
 * summary of what was changed. Safe to run repeatedly.
 *
 * Limited to active PulseCheck team memberships so we don't iterate the
 * whole user base. Runners should also call this on the Macra side via
 * a separate query if/when Macra-only athletes are in scope.
 */
export const backfillAthleteSportMirrorForAllPulseCheckAthletes = async (
  options: {
    dryRun?: boolean;
    onProgress?: (result: AthleteSportMirrorResult) => void;
  } = {},
): Promise<{
  scanned: number;
  changed: number;
  noSource: number;
  results: AthleteSportMirrorResult[];
}> => {
  const membershipsSnap = await getDocs(
    query(
      collection(db, TEAM_MEMBERSHIPS_COLLECTION),
      where('role', '==', 'athlete'),
      where('status', '==', 'active'),
    ),
  );

  const seenUids = new Set<string>();
  const results: AthleteSportMirrorResult[] = [];
  let changed = 0;
  let noSource = 0;

  for (const docSnap of membershipsSnap.docs) {
    const data = docSnap.data() || {};
    const uid = normalizeString(data.userId);
    if (!uid || seenUids.has(uid)) continue;
    seenUids.add(uid);

    try {
      const result = await applyAthleteSportMirror(uid, { dryRun: options.dryRun });
      results.push(result);
      if (result.changed) changed += 1;
      if (result.source === 'no_source') noSource += 1;
      options.onProgress?.(result);
    } catch (error) {
      console.error('[AthleteSportMirror] backfill failed for uid', uid, error);
    }
  }

  return {
    scanned: results.length,
    changed,
    noSource,
    results,
  };
};

/**
 * Helper for callers that already know the canonical fields (e.g., a
 * cloud function called from iOS at the moment of sport selection). Skips
 * the resolution step and writes directly.
 */
export const writeAthleteSportMirrorDirect = async (
  uid: string,
  fields: AthleteSportMirrorFields,
  source: AthleteSportMirrorSource = 'manual_override',
): Promise<AthleteSportMirrorResult> =>
  applyAthleteSportMirror(uid, {
    overrideFields: fields,
    overrideSource: source,
  });

export const athleteSportProfileMirrorService = {
  resolve: resolveCanonicalAthleteSport,
  apply: applyAthleteSportMirror,
  backfill: backfillAthleteSportMirrorForAllPulseCheckAthletes,
  writeDirect: writeAthleteSportMirrorDirect,
};
