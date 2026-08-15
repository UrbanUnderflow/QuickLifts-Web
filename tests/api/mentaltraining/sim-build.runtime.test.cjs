const test = require('node:test');
const assert = require('node:assert/strict');

const { loadSimBuildRuntime } = require('./_tsRuntimeHarness.cjs');

const simBuild = loadSimBuildRuntime();

function createVariantRecord(overrides = {}) {
  return {
    id: 'reset-branch-sport-context-reset',
    name: 'Sport-Context Reset',
    family: 'Reset',
    familyStatus: 'locked',
    mode: 'branch',
    specStatus: 'needs-spec',
    priority: 'high',
    specRaw: 'Reset spec v1',
    runtimeConfig: {
      session: {
        durationMinutes: 5,
        feedbackMode: 'coached',
      },
      analytics: {
        focus: ['reset'],
      },
    },
    moduleDraft: {
      moduleId: 'reset-module-1',
      name: 'Sport-Context Reset',
      description: 'A reset-and-return simulation.',
      category: 'focus',
      difficulty: 'advanced',
      durationMinutes: 5,
      benefits: ['reset faster'],
      bestFor: ['pregame'],
      origin: 'Pulse',
      neuroscience: 'Keeps attention flexible under pressure.',
      overview: {
        when: 'After mistakes',
        focus: 'Reset speed',
        timeScale: '5 minutes',
        skill: 'Recovery Time',
        analogy: 'Next play mindset',
      },
      iconName: 'rotate-ccw',
      isActive: true,
      sortOrder: 1,
    },
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function createEnduranceVariantRecord(overrides = {}) {
  return createVariantRecord({
    id: 'endurance-lock-branch-late-pressure-endurance-lock',
    name: 'Late-Pressure Endurance Lock',
    family: 'Endurance Lock',
    runtimeConfig: {
      archetype: 'fatigue_load',
      session: {
        durationMinutes: 6,
        feedbackMode: 'coached',
      },
      analytics: {
        focus: ['degradation_slope'],
      },
    },
    moduleDraft: {
      moduleId: 'endurance-lock-module-1',
      name: 'Late-Pressure Endurance Lock',
      description: 'An endurance simulation.',
      category: 'focus',
      difficulty: 'advanced',
      durationMinutes: 6,
      benefits: ['maintain steady responses'],
      bestFor: ['late session breakdowns'],
      origin: 'Pulse',
      neuroscience: 'Tracks sustained attention under fatigue.',
      overview: {
        when: 'When late pressure matters',
        focus: 'Degradation Slope',
        timeScale: '6 minutes',
        skill: 'Sustained Attention',
        analogy: 'Holding form late in the game',
      },
      iconName: 'timer',
      isActive: true,
      sortOrder: 1,
    },
    ...overrides,
  });
}

test('determineSyncStatus differentiates spec, config, module, and build-only drift', () => {
  const base = createVariantRecord();
  const publishedSnapshot = {
    specRaw: base.specRaw,
    runtimeConfig: base.runtimeConfig,
    moduleDraft: base.moduleDraft,
    sourceFingerprint: 'fp_original',
    publishedAt: 200,
  };

  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      specRaw: 'Reset spec v2',
    }),
    'spec_changed'
  );

  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      runtimeConfig: {
        ...base.runtimeConfig,
        session: {
          ...base.runtimeConfig.session,
          durationMinutes: 6,
        },
      },
    }),
    'config_changed'
  );

  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      moduleDraft: {
        ...base.moduleDraft,
        description: 'Updated athlete-facing description.',
      },
    }),
    'module_changed'
  );

  const sourceFingerprint = simBuild.buildVariantSourceFingerprint(base);
  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      sourceFingerprint,
      lastPublishedFingerprint: sourceFingerprint,
    }),
    'in_sync'
  );

  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      sourceFingerprint: 'fp_rebuilt_without_publish',
      lastPublishedFingerprint: 'fp_original',
    }),
    'build_stale'
  );
});

test('buildVariantRecordForBuild compiles a build artifact and updates status metadata', () => {
  const built = simBuild.buildVariantRecordForBuild(createVariantRecord());

  assert.equal(built.engineKey, 'reset');
  assert.equal(built.buildStatus, 'built');
  assert.equal(built.syncStatus, 'in_sync');
  assert.ok(built.sourceFingerprint);
  assert.equal(built.lastBuiltFingerprint, built.sourceFingerprint);
  assert.equal(built.buildArtifact.variantId, built.id);
  assert.equal(built.buildArtifact.moduleId, built.moduleDraft.moduleId);
  assert.equal(built.buildMeta.engineVersion, 'registry-runtime/v1');
});

