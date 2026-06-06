import type * as FirebaseAdmin from 'firebase-admin';
import type {
  MentalExercise,
  PulseCheckDailyAssignment,
  PulseCheckProtocolDefinition,
} from '../../../src/api/firebase/mentaltraining/types';
import { TaxonomyPillar } from '../../../src/api/firebase/mentaltraining/taxonomy';
import {
  CURRICULUM_ASSESSMENTS_COLLECTION,
  CURRICULUM_CONFIG_COLLECTION,
  CURRICULUM_CONFIG_SINGLETON_ID,
  CURRICULUM_OVERRIDES_COLLECTION,
  CurriculumAssessment,
  CurriculumConfig,
  CurriculumGenerationResult,
  CurriculumOverride,
  DEFAULT_FREQUENCY_PER_30_DAYS,
  DEFAULT_NOTIFICATION_CADENCE,
  EQUAL_PILLAR_WEIGHTS,
  ProgressionLevel,
  resolveFrequency,
  yearMonthOf,
} from '../../../src/api/firebase/dailyCurriculum/types';
import {
  AssetCandidate,
  CompletionsSnapshot,
  countRepsByPillar,
  pickAsset,
  pickWorstGapPillar,
} from '../../../src/api/firebase/dailyCurriculum/selection';
import { buildCurriculumAssignmentIntent } from '../../../src/api/firebase/dailyCurriculum/assignmentIntent';

const PROTOCOLS_COLLECTION = 'pulsecheck-protocols';
const SIM_MODULES_COLLECTION = 'sim-modules';
const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const ASSIGNMENT_EVENTS_COLLECTION = 'pulsecheck-assignment-events';
const GENERATION_TRACES_COLLECTION = 'pulsecheck-curriculum-generation-traces';
const CURRICULUM_SLATES_COLLECTION = 'pulsecheck-curriculum-slates';
const CURRICULUM_SLOT_TARGET_PER_KIND = 3;
const CURRICULUM_GENERATOR_VERSION = 'six_slot_curriculum_v1';

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

const dateKey = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const emptyPillarCounts = (): Record<TaxonomyPillar, number> => ({
  [TaxonomyPillar.Composure]: 0,
  [TaxonomyPillar.Focus]: 0,
  [TaxonomyPillar.Decision]: 0,
});

const normalizeAssignmentKind = (value: unknown): 'protocol' | 'sim' | undefined => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'protocol') return 'protocol';
  if (normalized === 'simulation' || normalized === 'sim') return 'sim';
  return undefined;
};

const eventAssignmentKind = (ev: Record<string, unknown>): 'protocol' | 'sim' | undefined => {
  const metadata = ev.metadata as Record<string, unknown> | undefined;
  const nextSummary = metadata?.nextAssignmentSummary as Record<string, unknown> | undefined;
  const previousSummary = metadata?.previousAssignmentSummary as Record<string, unknown> | undefined;
  return normalizeAssignmentKind(ev.actionType)
    || normalizeAssignmentKind(nextSummary?.actionType)
    || normalizeAssignmentKind(previousSummary?.actionType);
};

const eventAssetId = (ev: Record<string, unknown>): string | undefined => {
  const metadata = ev.metadata as Record<string, unknown> | undefined;
  const nextSummary = metadata?.nextAssignmentSummary as Record<string, unknown> | undefined;
  const previousSummary = metadata?.previousAssignmentSummary as Record<string, unknown> | undefined;
  return (ev.chosenCandidateId as string | undefined)
    || (ev.protocolId as string | undefined)
    || (ev.simSpecId as string | undefined)
    || (nextSummary?.chosenCandidateId as string | undefined)
    || (nextSummary?.protocolId as string | undefined)
    || (nextSummary?.simSpecId as string | undefined)
    || (previousSummary?.chosenCandidateId as string | undefined)
    || (previousSummary?.protocolId as string | undefined)
    || (previousSummary?.simSpecId as string | undefined);
};

const eventPillar = (ev: Record<string, unknown>): TaxonomyPillar | undefined => {
  const metadata = ev.metadata as Record<string, unknown> | undefined;
  const nextSummary = metadata?.nextAssignmentSummary as Record<string, unknown> | undefined;
  const previousSummary = metadata?.previousAssignmentSummary as Record<string, unknown> | undefined;
  const intent = ev.curriculumIntent as Record<string, unknown> | undefined;
  const value = (ev.cognitivePillar as string | undefined)
    || (nextSummary?.cognitivePillar as string | undefined)
    || (previousSummary?.cognitivePillar as string | undefined)
    || (intent?.cognitivePillar as string | undefined)
    || (intent?.drivingPillar as string | undefined);
  return value && Object.values(TaxonomyPillar).includes(value as TaxonomyPillar)
    ? value as TaxonomyPillar
    : undefined;
};

const isCompletedAssignmentRecord = (assignment: Record<string, unknown>): boolean => {
  if (assignment.status === 'completed') return true;
  if (assignment.actionType !== 'protocol') return false;

  const session = assignment.protocolPracticeSession as Record<string, unknown> | undefined;
  if (!session) return false;

  const completedAt = session.completedAt;
  if (typeof completedAt === 'number' && completedAt > 0) return true;
  if (completedAt && typeof completedAt === 'object') return true;

  const scorecard = session.scorecard as Record<string, unknown> | undefined;
  return Boolean(scorecard && Object.keys(scorecard).length > 0);
};

