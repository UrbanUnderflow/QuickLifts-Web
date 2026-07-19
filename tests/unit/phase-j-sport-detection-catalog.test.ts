import test from 'node:test';
import assert from 'node:assert/strict';

// Phase J sport detection ↔ Sports Intelligence catalog wiring.
//
// The catalog (pulsecheckSportConfig.ts reportPolicy.loadModel) is the source
// of truth for per-sport load blends. Catalog-aligned sports derive their
// detection load inputs from it via the adapter; sports whose detection blends
// intentionally diverge (no snapshot proxy exists yet for their catalog
// primitives) are pinned below so a catalog loadModel edit forces a deliberate
// reconciliation in phaseJSportDetectionProfiles.ts instead of silent drift.
//
// Spec: PulseCheck/docs/specs/sports-intelligence-source-of-truth-spec.md §5

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
  const [profiles, config] = await Promise.all([
    import('../../src/api/firebase/phaseJSportDetectionProfiles'),
    import('../../src/api/firebase/pulsecheckSportConfig'),
  ]);
  return { profiles, config };
};

const catalogEntry = (config: any, id: string) => {
  const entry = config.getDefaultPulseCheckSports().find((sport: any) => sport.id === id);
  assert.ok(entry?.reportPolicy?.loadModel, `catalog entry ${id} has a loadModel`);
  return entry;
};

const divergence = (catalogPrimitives: any[], loadInputs: any[]) => {
  const catalogByKey = new Map(catalogPrimitives.map((primitive) => [primitive.key, primitive]));
  const profileByKey = new Map(loadInputs.map((input) => [input.key, input]));
  return {
    catalogOnly: [...catalogByKey.keys()].filter((key) => !profileByKey.has(key)).sort(),
    profileOnly: [...profileByKey.keys()].filter((key) => !catalogByKey.has(key)).sort(),
    weightMismatches: [...catalogByKey.keys()]
      .filter((key) => profileByKey.has(key) && profileByKey.get(key).weight !== catalogByKey.get(key).weight)
      .sort(),
  };
};

test('basketball detection load inputs derive from the catalog loadModel', async () => {
  const { profiles, config } = await loadModules();
  const profile = profiles.getPhaseJSportDetectionProfile('basketball');
  assert.ok(profile, 'basketball profile resolves');

  const primitives = catalogEntry(config, 'basketball').reportPolicy.loadModel.primitives;
  assert.ok(primitives.length >= 5, 'basketball catalog loadModel has primitives');

  for (const primitive of primitives) {
    const input = profile.loadInputs.find((candidate: any) => candidate.key === primitive.key);
    assert.ok(input, `catalog primitive ${primitive.key} present in detection load inputs`);
    assert.equal(input.weight, primitive.weight, `${primitive.key} weight comes from the catalog`);
    assert.equal(input.source, primitive.source, `${primitive.key} source comes from the catalog`);
    assert.equal(input.filter, primitive.filter, `${primitive.key} filter comes from the catalog`);
  }

  // Detection-specific overlay: snapshot proxies, required flag, supplements.
  const byKey = new Map(profile.loadInputs.map((input: any) => [input.key, input]));
  for (const key of ['jumpCount', 'lateralAccelCount', 'sprintReps', 'impactCollisionLoad']) {
    assert.equal(byKey.get(key)?.primitiveKey, 'accelerationBurstCount', `${key} maps to a snapshot proxy`);
  }
  assert.equal(byKey.get('internalLoadHr')?.required, true, 'internalLoadHr stays required');
  assert.ok(byKey.has('activeEnergyKcal'), 'supplemental activeEnergyKcal appended');
  assert.ok(byKey.has('sessionRpe'), 'supplemental sessionRpe appended');

  // Code-owned detection bits are preserved as overlays.
  assert.ok(
    profile.primitiveWeights.some((weight: any) => weight.key === 'internalLoadHr' && weight.min === 20),
    'detection primitive weights stay code-owned',
  );
  assert.ok(
    profile.clarificationQuestions.some((question: any) => question.id === 'basketball-practice-session-type'),
    'clarification questions stay code-owned',
  );
});

