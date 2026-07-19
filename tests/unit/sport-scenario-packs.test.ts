import test from 'node:test';
import assert from 'node:assert/strict';

// Sport scenario packs (spec: PulseCheck/docs/specs/sport-scenario-packs-spec.md):
// the archetype mapper, the seeded adversity module's packs, and the narration
// enumeration that keeps every pack line pre-generatable. The mapper cases
// double as the sync contract for the Swift mirror in
// SportsIntelligenceReasoningLayer.swift — if a case changes here, change it there.

const installFirebaseEnv = () => {
  const required = {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quicklifts-test',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'quicklifts-test.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:test',
  };
  for (const [key, value] of Object.entries(required)) {
    process.env[key] ||= value;
  }
};

const loadModules = async () => {
  installFirebaseEnv();
  const [archetypes, library, narration] = await Promise.all([
    import('../../src/api/firebase/mentaltraining/sportScenarioArchetypes'),
    import('../../src/api/firebase/mentaltraining/exerciseLibraryService'),
    import('../../src/api/firebase/mentaltraining/moduleNarrationScripts'),
  ]);
  return { archetypes, library, narration };
};

const ADVERSITY_ID = 'viz-adversity-response';

// ──────────────────────────────────────────────────────────────────────────────
// Archetype mapper
// ──────────────────────────────────────────────────────────────────────────────

test('scenarioArchetypeForSport — maps representative sports', async () => {
  const { archetypes } = await loadModules();
  const cases: Array<[string | null, string]> = [
    ['soccer', 'invasion'],
    ['flag football', 'invasion'],
    ['Womens Basketball', 'invasion'],
    ['tennis', 'net_racket'],
    ['volleyball', 'net_racket'],
    ['Swimming', 'race'],
    ['Track & Field', 'race'],
    ['rowing', 'race'],
    ['speed skating', 'race'],
    ['gymnastics', 'judged'],
    ['figure skating', 'judged'],
    ["Men's physique", 'stage'],
    ['bodybuilding', 'stage'],
    ['bikini', 'stage'],
    ['Figure', 'stage'],
    ['golf', 'precision'],
    ['archery', 'precision'],
    ['wrestling', 'combat'],
    ['boxing', 'combat'],
    ['powerlifting', 'attempt'],
    ['shot put', 'attempt'],
    ['throwing', 'attempt'],
    ['rock climbing', 'attempt'],
    ['esports', 'general'],
    ['chess', 'general'],
    ['', 'general'],
    [null, 'general'],
  ];
  for (const [sport, want] of cases) {
    assert.equal(
      archetypes.scenarioArchetypeForSport(sport),
      want,
      `sport "${sport}" should map to ${want}`,
    );
  }
});

test('scenarioArchetypeForSport — substring traps stay resolved', async () => {
  const { archetypes } = await loadModules();
  // "throwing" contains "rowing": attempt must be checked before race.
  assert.equal(archetypes.scenarioArchetypeForSport('throwing'), 'attempt');
  // "figure skat" (judged) must beat race's "speed skat" bucket.
  assert.equal(archetypes.scenarioArchetypeForSport('figure skater'), 'judged');
  // "figure skating" must hit judged before stage's bare "figure" division key.
  assert.equal(archetypes.scenarioArchetypeForSport('figure skating'), 'judged');
});

// ──────────────────────────────────────────────────────────────────────────────
// Catalog-first resolution (Sports Intelligence lookup table)
// ──────────────────────────────────────────────────────────────────────────────

const TEST_CATALOG = [
  {
    id: 'bodybuilding-physique',
    name: 'Bodybuilding / Physique',
    // Curly apostrophe on purpose: mirrors the seeded catalog data.
    positions: ['Men’s Physique', 'Classic Physique', 'Bodybuilding', 'Bikini', 'Figure', 'Wellness', 'Fitness'],
  },
  { id: 'crossfit', name: 'CrossFit', positions: ['Individual'] },
  { id: 'track-field', name: 'Track & Field', positions: ['Sprinter', 'Thrower'] },
  { id: 'cheerleading', name: 'Cheerleading', positions: ['Base', 'Flyer'] },
  { id: 'crossfit-override', name: 'CrossFit Masters', positions: ['Individual'], scenarioArchetype: 'attempt' },
];

test('resolveScenarioArchetype — catalog beats keywords, positions match divisions', async () => {
  const { archetypes } = await loadModules();
  const resolve = (sport: string | null) => archetypes.resolveScenarioArchetype(sport, TEST_CATALOG);

  // Division stored as the athlete's sport (straight apostrophe) matches the
  // catalog entry's position (curly apostrophe) and lands on stage.
  assert.equal(resolve("Men's physique"), 'stage');
  // Catalog name match.
  assert.equal(resolve('Bodybuilding / Physique'), 'stage');
  // Code-owned by-id default: CrossFit is raced in timed heats.
  assert.equal(resolve('CrossFit'), 'race');
  // Explicit entry field wins over the by-id map and keywords.
  assert.equal(resolve('CrossFit Masters'), 'attempt');
  // Admin-added sport with no explicit field and no map entry: keywords on
  // the entry name ("cheer" → judged).
  assert.equal(resolve('Cheerleading'), 'judged');
  // Not in the catalog at all: keyword fallback on the raw string.
  assert.equal(resolve('muay thai'), 'combat');
  assert.equal(resolve(null), 'general');
});

