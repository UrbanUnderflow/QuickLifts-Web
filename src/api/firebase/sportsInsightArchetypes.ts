// =============================================================================
// Sports insight archetypes — the biometric axis of the sports intelligence
// layer: "how do recovery signals weight into readiness for this sport?"
// (endurance: HRV-leaning · strength: sleep-leaning · mental: sleep-heavy ·
// general: balanced).
//
// This is the CANONICAL catalog-first mapping. The Swift mirror is
// SportsInsightArchetype.catalogInsightDefaults / resolve(sport:catalog:) in
// PulseCheck/Services/SportsIntelligenceReasoningLayer.swift — keep the by-id
// map in sync (CI-checked by tests/unit/sport-catalog-coverage.test.ts).
//
// Resolution contract (same as the scenario axis in
// mentaltraining/sportScenarioArchetypes.ts): catalog entry match by
// name/id/position → entry's explicit `insightArchetype` → this code-owned
// by-id map → keyword fallback for free-text sports only.
//
// Spec: PulseCheck/docs/specs/sport-scenario-packs-spec.md §3 (catalog-first)
// =============================================================================

export type SportsInsightArchetype = 'endurance' | 'strength' | 'mental' | 'general';

export const SPORTS_INSIGHT_ARCHETYPE_LABELS: Record<SportsInsightArchetype, string> = {
  endurance: 'Endurance-weighted readiness',
  strength: 'Strength-weighted readiness',
  mental: 'Focus-weighted readiness',
  general: 'Balanced readiness',
};

// Code-owned defaults per catalog sport id. Deliberate upgrades over the old
// keyword behavior: volleyball, track & field, wrestling, gymnastics, and
// bowling all silently fell to 'general' under keywords.
export const SPORT_INSIGHT_ARCHETYPE_BY_SPORT_ID: Record<string, SportsInsightArchetype> = {
  basketball: 'endurance',
  soccer: 'endurance',
  football: 'endurance',
  baseball: 'general',
  softball: 'general',
  volleyball: 'endurance',
  tennis: 'endurance',
  swimming: 'endurance',
  'track-field': 'endurance',
  wrestling: 'strength',
  crossfit: 'strength',
  golf: 'mental',
  bowling: 'mental',
  lacrosse: 'endurance',
  hockey: 'endurance',
  gymnastics: 'strength',
  'bodybuilding-physique': 'strength',
  other: 'general',
};

/** Keyword fallback for free-text sports. Mirror of the Swift
 *  SportsInsightArchetype.from(sport:) lists — keep in sync. */
export function insightArchetypeForSport(sport: string | null | undefined): SportsInsightArchetype {
  const trimmed = (sport ?? '').trim().toLowerCase();
  if (!trimmed) return 'general';
  const strengthKeys = ['physique', 'bodybuild', 'powerlift', 'weightlift', 'strength', 'crossfit', 'olympic lift', 'throw', 'shot put', 'discus', 'hammer'];
  const enduranceKeys = ['run', 'cycl', 'bik', 'swim', 'triathlon', 'row', 'marathon', 'distance', 'walk', 'hike', 'soccer', 'football', 'basketball', 'lacrosse', 'rugby', 'hockey', 'tennis'];
  const mentalKeys = ['esport', 'chess', 'shoot', 'archery', 'racing', 'race car', 'f1', 'poker', 'golf', 'darts'];
  if (strengthKeys.some((key) => trimmed.includes(key))) return 'strength';
  if (enduranceKeys.some((key) => trimmed.includes(key))) return 'endurance';
  if (mentalKeys.some((key) => trimmed.includes(key))) return 'mental';
  return 'general';
}

type CatalogSportLike = {
  id: string;
  name: string;
  positions?: string[];
  insightArchetype?: string;
};

const VALID = new Set<string>(Object.keys(SPORTS_INSIGHT_ARCHETYPE_LABELS));
const canon = (value: string) => value.trim().toLowerCase().replace(/[‘’]/g, "'");

/** Catalog-first resolution of the biometric insight archetype. */
export function resolveInsightArchetype(
  sport: string | null | undefined,
  catalog: CatalogSportLike[] | null | undefined,
): SportsInsightArchetype {
  const target = canon(sport ?? '');
  if (!target) return 'general';

  const entry = (catalog ?? []).find((candidate) =>
    canon(candidate.name) === target
    || canon(candidate.id) === target
    || (candidate.positions ?? []).some((position) => canon(position) === target));

  if (entry) {
    const explicit = canon(entry.insightArchetype ?? '');
    if (VALID.has(explicit)) return explicit as SportsInsightArchetype;
    const mapped = SPORT_INSIGHT_ARCHETYPE_BY_SPORT_ID[entry.id];
    if (mapped) return mapped;
    return insightArchetypeForSport(entry.name);
  }

  return insightArchetypeForSport(sport);
}