test('family contracts override generated task and scoring drift', () => {
  const cases = [
    ['Reset', 'matched_left_right_arrow_classification', 'post_disruption_reengagement_cost_ms'],
    ['Noise Gate', 'visible_number_match_visual_search', 'distractor_cost'],
    ['Brake Point', 'two_choice_stop_signal', 'stop_success_rate'],
    ['Signal Window', 'nine_arrow_majority_discrimination', 'decision_accuracy'],
    ['Sequence Shift', 'cued_letter_number_task_switching', 'switch_rt_cost_ms'],
    ['Endurance Lock', 'constant_visual_signal_detection', 'correct_rt_slope_ms_per_min'],
  ];

  for (const [family, primaryTask, coreMetricName] of cases) {
    const built = simBuild.buildVariantRecordForBuild(createVariantRecord({
      id: `${family.toLowerCase().replaceAll(' ', '-')}-drift-check`,
      family,
      name: `${family} Drift Check`,
      runtimeConfig: {
        stimuli: {
          primaryTask: 'memorize_a_word_then_guess',
          responseWindowMs: 9999,
        },
        scoring: {
          coreMetricName: 'generic_brain_score',
          artifactFloorMs: 0,
          supportingMetrics: ['variant_context_tag'],
        },
      },
    }));

    assert.equal(built.buildArtifact.stimulusModel.primaryTask, primaryTask, `${family} task identity drifted`);
    assert.equal(built.buildArtifact.scoringModel.coreMetricName, coreMetricName, `${family} core metric drifted`);
    assert.equal(built.buildArtifact.scoringModel.artifactFloorMs, 150, `${family} artifact floor drifted`);
    assert.ok(built.buildArtifact.scoringModel.supportingMetrics.includes('variant_context_tag'));
  }
});

test('buildPublishedVariantRecord stamps published snapshot, fingerprints, and status invariants', () => {
  const publishedAt = 123456789;
  const published = simBuild.buildPublishedVariantRecord(createVariantRecord(), publishedAt);

  assert.equal(published.publishedAt, publishedAt);
  assert.equal(published.publishedModuleId, 'reset-module-1');
  assert.equal(published.specStatus, 'complete');
  assert.equal(published.syncStatus, 'in_sync');
  assert.equal(published.buildStatus, 'published');
  assert.equal(published.lastPublishedFingerprint, published.sourceFingerprint);
  assert.equal(published.publishedSnapshot.sourceFingerprint, published.sourceFingerprint);
  assert.equal(published.buildArtifact.sourceFingerprint, published.sourceFingerprint);
});

test('Endurance Lock variants compile a fixed six-block visual signal task', () => {
  const built = simBuild.buildVariantRecordForBuild(createEnduranceVariantRecord());
  const stimulusModel = built.buildArtifact.stimulusModel;
  const scoringModel = built.buildArtifact.scoringModel;

  assert.equal(built.engineKey, 'endurance_lock');
  assert.equal(stimulusModel.primaryTask, 'constant_visual_signal_detection');
  assert.equal(stimulusModel.blockCount, 6);
  assert.deepEqual(stimulusModel.foreperiodRangeMs, [1500, 3500]);
  assert.equal(stimulusModel.responseWindowMs, 1500);
  assert.equal(stimulusModel.cueChannel, 'visual_only');
  assert.equal(stimulusModel.runtimeProfile, undefined);
  assert.equal(scoringModel.coreMetricName, 'correct_rt_slope_ms_per_min');
  assert.equal(built.buildArtifact.sessionModel.adaptiveDifficulty, false);
});

test('Endurance Lock packaging cannot change the scored cue, display, or timing contract', () => {
  const built = simBuild.buildVariantRecordForBuild(createEnduranceVariantRecord({
    id: 'endurance-lock-branch-clutter-fatigue-endurance-lock',
    name: 'Clutter-Fatigue Endurance Lock',
    runtimeConfig: {
      archetype: 'visual_channel',
      session: {
        durationMinutes: 6,
        feedbackMode: 'coached',
        adaptiveDifficulty: true,
      },
      stimuli: {
        primaryTask: 'clutter_ramp',
        cueChannel: 'audio_visual',
        responseWindowMs: 300,
        blockCount: 12,
        runtimeProfile: {
          profileId: 'clutter_ramp_v1',
          activeModifiers: ['visual_density'],
        },
      },
      analytics: {
        focus: ['degradation_slope', 'visual_channel_performance'],
      },
    },
    moduleDraft: {
      moduleId: 'endurance-lock-module-2',
      name: 'Clutter-Fatigue Endurance Lock',
      description: 'A visual endurance simulation.',
      category: 'focus',
      difficulty: 'advanced',
      durationMinutes: 6,
      benefits: ['hold the target under clutter'],
      bestFor: ['visual interference'],
      origin: 'Pulse',
      neuroscience: 'Tracks sustained attention under visual interference.',
      overview: {
        when: 'When visual clutter breaks focus',
        focus: 'Degradation Slope',
        timeScale: '6 minutes',
        skill: 'Sustained Attention',
        analogy: 'Holding form through visual noise',
      },
      iconName: 'timer',
      isActive: true,
      sortOrder: 1,
    },
  }));
  const stimulusModel = built.buildArtifact.stimulusModel;

  assert.equal(stimulusModel.primaryTask, 'constant_visual_signal_detection');
  assert.equal(stimulusModel.cueChannel, 'visual_only');
  assert.equal(stimulusModel.responseWindowMs, 1500);
  assert.equal(stimulusModel.blockCount, 6);
  assert.equal(stimulusModel.runtimeProfile, undefined);
  assert.equal(built.buildArtifact.sessionModel.adaptiveDifficulty, false);
});
