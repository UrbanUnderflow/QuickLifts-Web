import type {
  MentalExercise,
  PulseCheckProtocolDefinition,
} from '../mentaltraining/types';
import { TaxonomyPillar } from '../mentaltraining/taxonomy';
import {
  CurriculumOverride,
  PillarWeights,
  ProgressionLevel,
  normalizePillarWeights,
  resolveFrequency,
  yearMonthOf,
} from './types';

export interface AssetCandidate {
  asset: PulseCheckProtocolDefinition | MentalExercise;
  cognitivePillar: TaxonomyPillar;
  progressionLevel: ProgressionLevel;
  recommendedFrequency: number;
  actualReps: number;
  ratio: number;
  rationale: string;
  coachOverrideId?: string;
}

export interface CompletionsSnapshot {
  /** Map of asset id to number of completions in last 30 days. */
  byAssetId: Map<string, number>;
  /** Pillar rep totals from completions. */
  byPillar: Record<TaxonomyPillar, number>;
  /** Pillar rep totals split by track so protocol work does not satisfy sim work, or vice versa. */
  byPillarByKind?: {
    protocol: Record<TaxonomyPillar, number>;
    sim: Record<TaxonomyPillar, number>;
  };
  /** Asset ids assigned in the last N days, used for variety filter. */
  recentlyAssignedIds: (lookbackDays: number) => Set<string>;
}

export interface PickContext {
  pool: Array<PulseCheckProtocolDefinition | MentalExercise>;
  drivingPillar: TaxonomyPillar;
  completions: CompletionsSnapshot;
  overrides: CurriculumOverride[];
  recentlyAssigned: Set<string>;
  kind: 'protocol' | 'sim';
  frequencyDefaults: Record<ProgressionLevel, number>;
}

export const assetPillar = (asset: PulseCheckProtocolDefinition | MentalExercise): TaxonomyPillar | undefined => {
  if ('cognitivePillar' in asset && asset.cognitivePillar) return asset.cognitivePillar;
  const tax = (asset as MentalExercise).taxonomy;
  if (tax && tax.primaryPillar) return tax.primaryPillar;
  const category = (asset as { category?: string }).category?.toLowerCase();
  if (category === 'breathing' || category === 'confidence') return TaxonomyPillar.Composure;
  if (category === 'focus' || category === 'visualization') return TaxonomyPillar.Focus;
  if (category === 'mindset') return TaxonomyPillar.Decision;
  return undefined;
};

export const assetProgression = (asset: PulseCheckProtocolDefinition | MentalExercise): ProgressionLevel => {
  if ('progressionLevel' in asset && asset.progressionLevel) {
    return asset.progressionLevel as ProgressionLevel;
  }
  return 'foundational';
};

export const assetPrerequisites = (
  asset: PulseCheckProtocolDefinition | MentalExercise,
): Partial<Record<TaxonomyPillar, number>> => {
  return ('prerequisitePillarReps' in asset && asset.prerequisitePillarReps) || {};
};

export const countRepsByPillar = (
  snap: CompletionsSnapshot,
  _protocols: PulseCheckProtocolDefinition[],
  _sims: MentalExercise[],
): Record<TaxonomyPillar, number> => {
  // For Phase I, byPillar from event payload is the authoritative count.
  // Future enrichment can join event candidate ids back to asset metadata.
  return { ...snap.byPillar };
};

