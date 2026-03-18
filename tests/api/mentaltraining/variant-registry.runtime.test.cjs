const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const harnessPath = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/tests/api/mentaltraining/_tsRuntimeHarness.cjs';

const runtimePrelude = `
const assert = require('node:assert/strict');
const {
  createFirestoreMock,
  loadSimBuildRuntime,
  loadVariantRegistryRuntime,
} = require(${JSON.stringify(harnessPath)});

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
    },
    moduleDraft: {
      moduleId: 'reset-module-1',
      name: 'Sport-Context Reset',
      description: 'A live reset simulation.',
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

function createModuleDraft(overrides = {}) {
  return {
    id: 'reset-module-1',
    name: 'Sport-Context Reset',
    description: 'A live reset simulation.',
    category: 'focus',
    difficulty: 'advanced',
    durationMinutes: 5,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'reset',
        duration: 300,
        progressionLevel: 3,
        instructions: ['Reset and refocus quickly.'],
      },
    },
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
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}
`;

function runRegistryScenario(scriptBody) {
  const result = spawnSync(process.execPath, ['-e', `${runtimePrelude}\n${scriptBody}`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || 'Registry runtime scenario failed without output.'
  );
}

test('syncSeeds reconciles canonical seed drift for existing variants', () => {
  runRegistryScenario(`
const initialRecord = createVariantRecord({
  familyStatus: 'candidate',
  specStatus: 'in-progress',
  priority: 'low',
  engineKey: undefined,
  sourceFingerprint: undefined,
  syncStatus: undefined,
  buildStatus: undefined,
  buildArtifact: undefined,
  buildMeta: undefined,
  lastBuiltFingerprint: undefined,
  lastPublishedFingerprint: undefined,
});

const firestore = createFirestoreMock({
  'sim-variants': [{ id: initialRecord.id, data: initialRecord }],
  'sim-modules': [],
});
const { simVariantRegistryService } = loadVariantRegistryRuntime(firestore);

(async () => {
  const result = await simVariantRegistryService.syncSeeds([
    {
      name: 'Sport-Context Reset',
      family: 'Reset',
      familyStatus: 'locked',
      mode: 'branch',
      specStatus: 'needs-spec',
      priority: 'high',
    },
  ]);

  assert.equal(result.created, 0);
  assert.equal(result.updated, 1);

  const savedRecord = firestore.getDoc(\`sim-variants/\${initialRecord.id}\`);
  assert.equal(savedRecord.name, 'Sport-Context Reset');
  assert.equal(savedRecord.familyStatus, 'locked');
  assert.equal(savedRecord.specStatus, 'needs-spec');
  assert.equal(savedRecord.priority, 'high');
  assert.equal(savedRecord.syncStatus, 'in_sync');
  assert.equal(savedRecord.buildStatus, 'not_built');

  const historyEntries = firestore.getCollection(\`sim-variants/\${initialRecord.id}/history\`);
  assert.ok(historyEntries.some((entry) => entry.data.action === 'seed_synced'));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`);
});

test('save recomputes sync and build status instead of trusting stale caller state', () => {
  runRegistryScenario(`
const publishedRecord = simBuild.buildPublishedVariantRecord(createVariantRecord(), 200);
const staleInput = {
  ...publishedRecord,
  specRaw: 'Reset spec v2',
  syncStatus: 'in_sync',
  buildStatus: 'published',
};

const firestore = createFirestoreMock({
  'sim-variants': [{ id: publishedRecord.id, data: publishedRecord }],
  'sim-modules': [{ id: publishedRecord.publishedModuleId, data: createModuleDraft({ id: publishedRecord.publishedModuleId }) }],
});
const { simVariantRegistryService } = loadVariantRegistryRuntime(firestore);

(async () => {
  await simVariantRegistryService.save(staleInput);

  const savedRecord = firestore.getDoc(\`sim-variants/\${publishedRecord.id}\`);
  assert.equal(savedRecord.specRaw, 'Reset spec v2');
  assert.equal(savedRecord.syncStatus, 'spec_changed');
  assert.equal(savedRecord.buildStatus, 'out_of_sync');
  assert.notEqual(savedRecord.sourceFingerprint, publishedRecord.sourceFingerprint);

  const historyEntries = firestore.getCollection(\`sim-variants/\${publishedRecord.id}/history\`);
  assert.ok(historyEntries.some((entry) => entry.data.action === 'saved'));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`);
});

test('publish derives module and variant snapshots from the current variant state', () => {
  runRegistryScenario(`
const record = createVariantRecord();
const module = createModuleDraft({ id: 'published-reset-module', moduleId: undefined });

const firestore = createFirestoreMock({
  'sim-variants': [{ id: record.id, data: record }],
  'sim-modules': [],
});
const { simVariantRegistryService } = loadVariantRegistryRuntime(firestore);

(async () => {
  const publishedModuleId = await simVariantRegistryService.publish(record, module);
  assert.equal(publishedModuleId, module.id);

  const savedRecord = firestore.getDoc(\`sim-variants/\${record.id}\`);
  const savedModule = firestore.getDoc(\`sim-modules/\${module.id}\`);

  assert.equal(savedRecord.publishedModuleId, module.id);
  assert.equal(savedRecord.specStatus, 'complete');
  assert.equal(savedRecord.syncStatus, 'in_sync');
  assert.equal(savedRecord.buildStatus, 'published');
  assert.equal(savedRecord.lastPublishedFingerprint, savedRecord.sourceFingerprint);
  assert.equal(savedRecord.publishedSnapshot.sourceFingerprint, savedRecord.sourceFingerprint);

  assert.equal(savedModule.publishedFingerprint, savedRecord.sourceFingerprint);
  assert.equal(savedModule.syncStatus, 'in_sync');
  assert.equal(savedModule.variantSource.variantId, record.id);
  assert.equal(savedModule.variantSource.family, record.family);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`);
});
