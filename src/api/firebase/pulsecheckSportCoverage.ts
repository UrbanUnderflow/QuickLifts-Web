// =============================================================================
// Sports Intelligence catalog coverage report
//
// The catalog (company-config/pulsecheck-sports, pulsecheckSportConfig.ts) is
// the central configuration for sports across the product surface. This module
// answers one question per sport: "which attached configurations exist, and
// which are missing?" — so adding a sport surfaces every gap instead of
// shipping partial support silently.
//
// Consumed by:
// - tests/unit/sport-catalog-coverage.test.ts (CI gate: strict invariants)
// - admin surfaces that want per-sport coverage badges
//
// Spec: PulseCheck/docs/specs/sport-scenario-packs-spec.md §3 (catalog-first)
// =============================================================================

import type { PulseCheckSportConfigurationEntry } from './pulsecheckSportConfig';
import { getDefaultPulseCheckSports } from './pulsecheckSportConfig';
import {
  SPORT_SCENARIO_ARCHETYPE_BY_SPORT_ID,
  SPORT_SCENARIO_ARCHETYPE_LABELS,
  scenarioArchetypeForSport,
} from './mentaltraining/sportScenarioArchetypes';
import type { SportScenarioArchetype } from './mentaltraining/types';
import {
  SPORT_INSIGHT_ARCHETYPE_BY_SPORT_ID,
  SPORTS_INSIGHT_ARCHETYPE_LABELS,
  insightArchetypeForSport,
  type SportsInsightArchetype,
} from './sportsInsightArchetypes';

export type SportCoverageRow = {
  id: string;
  name: string;
  /** Resolved scenario archetype, and how it resolved. `source: 'none'` means
   *  the sport would silently fall to keyword matching — a coverage gap. */
  scenarioArchetype: SportScenarioArchetype | null;
  scenarioSource: 'explicit' | 'code-owned-map' | 'keywords' | 'none';
  /** Biometric readiness-weighting archetype coverage, same source semantics. */
  insightArchetype: SportsInsightArchetype | null;
  insightSource: 'explicit' | 'code-owned-map' | 'keywords' | 'none';
  hasPositions: boolean;
  hasPrompting: boolean;
  hasReportPolicy: boolean;
  hasLoadModel: boolean;
  hasTrainingNuance: boolean;
  /** Human-readable list of missing attachments (empty = fully covered). */
  gaps: string[];
};

const VALID_ARCHETYPES = new Set<string>(Object.keys(SPORT_SCENARIO_ARCHETYPE_LABELS));

export function buildSportCoverageReport(
  sports: PulseCheckSportConfigurationEntry[] = getDefaultPulseCheckSports(),
): SportCoverageRow[] {
  return sports.map((sport) => {
    let scenarioArchetype: SportScenarioArchetype | null = null;
    let scenarioSource: SportCoverageRow['scenarioSource'] = 'none';

    const explicit = (sport.scenarioArchetype ?? '').trim().toLowerCase();
    if (VALID_ARCHETYPES.has(explicit)) {
      scenarioArchetype = explicit as SportScenarioArchetype;
      scenarioSource = 'explicit';
    } else if (SPORT_SCENARIO_ARCHETYPE_BY_SPORT_ID[sport.id]) {
      scenarioArchetype = SPORT_SCENARIO_ARCHETYPE_BY_SPORT_ID[sport.id];
      scenarioSource = 'code-owned-map';
    } else {
      const keyworded = scenarioArchetypeForSport(sport.name);
      if (keyworded !== 'general') {
        scenarioArchetype = keyworded;
        scenarioSource = 'keywords';
      }
    }

    let insightArchetype: SportsInsightArchetype | null = null;
    let insightSource: SportCoverageRow['insightSource'] = 'none';

    const explicitInsight = (sport.insightArchetype ?? '').trim().toLowerCase();
    if ((Object.keys(SPORTS_INSIGHT_ARCHETYPE_LABELS) as string[]).includes(explicitInsight)) {
      insightArchetype = explicitInsight as SportsInsightArchetype;
      insightSource = 'explicit';
    } else if (SPORT_INSIGHT_ARCHETYPE_BY_SPORT_ID[sport.id]) {
      insightArchetype = SPORT_INSIGHT_ARCHETYPE_BY_SPORT_ID[sport.id];
      insightSource = 'code-owned-map';
    } else {
      const keyworded = insightArchetypeForSport(sport.name);
      if (keyworded !== 'general') {
        insightArchetype = keyworded;
        insightSource = 'keywords';
      }
    }

    const hasPositions = (sport.positions ?? []).length > 0;
    const prompting = sport.prompting;
    const hasPrompting = Boolean(
      prompting && (prompting.noraContext?.trim() || prompting.macraNutritionContext?.trim()),
    );
    const hasReportPolicy = Boolean(sport.reportPolicy);
    const hasLoadModel = Boolean(sport.reportPolicy?.loadModel);
    const hasTrainingNuance = Boolean(sport.trainingNuance);

    const gaps: string[] = [];
    if (scenarioSource === 'none') gaps.push('scenario archetype (packs fall back to generic content)');
    if (scenarioSource === 'keywords') gaps.push('scenario archetype relies on keyword matching (add to code-owned map)');
    if (insightSource === 'none') gaps.push('insight archetype (readiness weighting falls to general)');
    if (insightSource === 'keywords') gaps.push('insight archetype relies on keyword matching (add to code-owned map)');
    if (!hasPositions) gaps.push('positions');
    if (!hasPrompting) gaps.push('prompting (Nora/Macra context)');
    if (!hasReportPolicy) gaps.push('report policy');
    if (!hasLoadModel) gaps.push('load model');
    if (!hasTrainingNuance) gaps.push('training nuance');

    return {
      id: sport.id,
      name: sport.name,
      scenarioArchetype,
      scenarioSource,
      insightArchetype,
      insightSource,
      hasPositions,
      hasPrompting,
      hasReportPolicy,
      hasLoadModel,
      hasTrainingNuance,
      gaps,
    };
  });
}
