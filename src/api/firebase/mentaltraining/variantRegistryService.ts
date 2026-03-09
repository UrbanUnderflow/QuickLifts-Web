import { db } from '../config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore';
import {
  MentalExercise,
  exerciseToFirestore,
} from './types';
import {
  SIM_MODULES_COLLECTION,
  SIM_VARIANTS_COLLECTION,
} from './collections';

export type SimVariantSpecStatus = 'needs-spec' | 'in-progress' | 'complete' | 'not-required';
export type SimVariantFamilyStatus = 'locked' | 'candidate';
export type SimVariantMode = 'branch' | 'library' | 'hybrid';
export type SimVariantArchetype =
  | 'baseline'
  | 'trial'
  | 'short_daily'
  | 'visual_channel'
  | 'audio_channel'
  | 'combined_channel'
  | 'cognitive_pressure'
  | 'sport_context'
  | 'immersive'
  | 'fatigue_load'
  | 'decoy_discrimination';

export interface SimVariantSeed {
  name: string;
  family: string;
  familyStatus: SimVariantFamilyStatus;
  mode: SimVariantMode;
  specStatus: SimVariantSpecStatus;
  priority: 'high' | 'medium' | 'low';
}

export interface SimVariantModuleDraft {
  moduleId: string;
  name: string;
  description: string;
  category: MentalExercise['category'];
  difficulty: MentalExercise['difficulty'];
  durationMinutes: number;
  benefits: string[];
  bestFor: string[];
  origin: string;
  neuroscience: string;
  overview: MentalExercise['overview'];
  iconName: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SimVariantLockedSpec {
  fixedTier: string;
  fixedDuration: string;
  targetSessionStructure: string;
  buildVersionPolicy: string;
  seedPolicy: string;
  modifierProfile: string;
  environmentRequirements: string;
  fixedProfileDetails: string;
  validResponseRule: string;
  artifactFloorRule: string;
  maxWindowRule: string;
  failedRoundRule: string;
  falseStartRule: string;
  validSessionRule: string;
  partialSessionRule: string;
  invalidSessionRule: string;
  dropoutRule: string;
  retryRule: string;
  transferMetricDefinition: string;
  transferMetricReporting: string;
  validationStage: string;
  nextValidationMilestone: string;
  motorBaselineRule: string;
  deviceCovariateRule: string;
  exportRequirements: string;
}

export interface SimVariantRecord extends SimVariantSeed {
  id: string;
  specRaw?: string;
  archetypeOverride?: SimVariantArchetype;
  lockedSpec?: SimVariantLockedSpec;
  runtimeConfig?: Record<string, any>;
  moduleDraft?: SimVariantModuleDraft;
  publishedModuleId?: string;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type SimVariantHistoryAction = 'created' | 'saved' | 'published' | 'seeded';

export interface SimVariantHistoryEntry {
  id: string;
  variantId: string;
  action: SimVariantHistoryAction;
  summary: string;
  createdAt: number;
  moduleId?: string;
  snapshot: SimVariantRecord;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildSimVariantId(seed: SimVariantSeed) {
  return `${slugify(seed.family)}-${seed.mode}-${slugify(seed.name)}`;
}

function variantFromFirestore(id: string, data: Record<string, any>): SimVariantRecord {
  return {
    id,
    name: data.name || '',
    family: data.family || '',
    familyStatus: data.familyStatus || 'candidate',
    mode: data.mode || 'branch',
    specStatus: data.specStatus || 'needs-spec',
    priority: data.priority || 'medium',
    specRaw: data.specRaw || '',
    archetypeOverride: data.archetypeOverride || undefined,
    lockedSpec: data.lockedSpec || undefined,
    runtimeConfig: data.runtimeConfig || undefined,
    moduleDraft: data.moduleDraft || undefined,
    publishedModuleId: data.publishedModuleId || undefined,
    publishedAt: data.publishedAt || undefined,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

function variantToFirestore(record: SimVariantRecord): Record<string, any> {
  return {
    name: record.name,
    family: record.family,
    familyStatus: record.familyStatus,
    mode: record.mode,
    specStatus: record.specStatus,
    priority: record.priority,
    specRaw: record.specRaw || '',
    archetypeOverride: record.archetypeOverride || null,
    lockedSpec: record.lockedSpec || null,
    runtimeConfig: record.runtimeConfig || null,
    moduleDraft: record.moduleDraft || null,
    publishedModuleId: record.publishedModuleId || null,
    publishedAt: record.publishedAt || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function buildHistorySummary(action: SimVariantHistoryAction, record: SimVariantRecord, moduleId?: string) {
  switch (action) {
    case 'created':
      return `Created ${record.name} in the variant registry.`;
    case 'saved':
      return `Saved ${record.name} workspace changes.`;
    case 'published':
      return `Published ${record.name} to sim-modules${moduleId ? ` as ${moduleId}` : ''}.`;
    case 'seeded':
      return `Seeded ${record.name} from the static registry baseline.`;
    default:
      return `${record.name} updated.`;
  }
}

function historyToFirestore(entry: Omit<SimVariantHistoryEntry, 'id'>): Record<string, any> {
  return {
    variantId: entry.variantId,
    action: entry.action,
    summary: entry.summary,
    createdAt: entry.createdAt,
    moduleId: entry.moduleId || null,
    snapshot: variantToFirestore(entry.snapshot),
  };
}

function historyFromFirestore(id: string, data: Record<string, any>): SimVariantHistoryEntry {
  return {
    id,
    variantId: data.variantId || '',
    action: data.action || 'saved',
    summary: data.summary || '',
    createdAt: data.createdAt || Date.now(),
    moduleId: data.moduleId || undefined,
    snapshot: variantFromFirestore(data.variantId || '', data.snapshot || {}),
  };
}

function buildHistoryRef(variantId: string) {
  return collection(db, SIM_VARIANTS_COLLECTION, variantId, 'history');
}

function writeVariantHistory(
  batch: ReturnType<typeof writeBatch>,
  record: SimVariantRecord,
  action: SimVariantHistoryAction,
  moduleId?: string
) {
  const historyDoc = doc(buildHistoryRef(record.id));
  const createdAt = Date.now();
  batch.set(
    historyDoc,
    historyToFirestore({
      variantId: record.id,
      action,
      summary: buildHistorySummary(action, record, moduleId),
      createdAt,
      moduleId,
      snapshot: record,
    })
  );
}

export const simVariantRegistryService = {
  async list(): Promise<SimVariantRecord[]> {
    const snap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION));
    return snap.docs.map((entry) => variantFromFirestore(entry.id, entry.data()));
  },

  async syncSeeds(seeds: SimVariantSeed[]): Promise<{ records: SimVariantRecord[]; created: number }> {
    const existing = await this.list();
    const existingById = new Map(existing.map((record) => [record.id, record]));
    const now = Date.now();
    const batch = writeBatch(db);
    let created = 0;

    seeds.forEach((seed) => {
      const id = buildSimVariantId(seed);
      if (existingById.has(id)) {
        return;
      }

      const record: SimVariantRecord = {
        id,
        ...seed,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(doc(db, SIM_VARIANTS_COLLECTION, id), variantToFirestore(record));
      writeVariantHistory(batch, record, 'seeded');
      existingById.set(id, record);
      created += 1;
    });

    if (created > 0) {
      await batch.commit();
    }

    return {
      created,
      records: Array.from(existingById.values()),
    };
  },

  async save(record: SimVariantRecord): Promise<void> {
    const variantRef = doc(db, SIM_VARIANTS_COLLECTION, record.id);
    const existing = await getDoc(variantRef);
    const now = Date.now();
    const nextRecord: SimVariantRecord = {
      ...record,
      createdAt: existing.exists() ? record.createdAt : now,
      updatedAt: now,
    };
    const batch = writeBatch(db);
    batch.set(variantRef, variantToFirestore(nextRecord), { merge: true });
    writeVariantHistory(batch, nextRecord, existing.exists() ? 'saved' : 'created');
    await batch.commit();
  },

  async publish(record: SimVariantRecord, module: MentalExercise): Promise<string> {
    const publishedAt = Date.now();
    const nextRecord: SimVariantRecord = {
      ...record,
      publishedModuleId: module.id,
      publishedAt,
      specStatus: record.specStatus === 'not-required' ? 'not-required' : 'complete',
      updatedAt: publishedAt,
    };
    const batch = writeBatch(db);

    batch.set(
      doc(db, SIM_MODULES_COLLECTION, module.id),
      exerciseToFirestore({
        ...module,
        variantSource: {
          variantId: record.id,
          variantName: record.name,
          family: record.family,
          mode: record.mode,
          publishedAt,
        },
      }),
      { merge: true }
    );

    batch.set(
      doc(db, SIM_VARIANTS_COLLECTION, record.id),
      variantToFirestore(nextRecord),
      { merge: true }
    );
    writeVariantHistory(batch, nextRecord, 'published', module.id);
    await batch.commit();

    return module.id;
  },

  async listHistory(variantId: string): Promise<SimVariantHistoryEntry[]> {
    const snap = await getDocs(query(buildHistoryRef(variantId), orderBy('createdAt', 'desc')));
    return snap.docs.map((entry) => historyFromFirestore(entry.id, entry.data()));
  },
};
