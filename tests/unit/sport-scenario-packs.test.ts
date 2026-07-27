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
  const [archetypes, library, narration, sportConfig] = await Promise.all([
    import('../../src/api/firebase/mentaltraining/sportScenarioArchetypes'),
    import('../../src/api/firebase/mentaltraining/exerciseLibraryService'),
    import('../../src/api/firebase/mentaltraining/moduleNarrationScripts'),
    import('../../src/api/firebase/pulsecheckSportConfig'),
  ]);
  return { archetypes, library, narration, sportConfig };
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

test('every seeded skill carries a complete curriculum-wide sport pack set', async () => {
  const { library } = await loadModules();
  const required = ['attempt', 'combat', 'invasion', 'judged', 'net_racket', 'precision', 'race', 'stage'];
  const exercises = (library as any).SEEDED_EXERCISES;

  assert.equal(exercises.length, 26, 'the full seeded curriculum is covered');
  for (const exercise of exercises) {
    const packs = exercise.sportContentPacks ?? [];
    assert.deepEqual(
      packs.map((pack: any) => pack.archetype).sort(),
      required,
      `${exercise.id} has one pack for every supported archetype`,
    );
    for (const pack of packs) {
      assert.ok(pack.applicationCue?.trim(), `${exercise.id}/${pack.archetype} has an application cue`);
    }
  }
});

test('sport content packs contain no undefined values before Firestore sync', async () => {
  const { library } = await loadModules();
  const exercises = (library as any).SEEDED_EXERCISES;

  const findUndefinedPath = (value: unknown, path: string): string | null => {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const found = findUndefinedPath(value[index], `${path}[${index}]`);
        if (found) return found;
      }
      return null;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (child === undefined) return `${path}.${key}`;
        const found = findUndefinedPath(child, `${path}.${key}`);
        if (found) return found;
      }
    }
    return null;
  };

  for (const exercise of exercises) {
    assert.equal(
      findUndefinedPath(exercise.sportContentPacks, exercise.id),
      null,
      `${exercise.id} contains an undefined sport-pack field`,
    );
  }
});

test('scenario-driven skills replace active content for all sport archetypes', async () => {
  const { library } = await loadModules();
  const scenarioDrivenIds = [
    'viz-competition-walkthrough',
    'viz-perfect-execution',
    'viz-highlight-reel',
    'viz-adversity-response',
    'mindset-pressure-privilege',
    'mindset-nerves-excitement',
    'mindset-process-focus',
    'mindset-growth',
    'confidence-evidence-journal',
    'confidence-affirmations',
    'confidence-inventory',
  ];

  for (const id of scenarioDrivenIds) {
    const exercise = (library as any).SEEDED_EXERCISES.find((item: any) => item.id === id);
    assert.ok(exercise, `${id} exists`);
    for (const pack of exercise.sportContentPacks) {
      assert.ok(pack.interaction, `${id}/${pack.archetype} replaces the active interaction`);
    }
  }
});

test('men’s physique nerves pack contains stage-native language only', async () => {
  const { library } = await loadModules();
  const exercise = (library as any).SEEDED_EXERCISES
    .find((item: any) => item.id === 'mindset-nerves-excitement');
  const stage = exercise.sportContentPacks.find((pack: any) => pack.archetype === 'stage');
  const rehearsal = stage?.interaction?.nervesRehearsal;
  assert.equal(stage?.interaction?.kind, 'nervesRehearsal');
  assert.ok(rehearsal, 'stage rehearsal exists');

  const lines = JSON.stringify(stage).toLowerCase();
  assert.match(lines, /backstage before prejudging/);
  assert.match(lines, /stage|posing|pose/);
  assert.doesNotMatch(lines, /locker room/);
  assert.doesNotMatch(lines, /\bplay\b/);
  assert.doesNotMatch(lines, /\bgame\b/);
  assert.doesNotMatch(lines, /\bteammate/);
});