const buildDefaultCurriculumConfig = (): CurriculumConfig => {
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

export const getOrInitCurriculumConfigAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
): Promise<CurriculumConfig> => {
  const ref = db.collection(CURRICULUM_CONFIG_COLLECTION).doc(CURRICULUM_CONFIG_SINGLETON_ID);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as CurriculumConfig;
  const defaults = buildDefaultCurriculumConfig();
  await ref.set(stripUndefinedDeep(defaults) as Record<string, unknown>, { merge: false });
  return defaults;
};

const resolvePillarWeightsForSportAdmin = (config: CurriculumConfig, sportId?: string) => {
  if (sportId && config.pillarWeightsBySport && config.pillarWeightsBySport[sportId]) {
    return config.pillarWeightsBySport[sportId];
  }
  return config.defaultPillarWeights;
};

export interface GenerateDailyAssignmentAdminInput {
  athleteUserId: string;
  teamId: string;
  teamMembershipId: string;
  sportId?: string;
  sourceDate?: string;
  timezone?: string;
  preview?: boolean;
}

type CurriculumSlotKind = 'protocol' | 'simulation';

interface ExistingCurriculumAssignmentRecord {
  documentId: string;
  data: Record<string, unknown>;
}

interface CurriculumSlotInput {
  assignmentId: string;
  kind: CurriculumSlotKind;
  slotIndex: number;
  existing?: ExistingCurriculumAssignmentRecord;
  pick?: AssetCandidate;
}

const numberValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const stringValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const assignmentRecordKind = (record: ExistingCurriculumAssignmentRecord): 'protocol' | 'sim' | undefined =>
  normalizeAssignmentKind(record.data.actionType);

const assignmentRecordAssetId = (record: ExistingCurriculumAssignmentRecord): string | undefined =>
  eventAssetId(record.data);

const assignmentRecordLabel = (
  record: ExistingCurriculumAssignmentRecord | undefined,
  kind: CurriculumSlotKind,
): string | undefined => {
  if (!record) return undefined;
  if (kind === 'protocol') {
    return stringValue(record.data.protocolLabel) || stringValue(record.data.chosenCandidateId);
  }
  return stringValue(record.data.simName) || stringValue(record.data.simSpecId) || stringValue(record.data.chosenCandidateId);
};

const assignmentRecordCreatedAt = (record: ExistingCurriculumAssignmentRecord): number =>
  numberValue(record.data.createdAt) || numberValue(record.data.materializedAt) || 0;

const assignmentRecordSlotIndex = (record: ExistingCurriculumAssignmentRecord): number =>
  numberValue(record.data.curriculumSlotIndex) || Number.MAX_SAFE_INTEGER;

const sortExistingCurriculumAssignments = (
  records: ExistingCurriculumAssignmentRecord[],
): ExistingCurriculumAssignmentRecord[] =>
  [...records].sort((a, b) => {
    const slotDelta = assignmentRecordSlotIndex(a) - assignmentRecordSlotIndex(b);
    if (slotDelta !== 0) return slotDelta;
    return assignmentRecordCreatedAt(a) - assignmentRecordCreatedAt(b);
  });

const fetchTodaysCurriculumAssignmentsAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  athleteUserId: string,
  sourceDate: string,
): Promise<ExistingCurriculumAssignmentRecord[]> => {
  try {
    const snap = await db
      .collection(DAILY_ASSIGNMENTS_COLLECTION)
      .where('athleteId', '==', athleteUserId)
      .where('sourceDate', '==', sourceDate)
      .where('assignedBy', '==', 'curriculum-engine')
      .limit(12)
      .get();
    return snap.docs.map((doc) => ({
      documentId: doc.id,
      data: doc.data() as Record<string, unknown>,
    }));
  } catch {
    return [];
  }
};

const pickAssetSeries = ({
  count,
  pool,
  drivingPillar,
  completions,
  overrides,
  recentlyAssigned,
  kind,
  frequencyDefaults,
}: {
  count: number;
  pool: Array<PulseCheckProtocolDefinition | MentalExercise>;
  drivingPillar: TaxonomyPillar;
  completions: CompletionsSnapshot;
  overrides: CurriculumOverride[];
  recentlyAssigned: Set<string>;
  kind: 'protocol' | 'sim';
  frequencyDefaults: Record<ProgressionLevel, number>;
}): AssetCandidate[] => {
  const picks: AssetCandidate[] = [];
  const blocked = new Set(recentlyAssigned);

  for (let slot = 0; slot < count; slot += 1) {
    const pick = pickAsset({
      pool,
      drivingPillar,
      completions,
      overrides,
      recentlyAssigned: blocked,
      kind,
      frequencyDefaults,
    });
    if (!pick) break;
    picks.push(pick);
    blocked.add(pick.asset.id);
  }

  return picks;
};

const selectionLabel = (pick: AssetCandidate, kind: CurriculumSlotKind): string =>
  kind === 'protocol'
    ? ((pick.asset as PulseCheckProtocolDefinition).label || pick.asset.id)
    : ((pick.asset as MentalExercise).name || (pick.asset as MentalExercise).simSpecId || pick.asset.id);

