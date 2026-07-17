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
  precision: 'Precision & target sports',
  combat: 'Combat sports',
  attempt: 'Attempt sports',
  general: 'All sports',
};

// Order matters: first archetype whose keys hit wins.
const SCENARIO_ARCHETYPE_KEYS: Array<[SportScenarioArchetype, string[]]> = [
  ['judged', ['gymnast', 'diving', 'dive', 'figure skat', 'cheer', 'dance']],
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