test('Nerves to Excitement has a complete progressive rehearsal pack for every sport archetype', async () => {
  const { library } = await loadModules();
  const exercise = (library as any).SEEDED_EXERCISES
    .find((item: any) => item.id === 'mindset-nerves-excitement');

  assert.ok(exercise, 'Nerves to Excitement exists');
  assert.equal(exercise.sportContentPacks.length, 8);

  for (const pack of exercise.sportContentPacks) {
    const rehearsal = pack.interaction?.nervesRehearsal;
    assert.equal(
      pack.interaction?.kind,
      'nervesRehearsal',
      `${pack.archetype} uses the rehearsal game`,
    );
    assert.ok(rehearsal, `${pack.archetype} has a rehearsal config`);
    assert.equal(rehearsal.contentVersion, 3, `${pack.archetype} uses the current clear-language copy`);
    assert.equal(rehearsal.awarenessChoices.length, 4);
    assert.equal(rehearsal.meaningChoices.length, 3);
    assert.equal(
      rehearsal.meaningChoices.filter((choice: any) => choice.isTarget).length,
      1,
      `${pack.archetype} has one target response`,
    );
    assert.equal(rehearsal.cueChoices.length, 3);
    for (const cue of rehearsal.cueChoices) {
      assert.ok(
        cue.trim().split(/\s+/).length <= 8,
        `${pack.archetype} phrase "${cue}" stays recallable`,
      );
    }
    assert.deepEqual(
      rehearsal.rehearsalRounds.map((round: any) => round.support),
      ['visible', 'rebuild', 'recall'],
      `${pack.archetype} removes support across the three repetitions`,
    );
    assert.equal(
      rehearsal.rehearsalRounds.filter((round: any) => round.support !== 'visible').length,
      2,
      `${pack.archetype} requires two unsupported repetitions`,
    );
    assert.ok(
      rehearsal.rehearsalRounds.every((round: any) => round.windowSeconds >= 10),
      `${pack.archetype} uses a real response window`,
    );
    assert.ok(rehearsal.setAction.trim(), `${pack.archetype} has a sport-native set action`);
    assert.ok(rehearsal.reflectionChoices.length >= 4);
    assert.ok(rehearsal.closePrompt.trim());
  }
});

test('Nerves to Excitement uses direct athlete-facing language in every content pack', async () => {
  const { library } = await loadModules();
  const exercise = (library as any).SEEDED_EXERCISES
    .find((item: any) => item.id === 'mindset-nerves-excitement');

  const collectStrings = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(collectStrings);
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
    }
    return [];
  };
  const banned: Array<[RegExp, string]> = [
    [/\bwhat meaning\b/i, '"what meaning"'],
    [/\buseful meaning\b/i, '"useful meaning"'],
    [/\buseful job\b/i, '"useful job"'],
    [/\bgive (?:this |the )?energy a job\b/i, '"give the energy a job"'],
    [/\banother rush\b/i, '"another rush"'],
    [/\bsame fuel\b/i, '"same fuel"'],
    [/\bdifferent gear\b/i, '"different gear"'],
    [/\bpersonal cue\b/i, '"personal cue"'],
    [/\bthe cue\b/i, '"the cue"'],
    [/\benergy\b/i, '"energy" instead of naming the body change'],
    [/\bcue\b/i, '"cue" instead of "phrase"'],
    [/\bsignal\b/i, '"signal" instead of naming the body change'],
    [/\brush\b/i, '"rush" instead of naming the body change'],
  ];

  for (const pack of exercise.sportContentPacks) {
    const athleteCopy = collectStrings({
      applicationCue: pack.applicationCue,
      interaction: pack.interaction,
    });
    for (const line of athleteCopy) {
      for (const [pattern, label] of banned) {
        assert.doesNotMatch(
          line,
          pattern,
          `${pack.archetype} must not use ambiguous ${label} language: ${line}`,
        );
      }
      assert.doesNotMatch(
        line,
        /\bmy body\b[^.!?]*\byour\b/i,
        `${pack.archetype} must not mix first- and second-person language: ${line}`,
      );
    }
  }

  const baseCopy = collectStrings({
    description: exercise.description,
    exerciseConfig: exercise.exerciseConfig,
    benefits: exercise.benefits,
    bestFor: exercise.bestFor,
    reflection: exercise.reflection,
    interaction: exercise.interaction,
    overview: exercise.overview,
  });
  for (const line of baseCopy) {
    for (const [pattern, label] of banned) {
      assert.doesNotMatch(line, pattern, `base module must not use ambiguous ${label} language: ${line}`);
    }
  }
});