const buildCurriculumSlots = ({
  athleteUserId,
  sourceDate,
  generatedAt,
  kind,
  existing,
  picks,
}: {
  athleteUserId: string;
  sourceDate: string;
  generatedAt: number;
  kind: CurriculumSlotKind;
  existing: ExistingCurriculumAssignmentRecord[];
  picks: AssetCandidate[];
}): CurriculumSlotInput[] => {
  const slots: CurriculumSlotInput[] = [];
  const pickQueue = [...picks];
  const idKind = kind === 'protocol' ? 'protocol' : 'sim';

  for (let index = 1; index <= CURRICULUM_SLOT_TARGET_PER_KIND; index += 1) {
    const existingRecord = existing[index - 1];
    if (existingRecord) {
      slots.push({
        assignmentId: existingRecord.documentId,
        kind,
        slotIndex: index,
        existing: existingRecord,
      });
      continue;
    }

    const pick = pickQueue.shift();
    if (!pick) continue;
    slots.push({
      assignmentId: `${athleteUserId}_${sourceDate}_${idKind}_slot${index}_${generatedAt}`,
      kind,
      slotIndex: index,
      pick,
    });
  }

  return slots;
};

const slotLabel = (slot: CurriculumSlotInput): string => {
  if (slot.pick) return selectionLabel(slot.pick, slot.kind);
  return assignmentRecordLabel(slot.existing, slot.kind) || slot.assignmentId;
};

const slotAssetId = (slot: CurriculumSlotInput): string => {
  if (slot.pick) return slot.pick.asset.id;
  return assignmentRecordAssetId(slot.existing as ExistingCurriculumAssignmentRecord) || slot.assignmentId;
};

const slotPillar = (slot: CurriculumSlotInput, drivingPillar: TaxonomyPillar): TaxonomyPillar => {
  if (slot.pick) return slot.pick.cognitivePillar;
  return (slot.existing ? eventPillar(slot.existing.data) : undefined) || drivingPillar;
};

const slotProgression = (slot: CurriculumSlotInput): ProgressionLevel =>
  slot.pick?.progressionLevel || 'foundational';

const slotRationale = (slot: CurriculumSlotInput): string =>
  slot.pick?.rationale || stringValue(slot.existing?.data.rationale) || 'Queued by the curriculum slate.';

const existingCurriculumIntent = (slot: CurriculumSlotInput): Record<string, unknown> | undefined => {
  const intent = slot.existing?.data.curriculumIntent;
  return intent && typeof intent === 'object' ? intent as Record<string, unknown> : undefined;
};

const buildSlotIntent = ({
  slot,
  drivingPillar,
  pairedAssignmentLabel,
}: {
  slot: CurriculumSlotInput;
  drivingPillar: TaxonomyPillar;
  pairedAssignmentLabel?: string;
}) =>
  buildCurriculumAssignmentIntent({
    kind: slot.kind,
    assetLabel: slotLabel(slot),
    drivingPillar,
    cognitivePillar: slotPillar(slot, drivingPillar),
    progressionLevel: slotProgression(slot),
    actualReps: slot.pick?.actualReps || numberValue(existingCurriculumIntent(slot)?.currentRep) || 0,
    recommendedFrequency:
      slot.pick?.recommendedFrequency || numberValue(existingCurriculumIntent(slot)?.targetReps) || 12,
    pairedAssignmentLabel,
  });

const buildSlotMetadata = ({
  slateId,
  slot,
}: {
  slateId: string;
  slot: CurriculumSlotInput;
}): Record<string, unknown> => {
  const isDueToday = slot.slotIndex === 1;
  return {
    curriculumSlateId: slateId,
    curriculumSlotId: `${slateId}_${slot.kind}_${slot.slotIndex}`,
    curriculumSlotIndex: slot.slotIndex,
    curriculumSlotKind: slot.kind,
    curriculumSlotState: 'active',
    curriculumLane: slot.kind === 'protocol' ? 'mental_regulation' : 'mental_sharpening',
    curriculumIsDueToday: isDueToday,
    curriculumDueRank: isDueToday ? (slot.kind === 'protocol' ? 1 : 2) : undefined,
    curriculumGeneratorVersion: CURRICULUM_GENERATOR_VERSION,
    isPrimaryForDate: slot.kind === 'protocol' && isDueToday,
  };
};

