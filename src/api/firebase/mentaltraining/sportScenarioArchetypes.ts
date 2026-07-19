// =============================================================================
// Sport scenario archetypes — the "what does adversity look like in this
// sport?" axis of the sports intelligence layer.
//
// This is the CANONICAL sport-string → scenario-archetype mapping. The Swift
// mirror lives beside SportsInsightArchetype in
// PulseCheck/Services/SportsIntelligenceReasoningLayer.swift and must stay in
// keyword-for-keyword sync (same lists, same order) so web previews and the
// iOS player resolve the same pack for the same athlete.
//
// Matching notes:
// - Archetypes are checked in declaration order; the first list with a hit
//   wins. Collisions are resolved by putting the more specific phrase in the
//   earlier archetype ("figure skat" under judged beats the bare "skat" that
//   speed skating relies on under race — so race lists "speed skat" and
//   "skat" is never used alone).
// - Keys are lowercase substrings of the athlete's free-text sport, same
//   technique as SportsInsightArchetype.from(sport:).
//
// Follow-up (spec §3): pulsecheckSportConfig.ts entries may later carry an
// explicit scenarioArchetype so the admin sport catalog overrides keywords.
//
// Spec: PulseCheck/docs/specs/sport-scenario-packs-spec.md
// =============================================================================

import type { SportScenarioArchetype } from './types';

export const SPORT_SCENARIO_ARCHETYPE_LABELS: Record<SportScenarioArchetype, string> = {
  invasion: 'Field & court team sports',
  net_racket: 'Net & racket sports',
  race: 'Races against the clock',
  judged: 'Judged sports',
  stage: 'Stage & physique sports',
  precision: 'Precision & target sports',
  combat: 'Combat sports',
  attempt: 'Attempt sports',
  general: 'All sports',
};

// Order matters: first archetype whose keys hit wins.
const SCENARIO_ARCHETYPE_KEYS: Array<[SportScenarioArchetype, string[]]> = [
  ['judged', ['gymnast', 'diving', 'dive', 'figure skat', 'cheer', 'dance']],
  // stage after judged: "figure skating" must land on judged via "figure
  // skat" before the physique "figure" division key can see it.
  ['stage', ['physique', 'bodybuild', 'bikini', 'figure', 'posing', 'wellness division', 'classic physique']],
  ['net_racket', ['tennis', 'volleyball', 'badminton', 'pickleball', 'squash', 'racquetball', 'padel', 'ping pong']],
  // attempt before race: "throwing" contains "rowing", and attempt keys are
  // the more specific phrases ("shot put", "pole vault") anyway.
  ['attempt', ['powerlift', 'weightlift', 'olympic lift', 'shot put', 'discus', 'hammer', 'javelin', 'long jump', 'high jump', 'triple jump', 'pole vault', 'throw', 'climb']],
  ['race', ['run', 'sprint', 'marathon', 'track', 'cross country', 'swim', 'cycl', 'bik', 'rowing', 'crew', 'scull', 'triathlon', 'distance', 'speed skat']],
  ['invasion', ['soccer', 'football', 'basketball', 'lacrosse', 'rugby', 'hockey', 'handball', 'water polo', 'netball', 'ultimate', 'frisbee']],
  ['precision', ['golf', 'archery', 'shoot', 'darts', 'bowling', 'billiards', 'pool']],
  ['combat', ['wrestl', 'box', 'judo', 'jiu', 'bjj', 'mma', 'karate', 'taekwondo', 'fenc', 'muay', 'martial']],
];

/** Map an athlete's free-text sport to a scenario archetype. Unmatched or
 *  empty sports resolve to 'general' (base content, unchanged experience). */
export function scenarioArchetypeForSport(sport: string | null | undefined): SportScenarioArchetype {
  const trimmed = (sport ?? '').trim().toLowerCase();
  if (!trimmed) return 'general';
  for (const [archetype, keys] of SCENARIO_ARCHETYPE_KEYS) {
    if (keys.some((key) => trimmed.includes(key))) return archetype;
  }
  return 'general';
}

// ── Catalog-first resolution ────────────────────────────────────────────────
// The Sports Intelligence lookup table (company-config/pulsecheck-sports,
// pulsecheckSportConfig.ts) is the source of truth for known sports. Keyword
// matching above is the FALLBACK for free-text/legacy sports only.

/** Code-owned scenario archetype per catalog sport id. Same review posture as
 *  report policy / load model: edited through code, not the admin UI. A
 *  Firestore entry's explicit `scenarioArchetype` (if present) wins over this
 *  map. Swift mirror: catalogScenarioDefaults in
 *  SportsIntelligenceReasoningLayer.swift — keep in sync. */
export const SPORT_SCENARIO_ARCHETYPE_BY_SPORT_ID: Record<string, SportScenarioArchetype> = {
  basketball: 'invasion',
  soccer: 'invasion',
  football: 'invasion',
  // Baseball/softball ride invasion for now (next-play recovery window);
  // a dedicated diamond pack (umpire, at-bat language) is a follow-up.
  baseball: 'invasion',
  softball: 'invasion',
  volleyball: 'net_racket',
  tennis: 'net_racket',
  swimming: 'race',
  'track-field': 'race',
  wrestling: 'combat',
  // Competition CrossFit is raced in timed heats; race language fits best.
  crossfit: 'race',
  golf: 'precision',
  bowling: 'precision',
  lacrosse: 'invasion',
  hockey: 'invasion',
  gymnastics: 'judged',
  'bodybuilding-physique': 'stage',
  other: 'general',
};

type CatalogSportLike = {
  id: string;
  name: string;
  positions?: string[];
  scenarioArchetype?: string;
};

const VALID_ARCHETYPES = new Set<string>(Object.keys(SPORT_SCENARIO_ARCHETYPE_LABELS));

const canon = (value: string) => value.trim().toLowerCase().replace(/[‘’]/g, "'");

/** Resolve an athlete's sport to a scenario archetype, catalog-first:
 *  1. Match the sport string against catalog entries by name, id, or position
 *     (positions matter: athletes often carry a division like "Men's physique"
 *     whose catalog sport is "Bodybuilding / Physique").
 *  2. A matched entry resolves via its explicit `scenarioArchetype`, then the
 *     code-owned by-id map, then keywords on the entry name.
 *  3. No catalog match: keyword matching on the raw sport string. */
export function resolveScenarioArchetype(
  sport: string | null | undefined,
  catalog: CatalogSportLike[] | null | undefined,
): SportScenarioArchetype {
  const target = canon(sport ?? '');
  if (!target) return 'general';

  const entry = (catalog ?? []).find((candidate) =>
    canon(candidate.name) === target
    || canon(candidate.id) === target
    || (candidate.positions ?? []).some((position) => canon(position) === target));

  if (entry) {
    const explicit = canon(entry.scenarioArchetype ?? '');
    if (VALID_ARCHETYPES.has(explicit)) return explicit as SportScenarioArchetype;
    const mapped = SPORT_SCENARIO_ARCHETYPE_BY_SPORT_ID[entry.id];
    if (mapped) return mapped;
    return scenarioArchetypeForSport(entry.name);
  }

  return scenarioArchetypeForSport(sport);
}