export const pickWorstGapPillar = (
  reps: Record<TaxonomyPillar, number>,
  weights: PillarWeights,
  frequencyDefaults: Record<ProgressionLevel, number>,
  _protocols: PulseCheckProtocolDefinition[],
): TaxonomyPillar => {
  const normalized = normalizePillarWeights(weights);
  const baseTarget = frequencyDefaults.foundational * 1.0;
  const targets: Record<TaxonomyPillar, number> = {
    [TaxonomyPillar.Composure]: normalized.composure * baseTarget * 3,
    [TaxonomyPillar.Focus]: normalized.focus * baseTarget * 3,
    [TaxonomyPillar.Decision]: normalized.decision * baseTarget * 3,
  };
  const gaps: Record<TaxonomyPillar, number> = {
    [TaxonomyPillar.Composure]: targets[TaxonomyPillar.Composure] - reps[TaxonomyPillar.Composure],
    [TaxonomyPillar.Focus]: targets[TaxonomyPillar.Focus] - reps[TaxonomyPillar.Focus],
    [TaxonomyPillar.Decision]: targets[TaxonomyPillar.Decision] - reps[TaxonomyPillar.Decision],
  };
  const ranked = (Object.entries(gaps) as Array<[TaxonomyPillar, number]>).sort((a, b) => b[1] - a[1]);
  return ranked[0][0];
};

export const pickAsset = (ctx: PickContext): AssetCandidate | null => {
  const overrideTypePin = ctx.kind === 'protocol' ? 'pin-protocol' : 'pin-simulation';
  const overrideTypeExcl = ctx.kind === 'protocol' ? 'exclude-protocol' : 'exclude-simulation';

  const excludedIds = new Set(
    ctx.overrides.filter((o) => o.overrideType === overrideTypeExcl).map((o) => o.targetId),
  );
  const pinned = ctx.overrides.filter((o) => o.overrideType === overrideTypePin);

  const candidates: AssetCandidate[] = [];
  for (const asset of ctx.pool) {
    if (excludedIds.has(asset.id)) continue;
    const pillar = assetPillar(asset);
    if (!pillar) continue;
    const progression = assetProgression(asset);
    if (progression !== 'foundational') {
      const prereqs = assetPrerequisites(asset);
      let prereqMet = true;
      for (const [pillarKey, requiredReps] of Object.entries(prereqs) as Array<[TaxonomyPillar, number]>) {
        const have = ctx.completions.byPillar[pillarKey] || 0;
        if (have < requiredReps) {
          prereqMet = false;
          break;
        }
      }
      if (!prereqMet) continue;
    }
    if (ctx.recentlyAssigned.has(asset.id)) continue;

    const recommendedFrequency = resolveFrequency(
      {
        recommendedFrequencyPer30Days:
          'recommendedFrequencyPer30Days' in asset ? asset.recommendedFrequencyPer30Days : undefined,
        progressionLevel: progression,
      },
      ctx.frequencyDefaults,
    );
    const actualReps = ctx.completions.byAssetId.get(asset.id) || 0;
    const ratio = recommendedFrequency > 0 ? actualReps / recommendedFrequency : 0;
    candidates.push({
      asset,
      cognitivePillar: pillar,
      progressionLevel: progression,
      recommendedFrequency,
      actualReps,
      ratio,
      rationale: '',
    });
  }

  let pool = candidates.filter((c) => c.cognitivePillar === ctx.drivingPillar);
  if (pool.length === 0) pool = candidates;
  if (pool.length === 0) return null;

  const pinnedInPool = pool.find((c) => pinned.some((p) => p.targetId === c.asset.id));
  if (pinnedInPool) {
    const ovr = pinned.find((p) => p.targetId === pinnedInPool.asset.id);
    pinnedInPool.coachOverrideId = ovr?.id;
    pinnedInPool.rationale = `Coach pinned for ${yearMonthOf(new Date())}; reinforces ${pinnedInPool.cognitivePillar} pillar.`;
    return pinnedInPool;
  }

  pool.sort((a, b) => {
    if (a.ratio !== b.ratio) return a.ratio - b.ratio;
    const order = { foundational: 0, intermediate: 1, advanced: 2 };
    return order[a.progressionLevel] - order[b.progressionLevel];
  });
  const chosen = pool[0];
  chosen.rationale = `Today's ${chosen.cognitivePillar} pillar is most-underrepped; selected ${
    chosen.progressionLevel
  } ${ctx.kind} (${chosen.actualReps}/${chosen.recommendedFrequency} target reps in 30d).`;
  return chosen;
};
