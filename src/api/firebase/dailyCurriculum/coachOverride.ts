// =============================================================================
// Coach Override Service — pinned protocol/sim for an athlete during a month.
//
// Doctrine: coaches retain agency. They can pin a specific protocol or sim
// for an athlete during a calendar month, or exclude an item from the
// engine's selection pool. Overrides expire at month end automatically.
//
// Override types:
//   - `pin-protocol`     — engine must assign this protocol when the day's
//                          pillar selection matches the protocol's pillar.
//   - `pin-simulation`   — same for sims.
//   - `exclude-protocol` — engine must NEVER select this protocol for the
//                          athlete during the window (e.g., athlete reports
//                          discomfort with a particular technique).
//   - `exclude-simulation` — same for sims.
//
// Doc id format: `${athleteUserId}_${yyyy-mm}_${overrideId}`. Stable so the
// admin surface can list/edit reliably.
// =============================================================================

import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config';
import {
  CurriculumOverride,
  CURRICULUM_OVERRIDES_COLLECTION,
  validateCurriculumOverride,
  yearMonthOf,
} from './types';

const overridesRef = () => collection(db, CURRICULUM_OVERRIDES_COLLECTION);
const overrideDocRef = (id: string) => doc(overridesRef(), id);

const stripUndefinedDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [k, v]) => {
      if (v === undefined) return acc;
      acc[k] = stripUndefinedDeep(v);
      return acc;
    }, {});
  }
  return value;
};

const buildOverrideId = (athleteUserId: string, yearMonth: string, overrideKey: string): string =>
  `${athleteUserId}_${yearMonth}_${overrideKey}`;

const yearMonthEndEpoch = (yearMonth: string): number => {
  const [y, m] = yearMonth.split('-').map((s) => parseInt(s, 10));
  // Last day of month at 23:59:59 UTC.
  return Date.UTC(y, m, 0, 23, 59, 59, 999);
};

export interface CreateCurriculumOverrideInput {
  athleteUserId: string;
  yearMonth?: string; // defaults to current month UTC
  overrideType: CurriculumOverride['overrideType'];
  targetId: string;
  rationale?: string;
  createdByUserId: string;
  createdByRole: CurriculumOverride['createdByRole'];
}

export const createCurriculumOverride = async (
  input: CreateCurriculumOverrideInput,
): Promise<CurriculumOverride> => {
  const yearMonth = input.yearMonth || yearMonthOf(new Date());
  const now = Date.now();
  const overrideKey = `${input.overrideType}-${input.targetId.slice(0, 16)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const id = buildOverrideId(input.athleteUserId, yearMonth, overrideKey);

  const override: CurriculumOverride = {
    id,
    athleteUserId: input.athleteUserId,
    yearMonth,
    overrideType: input.overrideType,
    targetId: input.targetId,
    rationale: input.rationale,
    createdByUserId: input.createdByUserId,
    createdByRole: input.createdByRole,
    createdAt: now,
    expiresAt: yearMonthEndEpoch(yearMonth),
    status: 'active',
  };

  const validation = validateCurriculumOverride(override);
  if (!validation.ok) {
    throw new Error(
      `[coachOverride] create rejected: ${validation.issues.map((i) => `${i.field}: ${i.message}`).join('; ')}`,
    );
  }

  await setDoc(overrideDocRef(id), stripUndefinedDeep(override) as Record<string, unknown>, { merge: false });
  return override;
};

/**
 * List active overrides for an athlete in a given month. The generator
 * calls this once per generation cycle to apply pins + exclusions.
 */
export const listOverridesForAthlete = async (
  athleteUserId: string,
  yearMonth?: string,
): Promise<CurriculumOverride[]> => {
  const ym = yearMonth || yearMonthOf(new Date());
  const q = query(
    overridesRef(),
    where('athleteUserId', '==', athleteUserId),
    where('yearMonth', '==', ym),
    where('status', '==', 'active'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as CurriculumOverride), id: d.id }));
};

/**
 * Mark an override consumed. The generator calls this when it actually
 * applied a pin (so the admin surface can show "applied 2026-04-29").
 */
export const markOverrideConsumed = async (overrideId: string): Promise<void> => {
  await setDoc(
    overrideDocRef(overrideId),
    { status: 'consumed', updatedAt: Date.now() },
    { merge: true },
  );
};

/** Manual revoke from admin surface. */
export const revokeOverride = async (overrideId: string): Promise<void> => {
  await setDoc(
    overrideDocRef(overrideId),
    { status: 'revoked', updatedAt: Date.now() },
    { merge: true },
  );
};

export const coachOverrideService = {
  create: createCurriculumOverride,
  listForAthlete: listOverridesForAthlete,
  markConsumed: markOverrideConsumed,
  revoke: revokeOverride,
};