export const generateDailyAssignmentAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  input: GenerateDailyAssignmentAdminInput,
): Promise<CurriculumGenerationResult | null> => {
  const config = await getOrInitCurriculumConfigAdmin(db);
  if (!config.engineEnabled) return null;

  const sourceDate = input.sourceDate || dateKey(new Date());
  const yearMonth = yearMonthOf(sourceDate);
  const generatedAt = Date.now();

  const [protocols, sims, completions, overrides, existingAssignments] = await Promise.all([
    fetchEligibleProtocolsAdmin(db),
    fetchEligibleSimsAdmin(db),
    fetchLast30DaysCompletionsAdmin(db, input.athleteUserId, sourceDate),
    listOverridesForAthleteAdmin(db, input.athleteUserId, yearMonth),
    input.preview ? Promise.resolve([]) : fetchTodaysCurriculumAssignmentsAdmin(db, input.athleteUserId, sourceDate),
  ]);

  const pillarRepCounts = countRepsByPillar(completions, protocols, sims);
  const recentlyAssigned = completions.recentlyAssignedIds(2);
  const pillarWeights = resolvePillarWeightsForSportAdmin(config, input.sportId);
  const protocolPillarRepCounts = completions.byPillarByKind?.protocol ?? pillarRepCounts;
  const simPillarRepCounts = completions.byPillarByKind?.sim ?? pillarRepCounts;
  const protocolDrivingPillar = pickWorstGapPillar(
    protocolPillarRepCounts,
    pillarWeights,
    config.frequencyTargetsByLevel,
    protocols,
  );
  const simDrivingPillar = pickWorstGapPillar(
    simPillarRepCounts,
    pillarWeights,
    config.frequencyTargetsByLevel,
    protocols,
  );

  const existingProtocols = sortExistingCurriculumAssignments(
    existingAssignments.filter((record) => assignmentRecordKind(record) === 'protocol'),
  );
  const existingSims = sortExistingCurriculumAssignments(
    existingAssignments.filter((record) => assignmentRecordKind(record) === 'sim'),
  );
  const existingProtocolAssetIds = existingProtocols.map(assignmentRecordAssetId).filter(Boolean) as string[];
  const existingSimAssetIds = existingSims.map(assignmentRecordAssetId).filter(Boolean) as string[];
  const protocolPicks = pickAssetSeries({
    count: Math.max(0, CURRICULUM_SLOT_TARGET_PER_KIND - existingProtocols.length),
    pool: protocols,
    drivingPillar: protocolDrivingPillar,
    completions,
    overrides,
    recentlyAssigned: new Set([...recentlyAssigned, ...existingProtocolAssetIds]),
    kind: 'protocol',
    frequencyDefaults: config.frequencyTargetsByLevel,
  });
  const simPicks = pickAssetSeries({
    count: Math.max(0, CURRICULUM_SLOT_TARGET_PER_KIND - existingSims.length),
    pool: sims,
    drivingPillar: simDrivingPillar,
    completions,
    overrides,
    recentlyAssigned: new Set([...recentlyAssigned, ...existingSimAssetIds]),
    kind: 'sim',
    frequencyDefaults: config.frequencyTargetsByLevel,
  });

  const protocolSlots = buildCurriculumSlots({
    athleteUserId: input.athleteUserId,
    sourceDate,
    generatedAt,
    kind: 'protocol',
    existing: existingProtocols,
    picks: protocolPicks,
  });
  const simSlots = buildCurriculumSlots({
    athleteUserId: input.athleteUserId,
    sourceDate,
    generatedAt,
    kind: 'simulation',
    existing: existingSims,
    picks: simPicks,
  });

  if (protocolSlots.length === 0 || simSlots.length === 0) return null;

  const generatorNotes: string[] = [];
  generatorNotes.push(
    `Protocol driving pillar: ${protocolDrivingPillar} (protocol track from ${
      protocolPillarRepCounts.composure
    }/${protocolPillarRepCounts.focus}/${protocolPillarRepCounts.decision} composure/focus/decision).`,
  );
  generatorNotes.push(
    `Sim driving pillar: ${simDrivingPillar} (sim track from ${
      simPillarRepCounts.composure
    }/${simPillarRepCounts.focus}/${simPillarRepCounts.decision} composure/focus/decision).`,
  );
  generatorNotes.push(
    `Combined pillar balance: ${
      pillarRepCounts.composure
    }/${pillarRepCounts.focus}/${pillarRepCounts.decision} composure/focus/decision.`,
  );
  for (const pick of protocolPicks) {
    if (pick.coachOverrideId) {
      generatorNotes.push(`Coach override applied for protocol: ${pick.coachOverrideId}`);
    }
  }
  for (const pick of simPicks) {
    if (pick.coachOverrideId) {
      generatorNotes.push(`Coach override applied for sim: ${pick.coachOverrideId}`);
    }
  }
  if (protocolSlots.length < CURRICULUM_SLOT_TARGET_PER_KIND || simSlots.length < CURRICULUM_SLOT_TARGET_PER_KIND) {
    generatorNotes.push(
      `Curriculum slate is partial: ${protocolSlots.length}/${CURRICULUM_SLOT_TARGET_PER_KIND} protocols and ${simSlots.length}/${CURRICULUM_SLOT_TARGET_PER_KIND} simulations available.`,
    );
  }

  const pairedLabelForSlot = (slots: CurriculumSlotInput[], index: number): string | undefined =>
    slots[index] ? slotLabel(slots[index]) : (slots[0] ? slotLabel(slots[0]) : undefined);

  const protocolSelections = protocolSlots.map((slot, index) => {
    const curriculumIntent = buildSlotIntent({
      slot,
      drivingPillar: protocolDrivingPillar,
      pairedAssignmentLabel: pairedLabelForSlot(simSlots, index),
    });
    return {
      protocolId: slotAssetId(slot),
      protocolLabel: slotLabel(slot),
      cognitivePillar: slotPillar(slot, protocolDrivingPillar),
      progressionLevel: slotProgression(slot),
      drivingPillar: protocolDrivingPillar,
      rationale: slotRationale(slot),
      curriculumIntent,
      coachOverrideApplied: slot.pick?.coachOverrideId,
    };
  });

  const simSelections = simSlots.map((slot, index) => {
    const curriculumIntent = buildSlotIntent({
      slot,
      drivingPillar: simDrivingPillar,
      pairedAssignmentLabel: pairedLabelForSlot(protocolSlots, index),
    });
    return {
      simId: slotAssetId(slot),
      simName: slotLabel(slot),
      cognitivePillar: slotPillar(slot, simDrivingPillar),
      progressionLevel: slotProgression(slot),
      drivingPillar: simDrivingPillar,
      rationale: slotRationale(slot),
      curriculumIntent,
      coachOverrideApplied: slot.pick?.coachOverrideId,
    };
  });

  const protocolSelection = protocolSelections[0];
  const simSelection = simSelections[0];
  if (!protocolSelection || !simSelection) return null;

  const slateId = `${input.athleteUserId}_${sourceDate}_curriculum_slate`;
  const dueAssignmentIds = [
    protocolSlots.find((slot) => slot.slotIndex === 1)?.assignmentId,
    simSlots.find((slot) => slot.slotIndex === 1)?.assignmentId,
  ].filter(Boolean) as string[];
  const queuedAssignmentIds = [...protocolSlots, ...simSlots].map((slot) => slot.assignmentId);

  const result: CurriculumGenerationResult = {
    athleteUserId: input.athleteUserId,
    sourceDate,
    generatedAt,
    curriculumSlateId: slateId,
    protocolSelection,
    protocolSelections,
    simSelection,
    simSelections,
    pillarBalanceAtGeneration: pillarRepCounts,
    dailyAssignmentIdProtocol: protocolSlots[0].assignmentId,
    dailyAssignmentIdSim: simSlots[0].assignmentId,
    dailyAssignmentIdsProtocol: protocolSlots.map((slot) => slot.assignmentId),
    dailyAssignmentIdsSim: simSlots.map((slot) => slot.assignmentId),
    queuedAssignmentIds,
    dueAssignmentIds,
    generatorNotes,
  };

  if (input.preview) return result;

  const traceId = `${input.athleteUserId}_${sourceDate}_${generatedAt}`;
  const assignmentWrites = [...protocolSlots, ...simSlots].map((slot) => {
    const slotMetadata = buildSlotMetadata({ slateId, slot });
    if (slot.existing) {
      return db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(slot.assignmentId).set(
        stripUndefinedDeep({
          id: stringValue(slot.existing.data.id) || slot.assignmentId,
          lineageId: stringValue(slot.existing.data.lineageId) || slot.assignmentId,
          ...slotMetadata,
          updatedAt: generatedAt,
        }) as Record<string, unknown>,
        { merge: true },
      );
    }

    const pick = slot.pick;
    if (!pick) return Promise.resolve();
    const assignmentBase: Partial<PulseCheckDailyAssignment> = {
      id: slot.assignmentId,
      lineageId: slot.assignmentId,
      revision: 1,
      athleteId: input.athleteUserId,
      teamId: input.teamId,
      teamMembershipId: input.teamMembershipId,
      sourceCheckInId: '',
      sourceDate,
      timezone: input.timezone,
      assignedBy: 'curriculum-engine',
      materializedAt: generatedAt,
      status: 'assigned' as PulseCheckDailyAssignment['status'],
      actionType: slot.kind as PulseCheckDailyAssignment['actionType'],
      chosenCandidateId: pick.asset.id,
      chosenCandidateType: (slot.kind === 'protocol' ? 'protocol' : 'sim') as PulseCheckDailyAssignment['chosenCandidateType'],
      rationale: pick.rationale,
      curriculumIntent: buildSlotIntent({
        slot,
        drivingPillar: slot.kind === 'protocol' ? protocolDrivingPillar : simDrivingPillar,
        pairedAssignmentLabel: pairedLabelForSlot(slot.kind === 'protocol' ? simSlots : protocolSlots, slot.slotIndex - 1),
      }),
      createdAt: generatedAt,
      updatedAt: generatedAt,
    };

    if (slot.kind === 'protocol') {
      const protocol = pick.asset as PulseCheckProtocolDefinition;
      assignmentBase.legacyExerciseId = protocol.legacyExerciseId;
      assignmentBase.protocolId = protocol.id;
      assignmentBase.protocolLabel = protocol.label;
      assignmentBase.durationSeconds = protocol.durationSeconds;
    } else {
      const sim = pick.asset as MentalExercise;
      assignmentBase.simSpecId = sim.simSpecId || sim.id;
      assignmentBase.simName = sim.name;
    }

    return db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(slot.assignmentId).set(
      stripUndefinedDeep({
        ...assignmentBase,
        ...slotMetadata,
      }) as Record<string, unknown>,
      { merge: false },
    );
  });

  await Promise.all([
    ...assignmentWrites,
    db.collection(CURRICULUM_SLATES_COLLECTION).doc(slateId).set(
      stripUndefinedDeep({
        id: slateId,
        athleteId: input.athleteUserId,
        teamId: input.teamId,
        teamMembershipId: input.teamMembershipId,
        sourceDate,
        timezone: input.timezone,
        status: 'active',
        generatorVersion: CURRICULUM_GENERATOR_VERSION,
        targetProtocolSlotCount: CURRICULUM_SLOT_TARGET_PER_KIND,
        targetSimulationSlotCount: CURRICULUM_SLOT_TARGET_PER_KIND,
        activeProtocolSlots: protocolSlots.map((slot) => ({
          assignmentId: slot.assignmentId,
          slotIndex: slot.slotIndex,
          assetId: slotAssetId(slot),
          label: slotLabel(slot),
          cognitivePillar: slotPillar(slot, protocolDrivingPillar),
          dueToday: slot.slotIndex === 1,
        })),
        activeSimulationSlots: simSlots.map((slot) => ({
          assignmentId: slot.assignmentId,
          slotIndex: slot.slotIndex,
          assetId: slotAssetId(slot),
          label: slotLabel(slot),
          cognitivePillar: slotPillar(slot, simDrivingPillar),
          dueToday: slot.slotIndex === 1,
        })),
        dueAssignmentIds,
        queuedAssignmentIds,
        generatedAt,
        updatedAt: generatedAt,
      }) as Record<string, unknown>,
      { merge: true },
    ),
    db.collection(GENERATION_TRACES_COLLECTION).doc(traceId).set(
      stripUndefinedDeep({
        id: traceId,
        athleteUserId: input.athleteUserId,
        sourceDate,
        generatedAt,
        result,
        configRevisionId: config.revisionId,
      }) as Record<string, unknown>,
      { merge: false },
    ),
  ]);

  const overrideIds = new Set(
    [...protocolPicks, ...simPicks]
      .map((pick) => pick.coachOverrideId)
      .filter(Boolean) as string[],
  );
  for (const overrideId of overrideIds) {
    try { await markOverrideConsumedAdmin(db, overrideId); } catch { /* swallow */ }
  }

  return result;
};

