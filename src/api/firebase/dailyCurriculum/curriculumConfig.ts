// =============================================================================
// Curriculum Config Service — singleton config for the Daily Curriculum Layer.
//
// Holds: default pillar weights, per-sport overrides, frequency targets per
// progression level, notification cadence, and the engine kill switch.
//
// Doctrine: this config is operator-tunable from /admin/curriculumLayer.
// Every edit appends to the `revisionLog` so admin surfaces can show what
// changed, when, and by whom. Engine reads always go through `getConfig()`
// so a hot-reload picks up edits without redeploy.
// =============================================================================

import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config';
import {
  CurriculumConfig,
  CurriculumConfigRevision,
  DEFAULT_FREQUENCY_PER_30_DAYS,
  DEFAULT_NOTIFICATION_CADENCE,
  EQUAL_PILLAR_WEIGHTS,
  PillarWeights,
  CURRICULUM_CONFIG_COLLECTION,
  CURRICULUM_CONFIG_SINGLETON_ID,
  validateCurriculumConfig,
} from './types';

const configsRef = () => collection(db, CURRICULUM_CONFIG_COLLECTION);
const configDocRef = () => doc(configsRef(), CURRICULUM_CONFIG_SINGLETON_ID);

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

/**
 * Build the canonical default config. Used by the seeder and by
 * getOrInitConfig() when no doc exists yet.
 */
export const buildDefaultCurriculumConfig = (): CurriculumConfig => {
  const now = Date.now();
  const revisionId = `r-${new Date(now).toISOString().slice(0, 10)}-default`;
  return {
    id: CURRICULUM_CONFIG_SINGLETON_ID,
    defaultPillarWeights: { ...EQUAL_PILLAR_WEIGHTS },
    pillarWeightsBySport: {},
    frequencyTargetsByLevel: { ...DEFAULT_FREQUENCY_PER_30_DAYS },
    notificationCadence: { ...DEFAULT_NOTIFICATION_CADENCE },
    engineEnabled: true,
    revisionId,
    revisionLog: [
      {
        revisionId,
        changedAt: now,
        summary: 'Default curriculum config seeded.',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

/** Read the singleton config. Returns null if not yet seeded. */
export const getCurriculumConfig = async (): Promise<CurriculumConfig | null> => {
  const snap = await getDoc(configDocRef());
  if (!snap.exists()) return null;
  return snap.data() as CurriculumConfig;
};

/**
 * Read the config; if it doesn't exist, write defaults and return them.
 * The daily generator calls this so the engine never crashes on a fresh
 * project that hasn't been seeded.
 */
export const getOrInitCurriculumConfig = async (): Promise<CurriculumConfig> => {
  const existing = await getCurriculumConfig();
  if (existing) return existing;
  const defaults = buildDefaultCurriculumConfig();
  await setDoc(configDocRef(), stripUndefinedDeep(defaults) as Record<string, unknown>, { merge: false });
  return defaults;
};

/**
 * Apply a partial update to the singleton, append a revision log entry,
 * bump revisionId. Validates before write.
 */
export const updateCurriculumConfig = async (
  patch: Partial<Omit<CurriculumConfig, 'id' | 'createdAt' | 'updatedAt' | 'revisionId' | 'revisionLog'>>,
  meta: { changedByUserId?: string; summary: string },
): Promise<CurriculumConfig> => {
  const current = await getOrInitCurriculumConfig();
  const now = Date.now();
  const revisionId = `r-${new Date(now).toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${
    Math.floor(Math.random() * 1e6).toString(36)
  }`;
  const newRevision: CurriculumConfigRevision = {
    revisionId,
    changedAt: now,
    changedByUserId: meta.changedByUserId,
    summary: meta.summary,
  };
  const next: CurriculumConfig = {
    ...current,
    ...patch,
    id: CURRICULUM_CONFIG_SINGLETON_ID,
    revisionId,
    revisionLog: [...(current.revisionLog || []), newRevision].slice(-50),
    createdAt: current.createdAt,
    updatedAt: now,
  };
  const validation = validateCurriculumConfig(next);
  if (!validation.ok) {
    throw new Error(
      `[curriculumConfig] update rejected: ${validation.issues.map((i) => `${i.field}: ${i.message}`).join('; ')}`,
    );
  }
  await setDoc(configDocRef(), stripUndefinedDeep(next) as Record<string, unknown>, { merge: false });
  return next;
};

/**
 * Resolve effective pillar weights for a sport. Per-sport override wins
 * over the default. The generator normalizes downstream, so callers
 * don't need to.
 */
export const resolvePillarWeightsForSport = (
  config: CurriculumConfig,
  sportId?: string,
): PillarWeights => {
  if (sportId && config.pillarWeightsBySport && config.pillarWeightsBySport[sportId]) {
    return config.pillarWeightsBySport[sportId];
  }
  return config.defaultPillarWeights;
};

export const curriculumConfigService = {
  buildDefault: buildDefaultCurriculumConfig,
  get: getCurriculumConfig,
  getOrInit: getOrInitCurriculumConfig,
  update: updateCurriculumConfig,
  resolvePillarWeights: resolvePillarWeightsForSport,
};