// ──────────────────────────────────────────────────────────────────────────────
// Seeded packs on the adversity module
// ──────────────────────────────────────────────────────────────────────────────

test('adversity module — carries pick phase and eight packs', async () => {
  const { library } = await loadModules();
  const exercise = (library as any).SEEDED_EXERCISES.find((e: any) => e.id === ADVERSITY_ID);
  assert.ok(exercise, 'seeded adversity module exists');
  const interaction = exercise.interaction;
  assert.equal(interaction.kind, 'choiceDrill');
  assert.ok(interaction.pickPrompt && interaction.pickPrompt.length > 0);
  assert.equal(interaction.pickChoices.length, 6);
  assert.equal(interaction.pickCount, 3);

  const packs = interaction.scenarioPacks ?? [];
  const archetypesPresent = packs.map((p: any) => p.archetype).sort();
  assert.deepEqual(
    archetypesPresent,
    ['attempt', 'combat', 'invasion', 'judged', 'net_racket', 'precision', 'race', 'stage'],
  );

  for (const pack of packs) {
    assert.equal(pack.whatIfChips.length, 6, `${pack.archetype} has 6 what-if chips`);
    if (pack.archetype === 'invasion') {
      // Base rounds already speak invasion; chips-only overlay by design.
      assert.equal(pack.rounds, undefined);
      continue;
    }
    assert.equal(pack.rounds.length, 3, `${pack.archetype} has 3 rounds`);
    for (const round of pack.rounds) {
      assert.equal(round.choices.length, 3);
      const targets = round.choices.filter((c: any) => c.isTarget);
      assert.equal(targets.length, 1, `${pack.archetype} round has exactly one target`);
      for (const choice of round.choices) {
        assert.ok(choice.feedback && choice.feedback.length > 0, 'every choice has feedback');
      }
    }
  }
});

test('adversity module — pack copy honors athlete-facing copy rules', async () => {
  const { library } = await loadModules();
  const exercise = (library as any).SEEDED_EXERCISES.find((e: any) => e.id === ADVERSITY_ID);
  const interaction = exercise.interaction;
  const lines: string[] = [interaction.pickPrompt, ...interaction.pickChoices];
  for (const pack of interaction.scenarioPacks ?? []) {
    lines.push(...(pack.whatIfChips ?? []));
    for (const round of pack.rounds ?? []) {
      lines.push(round.prompt);
      for (const choice of round.choices) {
        lines.push(choice.text, choice.feedback ?? '');
      }
    }
  }
  const banned: Array<[RegExp, string]> = [
    [/—/, 'em dash'],
    [/\brep\b/i, '"rep"'],
    [/\breps\b/i, '"reps"'],
    [/\bbaseline\b/i, '"baseline"'],
  ];
  for (const line of lines) {
    for (const [pattern, label] of banned) {
      assert.ok(!pattern.test(line), `${label} banned in athlete copy: "${line}"`);
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Narration enumeration (the byte-hash pre-generation contract)
// ──────────────────────────────────────────────────────────────────────────────

test('narration scripts — enumerate pick prompt and every pack line', async () => {
  const { library, narration } = await loadModules();
  const scripts = narration.buildModuleNarrationScripts()
    .filter((s: any) => s.moduleId === ADVERSITY_ID);
  const slots = new Set(scripts.map((s: any) => s.slot));

  assert.ok(slots.has('pick-prompt'), 'choiceDrill pick prompt is enumerated');

  const exercise = (library as any).SEEDED_EXERCISES.find((e: any) => e.id === ADVERSITY_ID);
  for (const pack of exercise.interaction.scenarioPacks ?? []) {
    (pack.rounds ?? []).forEach((round: any, roundIndex: number) => {
      const promptSlot = `pack-${pack.archetype}-round-${roundIndex + 1}`;
      assert.ok(slots.has(promptSlot), `missing ${promptSlot}`);
      const promptScript = scripts.find((s: any) => s.slot === promptSlot);
      // Byte-exact: iOS narrates the resolved round prompt verbatim.
      assert.equal(promptScript.text, round.prompt.trim());
      round.choices.forEach((choice: any, choiceIndex: number) => {
        const feedbackSlot = `${promptSlot}-feedback-${choiceIndex + 1}`;
        assert.ok(slots.has(feedbackSlot), `missing ${feedbackSlot}`);
      });
    });
  }

  // Chips are taps, never narrated: no slot should carry chip text.
  const chipTexts = new Set<string>(
    (exercise.interaction.scenarioPacks ?? []).flatMap((p: any) => p.whatIfChips ?? []),
  );
  for (const script of scripts) {
    assert.ok(!chipTexts.has(script.text), `chip text must not be narrated: ${script.text}`);
  }

  // cueKey formula stays stable for the ai-voice dashboard.
  for (const script of scripts) {
    assert.equal(script.cueKey, `${ADVERSITY_ID}-narration-${script.slot}`);
  }
});