test('catalog divergence per overlapping sport is pinned, not silent', async () => {
  const { profiles, config } = await loadModules();

  // Sports listed with non-empty divergence keep code-owned loadInputs because
  // their catalog primitives have no detection proxy yet. Editing a catalog
  // loadModel (or a seed) for one of these sports fails here: reconcile the
  // seed in phaseJSportDetectionProfiles.ts, then update this pin.
  const expected: Record<string, { catalogOnly: string[]; profileOnly: string[]; weightMismatches: string[] }> = {
    basketball: {
      catalogOnly: [],
      profileOnly: ['activeEnergyKcal', 'sessionRpe'],
      weightMismatches: [],
    },
    football: {
      catalogOnly: ['impactCollisionLoad', 'sprintDistance', 'sprintReps'],
      profileOnly: ['activeEnergyKcal', 'collisionLoad', 'highIntensityEfforts', 'sessionRpe'],
      weightMismatches: ['internalLoadHr'],
    },
    soccer: {
      catalogOnly: ['highSpeedRunDistance', 'sprintReps'],
      profileOnly: ['accelerations', 'activeEnergyKcal', 'highSpeedRuns', 'sessionRpe'],
      weightMismatches: [],
    },
    'track-field': {
      catalogOnly: ['jumpCount', 'sprintDistance', 'technicalRepCount'],
      profileOnly: ['activeEnergyKcal', 'jumpThrowTechnicalReps', 'sessionRpe'],
      weightMismatches: ['internalLoadHr', 'sprintReps'],
    },
    volleyball: {
      catalogOnly: ['approachJumpIntensity', 'lateralAccelCount', 'shoulderVolumeProxy'],
      profileOnly: ['activeEnergyKcal', 'landingLoad', 'sessionRpe', 'shoulderVolume'],
      weightMismatches: ['internalLoadHr'],
    },
    bowling: {
      catalogOnly: ['gripStrainProxy', 'internalLoadHr', 'swingReps', 'travelDays'],
      profileOnly: ['activeEnergyKcal', 'frameVolume', 'sessionRpe'],
      weightMismatches: [],
    },
    golf: {
      catalogOnly: ['blockRoundDuration', 'internalLoadHr', 'swingReps', 'walkingDistance'],
      profileOnly: ['roundDuration', 'sessionRpe', 'walkingLoad'],
      weightMismatches: ['heatExposure'],
    },
  };

  for (const [sportId, pinned] of Object.entries(expected)) {
    const profile = profiles.getPhaseJSportDetectionProfile(sportId);
    assert.ok(profile, `${sportId} profile resolves`);
    const primitives = catalogEntry(config, sportId).reportPolicy.loadModel.primitives;
    assert.deepEqual(
      divergence(primitives, profile.loadInputs),
      pinned,
      `${sportId}: catalog loadModel vs detection load inputs drifted. If the catalog `
        + 'changed deliberately, reconcile the seed in phaseJSportDetectionProfiles.ts '
        + '(add a snapshot proxy or update the code-owned loadInputs), then update this pin.',
    );
  }
});

test('adapter maps a catalog entry to detection load inputs with snapshot proxies', async () => {
  const { profiles, config } = await loadModules();
  const entry = catalogEntry(config, 'basketball');
  const adapted = profiles.mapPulseCheckSportConfigToPhaseJDetectionProfile({
    sportConfig: entry,
    sessionTypes: ['practice'],
  });

  assert.deepEqual(
    adapted.loadInputs.map((input: any) => input.key),
    entry.reportPolicy.loadModel.primitives.map((primitive: any) => primitive.key),
    'adapter emits exactly the catalog primitives, in catalog order',
  );
  assert.equal(adapted.sportConfigId, 'basketball');
  assert.equal(adapted.sportName, entry.name);
});

test('sports resolve by catalog id and aliases, not a closed union', async () => {
  const { profiles, config } = await loadModules();

  const track = profiles.getPhaseJSportDetectionProfile('track');
  assert.equal(track?.sportId, 'track-field', 'aliases still resolve');

  // A catalog sport with no code-owned seed resolves through the catalog.
  const tennis = profiles.getPhaseJSportDetectionProfile('tennis');
  assert.ok(tennis, 'tennis resolves from the catalog');
  assert.equal(tennis.sportConfigId, 'tennis');
  const tennisPrimitiveKeys = catalogEntry(config, 'tennis').reportPolicy.loadModel.primitives
    .map((primitive: any) => primitive.key);
  for (const key of tennisPrimitiveKeys) {
    assert.ok(
      tennis.loadInputs.some((input: any) => input.key === key),
      `tennis load input ${key} comes from the catalog loadModel`,
    );
  }
  assert.ok(tennis.clarificationQuestions.length > 0, 'fallback profiles still clarify session type');

  // Every catalog sport with a loadModel now has a detection profile.
  for (const sport of config.getDefaultPulseCheckSports()) {
    if (!sport.reportPolicy?.loadModel) continue;
    const profile = profiles.getPhaseJSportDetectionProfile(sport.id);
    assert.ok(profile, `catalog sport ${sport.id} resolves to a detection profile`);
    assert.ok(profile.loadInputs.length > 0, `catalog sport ${sport.id} has load inputs`);
    const keys = profile.loadInputs.map((input: any) => input.key);
    assert.equal(new Set(keys).size, keys.length, `catalog sport ${sport.id} has no duplicate load-input keys`);
  }

  // Unknown sports still return undefined.
  assert.equal(profiles.getPhaseJSportDetectionProfile('quidditch'), undefined);

  // Phase-J-only ids keep their code-owned profiles.
  const lift = profiles.getPhaseJSportDetectionProfile('lift');
  assert.ok(
    lift?.loadInputs.some(
      (input: any) => input.key === 'strengthVolume' && input.required && input.primitiveKey === 'parsedLiftSummary',
    ),
    'lift keeps its code-owned load inputs',
  );
  for (const genericId of ['generic-practice', 'generic-conditioning', 'generic-game']) {
    assert.ok(profiles.getPhaseJSportDetectionProfile(genericId), `${genericId} still resolves`);
  }
});