test('every configured sport resolves to a Nerves to Excitement content pack', async () => {
  const { archetypes, library, sportConfig } = await loadModules();
  const exercise = (library as any).SEEDED_EXERCISES
    .find((item: any) => item.id === 'mindset-nerves-excitement');
  const packsByArchetype = new Map(
    exercise.sportContentPacks.map((pack: any) => [pack.archetype, pack]),
  );
  const catalog = sportConfig.getDefaultPulseCheckSports();

  for (const sport of catalog) {
    const archetype = archetypes.resolveScenarioArchetype(sport.name, catalog);
    if (sport.id === 'other') {
      assert.equal(archetype, 'general');
      continue;
    }
    assert.notEqual(archetype, 'general', `${sport.name} must resolve to a reviewed environment`);
    assert.ok(
      packsByArchetype.has(archetype),
      `${sport.name} must resolve to a complete Nerves to Excitement pack`,
    );
  }
});

test('sport pack copy follows the athlete-facing copy doctrine', async () => {
  const { library } = await loadModules();
  const banned: Array<[RegExp, string]> = [
    [/—/, 'em dash'],
    [/\bnot\s+[^.!?]{1,70}\bbut\b/i, 'negation-led contrast'],
    [/\bprepare the pathway\b/i, 'ambiguous pathway language'],
    [/\bstrengthen your state\b/i, 'adult abstract state language'],
  ];

  for (const exercise of (library as any).SEEDED_EXERCISES) {
    for (const pack of exercise.sportContentPacks ?? []) {
      const copy = JSON.stringify(pack);
      for (const [pattern, label] of banned) {
        assert.ok(
          !pattern.test(copy),
          `${label} banned in ${exercise.id}/${pack.archetype}`,
        );
      }
    }
  }
});

test('generic curriculum fallbacks stay free of setting-specific sport leakage', async () => {
  const { library } = await loadModules();
  const banned: Array<[RegExp, string]> = [
    [/\blocker room\b/i, 'locker-room setting'],
    [/\bevery play\b/i, 'team-play language'],
    [/\bthe whistle\b/i, 'whistle language'],
    [/\bfield conditions\b/i, 'field-only conditions'],
    [/\bboth teams\b/i, 'team-only comparison'],
    [/\breading the defense\b/i, 'defense-reading language'],
    [/\bavoid plays\b/i, 'team-play avoidance'],
    [/\bfinal score\b/i, 'score-only outcome'],
    [/\ba game i won\b/i, 'game-only highlight prompt'],
  ];

  const genericCopy = (exercise: any): string => {
    const {
      sportContentPacks: _sportContentPacks,
      origin: _origin,
      neuroscience: _neuroscience,
      ...base
    } = exercise;
    if (base.interaction?.scenarioPacks) {
      const { scenarioPacks: _scenarioPacks, ...baseInteraction } = base.interaction;
      base.interaction = baseInteraction;
    }
    return JSON.stringify(base);
  };

  for (const exercise of (library as any).SEEDED_EXERCISES) {
    const copy = genericCopy(exercise);
    for (const [pattern, label] of banned) {
      assert.ok(!pattern.test(copy), `${label} leaked into generic fallback for ${exercise.id}`);
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

test('narration scripts — enumerate every curriculum-wide packed interaction', async () => {
  const { library, narration } = await loadModules();
  const scripts = narration.buildModuleNarrationScripts();

  for (const exercise of (library as any).SEEDED_EXERCISES) {
    const moduleScripts = scripts.filter((script: any) => script.moduleId === exercise.id);
    for (const pack of exercise.sportContentPacks ?? []) {
      if (exercise.id === 'focus-3-second-reset') {
        continue;
      }
      assert.ok(
        moduleScripts.some((script: any) => script.slot === `sport-${pack.archetype}-intro`),
        `${exercise.id}/${pack.archetype} intro narration is enumerable`,
      );
      if (pack.interaction?.rounds?.length) {
        pack.interaction.rounds.forEach((round: any, roundIndex: number) => {
          const slot = `sport-${pack.archetype}-drill-round-${roundIndex + 1}`;
          const script = moduleScripts.find((item: any) => item.slot === slot);
          assert.equal(script?.text, round.prompt.trim(), `${exercise.id} missing ${slot}`);
        });
      }
    }
  }
});