const fetchLast30DaysCompletionsAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  athleteUserId: string,
  sourceDate: string,
): Promise<CompletionsSnapshot> => {
  const sourceDateMs = Date.UTC(
    parseInt(sourceDate.slice(0, 4), 10),
    parseInt(sourceDate.slice(5, 7), 10) - 1,
    parseInt(sourceDate.slice(8, 10), 10),
  );
  const windowStartMs = sourceDateMs - 30 * 24 * 60 * 60 * 1000;
  const cutoffEpochSec = windowStartMs / 1000;

  let events: Array<Record<string, unknown>> = [];
  let recentAssignments: Array<Record<string, unknown>> = [];
  try {
    const snap = await db
      .collection(ASSIGNMENT_EVENTS_COLLECTION)
      .where('athleteId', '==', athleteUserId)
      .where('eventType', '==', 'completed')
      .where('eventAt', '>=', cutoffEpochSec)
      .orderBy('eventAt', 'desc')
      .limit(200)
      .get();
    events = snap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate missing index in dev */
  }
  try {
    const snap = await db
      .collection(DAILY_ASSIGNMENTS_COLLECTION)
      .where('athleteId', '==', athleteUserId)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    recentAssignments = snap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate missing index in dev */
  }

  const byAssetId = new Map<string, number>();
  const byPillar = emptyPillarCounts();
  const byPillarByKind = {
    protocol: emptyPillarCounts(),
    sim: emptyPillarCounts(),
  };
  const completedAssignmentIdsFromEvents = new Set<string>();

  for (const ev of events) {
    if (typeof ev.assignmentId === 'string' && ev.assignmentId) {
      completedAssignmentIdsFromEvents.add(ev.assignmentId);
    }
    const assetId = eventAssetId(ev);
    if (assetId) byAssetId.set(assetId, (byAssetId.get(assetId) || 0) + 1);
    const pillarFromEvent = eventPillar(ev);
    if (pillarFromEvent && byPillar[pillarFromEvent] !== undefined) {
      byPillar[pillarFromEvent] += 1;
      const kind = eventAssignmentKind(ev);
      if (kind) {
        byPillarByKind[kind][pillarFromEvent] += 1;
      }
    }
  }

  for (const assignment of recentAssignments) {
    const assignmentId = assignment.id as string | undefined;
    const assignmentSourceDate = assignment.sourceDate as string | undefined;
    if (!assignmentId || completedAssignmentIdsFromEvents.has(assignmentId)) continue;
    if (!assignmentSourceDate || assignmentSourceDate < dateKey(new Date(windowStartMs)) || assignmentSourceDate > sourceDate) continue;
    if (!isCompletedAssignmentRecord(assignment)) continue;

    const assetId = eventAssetId(assignment);
    if (assetId) byAssetId.set(assetId, (byAssetId.get(assetId) || 0) + 1);

    const pillarFromAssignment = eventPillar(assignment);
    if (pillarFromAssignment && byPillar[pillarFromAssignment] !== undefined) {
      byPillar[pillarFromAssignment] += 1;
      const kind = eventAssignmentKind(assignment);
      if (kind) {
        byPillarByKind[kind][pillarFromAssignment] += 1;
      }
    }
  }

  const recentlyAssignedIds = (lookbackDays: number): Set<string> => {
    const cutoff = sourceDateMs - lookbackDays * 24 * 60 * 60 * 1000;
    const set = new Set<string>();
    for (const a of recentAssignments) {
      const created = (a.createdAt as number | undefined) ?? 0;
      const createdMs = created > 1e12 ? created : created * 1000;
      if (createdMs >= cutoff) {
        const id = (a.chosenCandidateId as string | undefined) ||
          (a.protocolId as string | undefined) ||
          (a.simSpecId as string | undefined);
        if (id) set.add(id);
      }
    }
    return set;
  };

  return { byAssetId, byPillar, byPillarByKind, recentlyAssignedIds };
};

const fetchEligibleProtocolsAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
): Promise<PulseCheckProtocolDefinition[]> => {
  try {
    const snap = await db
      .collection(PROTOCOLS_COLLECTION)
      .where('publishStatus', '==', 'published')
      .where('isActive', '==', true)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PulseCheckProtocolDefinition);
  } catch {
    return [];
  }
};

const fetchEligibleSimsAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
): Promise<MentalExercise[]> => {
  try {
    const snap = await db.collection(SIM_MODULES_COLLECTION).where('isActive', '==', true).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MentalExercise);
  } catch {
    return [];
  }
};

const listOverridesForAthleteAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  athleteUserId: string,
  yearMonth: string,
): Promise<CurriculumOverride[]> => {
  const snap = await db
    .collection(CURRICULUM_OVERRIDES_COLLECTION)
    .where('athleteUserId', '==', athleteUserId)
    .where('yearMonth', '==', yearMonth)
    .where('status', '==', 'active')
    .get();
  return snap.docs.map((d) => ({ ...(d.data() as CurriculumOverride), id: d.id }));
};

const markOverrideConsumedAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  overrideId: string,
): Promise<void> => {
  await db.collection(CURRICULUM_OVERRIDES_COLLECTION).doc(overrideId).set(
    { status: 'consumed', updatedAt: Date.now() },
    { merge: true },
  );
};

export interface RunCurriculumAssessmentAdminInput {
  athleteUserId: string;
  yearMonth?: string;
  preview?: boolean;
}

const lastMonthUtc = (): string => {
  const now = new Date();
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return yearMonthOf(last);
};

const monthBoundsUtc = (yearMonth: string): { startMs: number; endMs: number; startKey: string; endKey: string } => {
  const [y, m] = yearMonth.split('-').map((s) => parseInt(s, 10));
  const startMs = Date.UTC(y, m - 1, 1);
  const endMs = Date.UTC(y, m, 1) - 1;
  return {
    startMs,
    endMs,
    startKey: dateKey(new Date(startMs)),
    endKey: dateKey(new Date(endMs)),
  };
};

export const runCurriculumAssessmentAdmin = async (
  db: FirebaseAdmin.firestore.Firestore,
  input: RunCurriculumAssessmentAdminInput,
): Promise<CurriculumAssessment | null> => {
  const yearMonth = input.yearMonth || lastMonthUtc();
  const { startMs, endMs, startKey, endKey } = monthBoundsUtc(yearMonth);
  const config = await getOrInitCurriculumConfigAdmin(db);
  const generatedAt = Date.now();

  const startEpochSec = startMs / 1000;
  const endEpochSec = endMs / 1000;

  let events: Array<Record<string, unknown>> = [];
  let assignments: Array<Record<string, unknown>> = [];
  try {
    const snap = await db
      .collection(ASSIGNMENT_EVENTS_COLLECTION)
      .where('athleteId', '==', input.athleteUserId)
      .where('eventAt', '>=', startEpochSec)
      .where('eventAt', '<=', endEpochSec)
      .orderBy('eventAt', 'asc')
      .limit(1000)
      .get();
    events = snap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate missing index in dev */
  }
  try {
    const snap = await db
      .collection(DAILY_ASSIGNMENTS_COLLECTION)
      .where('athleteId', '==', input.athleteUserId)
      .where('sourceDate', '>=', startKey)
      .where('sourceDate', '<=', endKey)
      .orderBy('sourceDate', 'asc')
      .limit(500)
      .get();
    assignments = snap.docs.map((d) => d.data() as Record<string, unknown>);
  } catch {
    /* tolerate */
  }

  const [protocols, sims] = await Promise.all([
    db.collection(PROTOCOLS_COLLECTION).where('isActive', '==', true).get()
      .then((s) => s.docs.map((d) => d.data() as Record<string, unknown>))
      .catch(() => [] as Array<Record<string, unknown>>),
    db.collection(SIM_MODULES_COLLECTION).where('isActive', '==', true).get()
      .then((s) => s.docs.map((d) => d.data() as Record<string, unknown>))
      .catch(() => [] as Array<Record<string, unknown>>),
  ]);
  const protocolById = new Map(protocols.map((p) => [p.id as string, p]));
  const simById = new Map(sims.map((s) => [s.id as string, s]));

  const completedByAssetId = new Map<string, number>();
  let completedCount = 0;
  const assignedCount = assignments.length;
  for (const ev of events) {
    if (ev.eventType !== 'completed') continue;
    completedCount += 1;
    const assetId =
      (ev.chosenCandidateId as string | undefined) ||
      (ev.protocolId as string | undefined) ||
      (ev.simSpecId as string | undefined);
    if (assetId) completedByAssetId.set(assetId, (completedByAssetId.get(assetId) || 0) + 1);
  }

  const repsByPillar: Record<TaxonomyPillar, number> = {
    [TaxonomyPillar.Composure]: 0,
    [TaxonomyPillar.Focus]: 0,
    [TaxonomyPillar.Decision]: 0,
  };
  const protocolRepCounts: CurriculumAssessment['protocolRepCounts'] = [];
  const simRepCounts: CurriculumAssessment['simRepCounts'] = [];

  const resolvePillar = (asset: Record<string, unknown>): TaxonomyPillar | undefined => {
    const cog = asset.cognitivePillar as TaxonomyPillar | undefined;
    if (cog) return cog;
    const tax = asset.taxonomy as { primaryPillar?: TaxonomyPillar } | undefined;
    return tax?.primaryPillar;
  };
  const resolveProgression = (asset: Record<string, unknown>): ProgressionLevel =>
    (asset.progressionLevel as ProgressionLevel | undefined) || 'foundational';

  for (const [assetId, reps] of completedByAssetId.entries()) {
    if (protocolById.has(assetId)) {
      const p = protocolById.get(assetId)!;
      const pillar = resolvePillar(p);
      const progression = resolveProgression(p);
      const recommended = resolveFrequency(
        {
          recommendedFrequencyPer30Days: p.recommendedFrequencyPer30Days as number | undefined,
          progressionLevel: progression,
        },
        config.frequencyTargetsByLevel,
      );
      if (pillar) repsByPillar[pillar] += reps;
      protocolRepCounts.push({
        protocolId: assetId,
        protocolLabel: (p.label as string) || assetId,
        cognitivePillar: pillar || TaxonomyPillar.Composure,
        progressionLevel: progression,
        recommendedFrequencyPer30Days: recommended,
        actualReps: reps,
        gap: recommended - reps,
      });
    } else if (simById.has(assetId)) {
      const s = simById.get(assetId)!;
      const pillar = resolvePillar(s);
      const progression = resolveProgression(s);
      const recommended = resolveFrequency(
        {
          recommendedFrequencyPer30Days: s.recommendedFrequencyPer30Days as number | undefined,
          progressionLevel: progression,
        },
        config.frequencyTargetsByLevel,
      );
      if (pillar) repsByPillar[pillar] += reps;
      simRepCounts.push({
        simId: assetId,
        simName: (s.name as string) || assetId,
        cognitivePillar: pillar || TaxonomyPillar.Focus,
        progressionLevel: progression,
        recommendedFrequencyPer30Days: recommended,
        actualReps: reps,
        gap: recommended - reps,
      });
    }
  }

  const baseTarget = config.frequencyTargetsByLevel.foundational;
  const totalWeight =
    config.defaultPillarWeights.composure +
    config.defaultPillarWeights.focus +
    config.defaultPillarWeights.decision;
  const norm = (v: number) => (totalWeight > 0 ? v / totalWeight : 1 / 3);
  const targetByPillar: Record<TaxonomyPillar, number> = {
    [TaxonomyPillar.Composure]: norm(config.defaultPillarWeights.composure) * baseTarget * 3,
    [TaxonomyPillar.Focus]: norm(config.defaultPillarWeights.focus) * baseTarget * 3,
    [TaxonomyPillar.Decision]: norm(config.defaultPillarWeights.decision) * baseTarget * 3,
  };
  const gapByPillar: Record<TaxonomyPillar, number> = {
    [TaxonomyPillar.Composure]: targetByPillar[TaxonomyPillar.Composure] - repsByPillar[TaxonomyPillar.Composure],
    [TaxonomyPillar.Focus]: targetByPillar[TaxonomyPillar.Focus] - repsByPillar[TaxonomyPillar.Focus],
    [TaxonomyPillar.Decision]: targetByPillar[TaxonomyPillar.Decision] - repsByPillar[TaxonomyPillar.Decision],
  };
  const ranked = (Object.entries(gapByPillar) as Array<[TaxonomyPillar, number]>).sort((a, b) => b[1] - a[1]);
  const worstGapPillar = ranked[0][0];

  const completedDayKeys = new Set<string>();
  for (const ev of events) {
    if (ev.eventType !== 'completed') continue;
    const evAt = ev.eventAt as number | undefined;
    if (!evAt) continue;
    const ms = evAt > 1e12 ? evAt : evAt * 1000;
    completedDayKeys.add(dateKey(new Date(ms)));
  }
  let longestStreak = 0;
  let currentStreak = 0;
  for (let ms = startMs; ms <= endMs; ms += 24 * 60 * 60 * 1000) {
    const k = dateKey(new Date(ms));
    if (completedDayKeys.has(k)) {
      currentStreak += 1;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  const adherenceRate = assignedCount > 0 ? completedCount / assignedCount : 0;
  const reviewerNote = buildReviewerNote(
    repsByPillar,
    targetByPillar,
    gapByPillar,
    worstGapPillar,
    adherenceRate,
    longestStreak,
  );

  const id = `${input.athleteUserId}_${yearMonth}`;
  const assessment: CurriculumAssessment = {
    id,
    athleteUserId: input.athleteUserId,
    yearMonth,
    windowStart: startKey,
    windowEnd: endKey,
    repsByPillar,
    targetByPillar,
    gapByPillar,
    worstGapPillar,
    protocolRepCounts: protocolRepCounts.sort((a, b) => b.gap - a.gap),
    simRepCounts: simRepCounts.sort((a, b) => b.gap - a.gap),
    totalAssignmentsAssigned: assignedCount,
    totalAssignmentsCompleted: completedCount,
    adherenceRate,
    longestStreakDays: longestStreak,
    reviewerNote,
    generatedAt,
    generatorRevision: config.revisionId,
  };

  if (input.preview) return assessment;

  await db.collection(CURRICULUM_ASSESSMENTS_COLLECTION).doc(id).set(
    stripUndefinedDeep(assessment) as Record<string, unknown>,
    { merge: false },
  );
  return assessment;
};

const buildReviewerNote = (
  reps: Record<TaxonomyPillar, number>,
  targets: Record<TaxonomyPillar, number>,
  gaps: Record<TaxonomyPillar, number>,
  worstGapPillar: TaxonomyPillar,
  adherenceRate: number,
  longestStreak: number,
): string => {
  const adhPct = Math.round(adherenceRate * 100);
  const round = (v: number) => Math.round(v);
  const worstGap = Math.round(gaps[worstGapPillar]);
  const lines: string[] = [];
  lines.push(
    `Adherence ${adhPct}% (${longestStreak}-day streak). Pillar reps: composure ${
      round(reps[TaxonomyPillar.Composure])
    }/${round(targets[TaxonomyPillar.Composure])}, focus ${round(reps[TaxonomyPillar.Focus])}/${
      round(targets[TaxonomyPillar.Focus])
    }, decision ${round(reps[TaxonomyPillar.Decision])}/${round(targets[TaxonomyPillar.Decision])}.`,
  );
  if (worstGap > 0) {
    lines.push(
      `Most-underrepped pillar: ${worstGapPillar} (${worstGap} reps short). Engine will bias next month toward ${worstGapPillar}.`,
    );
  } else {
    lines.push(`All pillars at or above target this month.`);
  }
  return lines.join(' ');
};
