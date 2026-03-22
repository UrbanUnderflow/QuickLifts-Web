#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function parseArgs(argv) {
  const options = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1',
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    json: false,
    includeUnpublished: true,
    repoRoot: path.resolve(__dirname, '..'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--project') {
      options.projectId = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--service-account') {
      options.serviceAccountPath = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--repo-root') {
      options.repoRoot = path.resolve(argv[index + 1] || options.repoRoot);
      index += 1;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--published-only') {
      options.includeUnpublished = false;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(
    [
      'Usage:',
      '  node scripts/audit-pulsecheck-ios-runtime-live.cjs [--project <projectId>] [--service-account <path>] [--json] [--published-only]',
      '',
      'What it does:',
      '  - Reads live sim-variants, sim-modules, mental-exercises, and pulsecheck-protocols',
      '  - Crosswalks them against the current PulseCheck iPhone launch rules',
      '  - Reports which published sims/protocols are actually launchable on iOS today',
      '',
      'Examples:',
      '  node scripts/audit-pulsecheck-ios-runtime-live.cjs',
      '  node scripts/audit-pulsecheck-ios-runtime-live.cjs --json',
      '  node scripts/audit-pulsecheck-ios-runtime-live.cjs --published-only',
    ].join('\n')
  );
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function formatPrivateKey(key) {
  if (!key) return '';

  let formatted = String(key).trim();
  if (formatted.startsWith('"') && formatted.endsWith('"')) {
    formatted = formatted.slice(1, -1);
  }
  if (formatted.startsWith("'") && formatted.endsWith("'")) {
    formatted = formatted.slice(1, -1);
  }
  if (formatted.includes('\\n')) {
    formatted = formatted.replace(/\\n/g, '\n');
  }
  if (
    formatted
    && !formatted.includes('-----BEGIN PRIVATE KEY-----')
    && !formatted.includes('-----END PRIVATE KEY-----')
  ) {
    formatted = `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----`;
  }

  return formatted;
}

function readNetlifyEnv(name, cwd) {
  try {
    return execFileSync(
      'npx',
      ['netlify', 'env:get', name],
      {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    ).trim();
  } catch (error) {
    return '';
  }
}

function hydrateFirebaseEnvFromNetlify(repoRoot) {
  const names = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_SECRET_KEY',
  ];

  names.forEach((name) => {
    if (normalizeString(process.env[name])) return;
    const value = readNetlifyEnv(name, repoRoot);
    if (value) {
      process.env[name] = value;
    }
  });
}

function initializeAdmin({ projectId, serviceAccountPath, repoRoot }) {
  if (admin.apps.length) {
    return admin.app();
  }

  if (serviceAccountPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(serviceAccountPath);
  } else {
    hydrateFirebaseEnvFromNetlify(repoRoot);
  }

  const privateKey = formatPrivateKey(
    process.env.FIREBASE_SECRET_KEY
    || process.env.FIREBASE_PRIVATE_KEY
    || process.env.GOOGLE_PRIVATE_KEY
    || ''
  );
  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL
    || process.env.GOOGLE_CLIENT_EMAIL
    || '';
  const resolvedProjectId =
    projectId
    || process.env.FIREBASE_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || 'quicklifts-dd3f1';

  if (privateKey && clientEmail) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        type: 'service_account',
        project_id: resolvedProjectId,
        private_key: privateKey,
        client_email: clientEmail,
      }),
      projectId: resolvedProjectId,
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: resolvedProjectId,
  });
}

function humanizeLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizedAssignmentKey(identifier) {
  const trimmed = normalizeString(identifier);
  if (!trimmed) return '';

  const underscoreParts = trimmed.split('_');
  if (
    underscoreParts.length >= 3
    && /^\d{4}-\d{2}-\d{2}$/.test(underscoreParts[1] || '')
  ) {
    return underscoreParts.slice(2).join('_').replace(/_/g, '-');
  }

  return trimmed.replace(/_/g, '-');
}

function normalizedSimFamilyLabel(identifier) {
  const normalizedIdentifier = normalizedAssignmentKey(identifier);
  if (!normalizedIdentifier) return '';

  const branchIndex = normalizedIdentifier.indexOf('-branch-');
  if (branchIndex >= 0) {
    return normalizedIdentifier.slice(0, branchIndex);
  }

  if (normalizedIdentifier.includes('endurance-lock')) return 'endurance-lock';
  if (normalizedIdentifier.includes('brake-point')) return 'brake-point';
  if (normalizedIdentifier.includes('signal-window')) return 'signal-window';
  if (normalizedIdentifier.includes('noise-gate')) return 'noise-gate';
  if (normalizedIdentifier.includes('sequence-shift')) return 'sequence-shift';
  if (normalizedIdentifier.includes('reset')) return 'reset';

  return normalizedIdentifier;
}

function legacyExerciseIdForSimSpec(simSpecId) {
  switch (normalizedSimFamilyLabel(simSpecId)) {
    case 'reset':
      return 'focus-3-second-reset';
    case 'noise-gate':
      return 'focus-noise-gate';
    case 'brake-point':
      return 'decision-brake-point';
    case 'signal-window':
      return 'decision-signal-window';
    case 'sequence-shift':
      return 'decision-sequence-shift';
    case 'endurance-lock':
      return 'focus-endurance-lock';
    default:
      return null;
  }
}

function canonicalExerciseIdForFamily(identifier) {
  switch (normalizedSimFamilyLabel(identifier)) {
    case 'reset':
      return 'focus-3-second-reset';
    case 'noise-gate':
      return 'focus-noise-gate';
    case 'brake-point':
      return 'decision-brake-point';
    case 'signal-window':
      return 'decision-signal-window';
    case 'sequence-shift':
      return 'decision-sequence-shift';
    case 'endurance-lock':
      return 'focus-endurance-lock';
    default:
      return null;
  }
}

function normalizedLegacyExerciseId(legacyExerciseId, simSpecId) {
  const normalizedLegacyId = normalizeString(legacyExerciseId);
  if (
    normalizedLegacyId
    && normalizedLegacyId.includes('-branch-')
  ) {
    const fallback = legacyExerciseIdForSimSpec(normalizedLegacyId);
    if (fallback) return fallback;
  }

  return simSpecId ? legacyExerciseIdForSimSpec(simSpecId) : null;
}

function addMapValue(map, key, value) {
  if (!key) return;
  const normalizedKey = normalizeString(key);
  if (!normalizedKey) return;
  if (!map.has(normalizedKey)) {
    map.set(normalizedKey, []);
  }
  map.get(normalizedKey).push(value);
}

function firstMatch(map, key) {
  if (!key) return null;
  const values = map.get(normalizeString(key)) || [];
  return values[0] || null;
}

function buildExerciseIndexes(exercises) {
  const allById = new Map();
  const allBySimSpec = new Map();
  const allByName = new Map();
  const activeByName = new Map();
  const activeExercises = [];

  exercises.forEach((exercise) => {
    const id = normalizeString(exercise.id);
    if (id) {
      allById.set(id, exercise);
    }

    addMapValue(allBySimSpec, exercise.simSpecId, exercise);
    addMapValue(allByName, exercise.name, exercise);

    if (exercise.isActive !== false) {
      activeExercises.push(exercise);
      addMapValue(activeByName, exercise.name, exercise);
    }
  });

  return {
    allById,
    allBySimSpec,
    allByName,
    activeByName,
    activeExercises,
  };
}

function resolveExerciseRuntime(exercise) {
  if (!exercise) {
    return {
      runnable: false,
      runtime: 'missing',
      reason: 'No matching mental-exercises document exists.',
    };
  }

  if (exercise.isActive === false) {
    return {
      runnable: false,
      runtime: 'inactive',
      reason: 'Exercise exists but is inactive in mental-exercises.',
    };
  }

  const category = normalizeString(exercise.category || exercise.exerciseConfig?.type);
  const focusType = normalizeString(exercise.exerciseConfig?.config?.type);

  switch (category) {
    case 'breathing':
      return { runnable: true, runtime: 'generic_breathing', reason: null };
    case 'visualization':
      return { runnable: true, runtime: 'generic_prompt', reason: null };
    case 'mindset':
      return { runnable: true, runtime: 'generic_prompt', reason: null };
    case 'confidence':
      return { runnable: true, runtime: 'generic_prompt', reason: null };
    case 'focus':
      if (focusType === 'reset' || normalizeString(exercise.id) === 'focus-3-second-reset') {
        return { runnable: true, runtime: 'custom_reset_switch', reason: null };
      }
      return { runnable: true, runtime: 'generic_focus', reason: null };
    default:
      return {
        runnable: false,
        runtime: 'unsupported',
        reason: `Unsupported iOS exercise category: ${exercise.category || 'unknown'}.`,
      };
  }
}

function resolveIOSExercise({ legacyExerciseId, simSpecId, titleCandidates }, indexes) {
  const directLegacy = indexes.allById.get(normalizeString(legacyExerciseId));
  if (directLegacy) {
    return {
      matchType: 'direct_legacy_id',
      matchedIdentifier: legacyExerciseId,
      exercise: directLegacy,
    };
  }

  const fallbackLegacyId = normalizedLegacyExerciseId(legacyExerciseId, simSpecId);
  if (fallbackLegacyId) {
    const fallbackLegacy = indexes.allById.get(normalizeString(fallbackLegacyId));
    if (fallbackLegacy) {
      return {
        matchType: 'fallback_family_bridge',
        matchedIdentifier: fallbackLegacyId,
        exercise: fallbackLegacy,
      };
    }
  }

  const directSimSpec = firstMatch(indexes.allBySimSpec, simSpecId);
  if (directSimSpec) {
    return {
      matchType: 'direct_sim_spec',
      matchedIdentifier: simSpecId,
      exercise: directSimSpec,
    };
  }

  const humanizedSimSpec = simSpecId ? humanizeLabel(simSpecId) : '';
  const humanizedSimSpecMatch = humanizedSimSpec
    ? firstMatch(indexes.allByName, humanizedSimSpec)
    : null;
  if (humanizedSimSpecMatch) {
    return {
      matchType: 'humanized_sim_name',
      matchedIdentifier: humanizedSimSpec,
      exercise: humanizedSimSpecMatch,
    };
  }

  const candidates = Array.from(new Set((titleCandidates || []).filter(Boolean)));
  for (const candidate of candidates) {
    const activeNameMatch = firstMatch(indexes.activeByName, candidate);
    if (activeNameMatch) {
      return {
        matchType: 'title_name_match',
        matchedIdentifier: candidate,
        exercise: activeNameMatch,
      };
    }
  }

  return {
    matchType: 'unresolved',
    matchedIdentifier: null,
    exercise: null,
  };
}

function inferFamilyLabelFromValue(value) {
  const family = normalizedSimFamilyLabel(value);
  return family ? humanizeLabel(family) : '';
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildVariantTitleCandidates(variant, module) {
  return uniqueValues([
    module?.name,
    module?.variantSource?.variantName,
    module?.variantSource?.family,
    variant?.name,
    inferFamilyLabelFromValue(module?.id),
    inferFamilyLabelFromValue(module?.simSpecId),
    inferFamilyLabelFromValue(variant?.id),
    inferFamilyLabelFromValue(variant?.family),
  ]);
}

function buildSimReason({ variant, module, resolution, runtime, indexes }) {
  if (!variant?.publishedModuleId) {
    return 'Variant is not currently published to sim-modules.';
  }

  if (!module) {
    return `Variant points to publishedModuleId=${variant.publishedModuleId}, but that sim-modules record is missing.`;
  }

  if (resolution.exercise && runtime.reason) {
    return runtime.reason;
  }

  const directId = normalizeString(module.id);
  const directSimSpec = normalizeString(module.simSpecId);
  const bridge = normalizedLegacyExerciseId(module.id, module.simSpecId);
  const canonicalExerciseId =
    canonicalExerciseIdForFamily(module.id)
    || canonicalExerciseIdForFamily(module.simSpecId)
    || canonicalExerciseIdForFamily(variant.id)
    || canonicalExerciseIdForFamily(variant.family);
  const hasCanonicalExercise = canonicalExerciseId
    ? indexes.allById.has(normalizeString(canonicalExerciseId))
    : false;
  const moduleOnly = directId && !resolution.exercise;

  if (canonicalExerciseId && !hasCanonicalExercise) {
    return `Published sim belongs to ${variant.family || humanizeLabel(canonicalExerciseId)}, but the canonical iPhone bridge exercise ${canonicalExerciseId} is missing from production mental-exercises.`;
  }

  if (moduleOnly) {
    if (bridge) {
      return `Published sim resolves to sim-modules id ${module.id}, but the current iOS family bridge did not find a launchable mental-exercises asset.`;
    }

    return `Published sim resolves to sim-modules id ${module.id}, but the iPhone app still launches through mental-exercises and has no direct sim-modules runtime path or family bridge for this identifier.`;
  }

  if (directSimSpec && !resolution.exercise) {
    return `Published sim exposes simSpecId=${module.simSpecId}, but no mental-exercises record currently matches that simSpec on iOS.`;
  }

  return 'The current iOS resolver could not map this published sim to a launchable mental-exercises asset.';
}

function buildProtocolReason({ protocol, moduleById, resolution, runtime }) {
  if (protocol.publishStatus !== 'published' || protocol.isActive === false) {
    const parts = [];
    if (protocol.publishStatus !== 'published') {
      parts.push(`publishStatus=${protocol.publishStatus || 'draft'}`);
    }
    if (protocol.isActive === false) {
      parts.push('record is inactive');
    }
    return `Protocol is not currently live on iOS because ${parts.join(' and ')}.`;
  }

  if (resolution.exercise && runtime.reason) {
    return runtime.reason;
  }

  const legacyId = normalizeString(protocol.legacyExerciseId);
  if (!legacyId) {
    return 'Protocol has no bound legacyExerciseId/source asset.';
  }

  if (moduleById.has(legacyId) && !resolution.exercise) {
    return `Protocol is bound to sim-modules asset ${protocol.legacyExerciseId}, but the iPhone app still resolves protocol launches through mental-exercises.`;
  }

  return `Protocol binds to ${protocol.legacyExerciseId}, but no current iOS mental-exercises asset resolves from that identifier.`;
}

function buildSimAuditEntry(variant, module, indexes) {
  const published = Boolean(normalizeString(variant.publishedModuleId));
  const resolution = module
    ? resolveIOSExercise(
        {
          legacyExerciseId: module.id,
          simSpecId: module.simSpecId,
          titleCandidates: buildVariantTitleCandidates(variant, module),
        },
        indexes
      )
    : { matchType: 'unresolved', matchedIdentifier: null, exercise: null };
  const runtime = resolveExerciseRuntime(resolution.exercise);
  const runnable = published && Boolean(module) && runtime.runnable;

  return {
    kind: 'sim',
    variantId: variant.id,
    variantName: variant.name || '',
    family: variant.family || module?.variantSource?.family || '',
    published,
    publishedModuleId: variant.publishedModuleId || '',
    moduleId: module?.id || '',
    moduleSimSpecId: module?.simSpecId || '',
    moduleName: module?.name || '',
    engineKey: module?.engineKey || module?.buildArtifact?.engineKey || variant.engineKey || '',
    iosRunnable: runnable,
    iosRuntime: runnable ? runtime.runtime : null,
    resolutionType: resolution.matchType,
    resolvedExerciseId: resolution.exercise?.id || '',
    resolvedExerciseName: resolution.exercise?.name || '',
    blocker: runnable ? null : buildSimReason({ variant, module, resolution, runtime, indexes }),
  };
}

function buildProtocolAuditEntry(protocol, moduleById, indexes) {
  const live = protocol.publishStatus === 'published' && protocol.isActive !== false;
  const resolution = resolveIOSExercise(
    {
      legacyExerciseId: protocol.legacyExerciseId,
      simSpecId: null,
      titleCandidates: [protocol.label],
    },
    indexes
  );
  const runtime = resolveExerciseRuntime(resolution.exercise);
  const runnable = live && runtime.runnable;

  return {
    kind: 'protocol',
    protocolId: protocol.id,
    label: protocol.label || '',
    publishStatus: protocol.publishStatus || 'draft',
    isActive: protocol.isActive !== false,
    deliveryMode: protocol.deliveryMode || '',
    legacyExerciseId: protocol.legacyExerciseId || '',
    sourceAssetKind: indexes.allById.has(normalizeString(protocol.legacyExerciseId))
      ? 'mental-exercise'
      : moduleById.has(normalizeString(protocol.legacyExerciseId))
        ? 'sim-module'
        : 'missing',
    iosRunnable: runnable,
    iosRuntime: runnable ? runtime.runtime : null,
    resolutionType: resolution.matchType,
    resolvedExerciseId: resolution.exercise?.id || '',
    resolvedExerciseName: resolution.exercise?.name || '',
    blocker: runnable ? null : buildProtocolReason({ protocol, moduleById, resolution, runtime }),
  };
}

function formatBoolean(value) {
  return value ? 'yes' : 'no';
}

function formatCell(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function buildTable(rows, columns) {
  if (!rows.length) return '(none)';

  const widths = columns.map((column) => {
    return Math.max(
      column.label.length,
      ...rows.map((row) => formatCell(row[column.key]).length)
    );
  });

  const header = columns
    .map((column, index) => column.label.padEnd(widths[index], ' '))
    .join(' | ');
  const separator = widths.map((width) => '-'.repeat(width)).join('-|-');
  const body = rows.map((row) => (
    columns
      .map((column, index) => formatCell(row[column.key]).padEnd(widths[index], ' '))
      .join(' | ')
  ));

  return [header, separator, ...body].join('\n');
}

async function fetchCollection(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function compactSummary(simAudit, protocolAudit, exercises) {
  const publishedSims = simAudit.filter((entry) => entry.published);
  const liveProtocols = protocolAudit.filter((entry) => entry.publishStatus === 'published' && entry.isActive);
  const mentalExerciseSimSpecCount = exercises.filter((exercise) => normalizeString(exercise.simSpecId)).length;

  return {
    fetchedAt: new Date().toISOString(),
    collections: {
      mentalExercises: exercises.length,
      mentalExercisesWithSimSpecId: mentalExerciseSimSpecCount,
      simVariants: simAudit.length,
      publishedSimVariants: publishedSims.length,
      protocols: protocolAudit.length,
      liveProtocols: liveProtocols.length,
    },
    iosLaunchModel: {
      directCollectionsRead: ['mental-exercises'],
      simModulesReadDirectlyOnIPhone: false,
      protocolRuntimeRegistryReadDirectlyOnIPhone: false,
      customRuntimeFamilies: ['focus reset'],
      genericRuntimeCategories: ['breathing', 'visualization', 'focus', 'mindset', 'confidence'],
      hardCodedSimFamilyBridges: ['reset', 'noise-gate', 'brake-point', 'signal-window', 'sequence-shift', 'endurance-lock'],
    },
    sims: {
      runnable: publishedSims.filter((entry) => entry.iosRunnable).length,
      blocked: publishedSims.filter((entry) => !entry.iosRunnable).length,
      unpublished: simAudit.filter((entry) => !entry.published).length,
    },
    protocols: {
      runnable: liveProtocols.filter((entry) => entry.iosRunnable).length,
      blocked: liveProtocols.filter((entry) => !entry.iosRunnable).length,
      notLive: protocolAudit.filter((entry) => !(entry.publishStatus === 'published' && entry.isActive)).length,
    },
  };
}

function renderTextReport(summary, simAudit, protocolAudit) {
  const publishedRunnableSims = simAudit.filter((entry) => entry.published && entry.iosRunnable);
  const publishedBlockedSims = simAudit.filter((entry) => entry.published && !entry.iosRunnable);
  const unpublishedSims = simAudit.filter((entry) => !entry.published);

  const runnableProtocols = protocolAudit.filter((entry) => entry.publishStatus === 'published' && entry.isActive && entry.iosRunnable);
  const blockedProtocols = protocolAudit.filter((entry) => entry.publishStatus === 'published' && entry.isActive && !entry.iosRunnable);
  const notLiveProtocols = protocolAudit.filter((entry) => !(entry.publishStatus === 'published' && entry.isActive));

  return [
    'PulseCheck iOS runtime audit',
    `Fetched: ${summary.fetchedAt}`,
    '',
    'Summary',
    `- mental-exercises: ${summary.collections.mentalExercises}`,
    `- mental-exercises with simSpecId populated: ${summary.collections.mentalExercisesWithSimSpecId}`,
    `- sim-variants: ${summary.collections.simVariants} total / ${summary.collections.publishedSimVariants} published`,
    `- published sim variants runnable on iPhone: ${summary.sims.runnable}`,
    `- published sim variants blocked on iPhone: ${summary.sims.blocked}`,
    `- published live protocols runnable on iPhone: ${summary.protocols.runnable}`,
    `- published live protocols blocked on iPhone: ${summary.protocols.blocked}`,
    '',
    'iPhone launch model',
    '- Direct data source: mental-exercises',
    '- No first-class iPhone sim-modules runtime loader exists today',
    '- No first-class iPhone protocol-runtime loader exists today',
    '- Custom runtime: focus reset only',
    '- Generic runtime covers breathing, visualization, focus, mindset, confidence',
    '- Hard-coded family bridges currently exist for reset, noise-gate, brake-point, signal-window, sequence-shift, endurance-lock',
    '',
    'Published sim variants runnable on iPhone',
    buildTable(
      publishedRunnableSims.map((entry) => ({
        family: entry.family,
        variantId: entry.variantId,
        moduleId: entry.moduleId,
        simSpecId: entry.moduleSimSpecId,
        resolution: entry.resolutionType,
        exercise: entry.resolvedExerciseId,
        runtime: entry.iosRuntime,
      })),
      [
        { key: 'family', label: 'family' },
        { key: 'variantId', label: 'variantId' },
        { key: 'moduleId', label: 'moduleId' },
        { key: 'simSpecId', label: 'simSpecId' },
        { key: 'resolution', label: 'resolution' },
        { key: 'exercise', label: 'exercise' },
        { key: 'runtime', label: 'runtime' },
      ]
    ),
    '',
    'Published sim variants blocked on iPhone',
    buildTable(
      publishedBlockedSims.map((entry) => ({
        family: entry.family,
        variantId: entry.variantId,
        moduleId: entry.moduleId,
        simSpecId: entry.moduleSimSpecId,
        blocker: entry.blocker,
      })),
      [
        { key: 'family', label: 'family' },
        { key: 'variantId', label: 'variantId' },
        { key: 'moduleId', label: 'moduleId' },
        { key: 'simSpecId', label: 'simSpecId' },
        { key: 'blocker', label: 'blocker' },
      ]
    ),
    '',
    'Unpublished sim variants',
    buildTable(
      unpublishedSims.map((entry) => ({
        family: entry.family,
        variantId: entry.variantId,
        published: formatBoolean(entry.published),
        blocker: entry.blocker,
      })),
      [
        { key: 'family', label: 'family' },
        { key: 'variantId', label: 'variantId' },
        { key: 'published', label: 'published' },
        { key: 'blocker', label: 'blocker' },
      ]
    ),
    '',
    'Published live protocols runnable on iPhone',
    buildTable(
      runnableProtocols.map((entry) => ({
        protocolId: entry.protocolId,
        label: entry.label,
        legacyExerciseId: entry.legacyExerciseId,
        sourceAssetKind: entry.sourceAssetKind,
        resolution: entry.resolutionType,
        exercise: entry.resolvedExerciseId,
        runtime: entry.iosRuntime,
      })),
      [
        { key: 'protocolId', label: 'protocolId' },
        { key: 'label', label: 'label' },
        { key: 'legacyExerciseId', label: 'legacyExerciseId' },
        { key: 'sourceAssetKind', label: 'sourceAssetKind' },
        { key: 'resolution', label: 'resolution' },
        { key: 'exercise', label: 'exercise' },
        { key: 'runtime', label: 'runtime' },
      ]
    ),
    '',
    'Published live protocols blocked on iPhone',
    buildTable(
      blockedProtocols.map((entry) => ({
        protocolId: entry.protocolId,
        label: entry.label,
        deliveryMode: entry.deliveryMode,
        legacyExerciseId: entry.legacyExerciseId,
        sourceAssetKind: entry.sourceAssetKind,
        blocker: entry.blocker,
      })),
      [
        { key: 'protocolId', label: 'protocolId' },
        { key: 'label', label: 'label' },
        { key: 'deliveryMode', label: 'deliveryMode' },
        { key: 'legacyExerciseId', label: 'legacyExerciseId' },
        { key: 'sourceAssetKind', label: 'sourceAssetKind' },
        { key: 'blocker', label: 'blocker' },
      ]
    ),
    '',
    'Protocols not currently live',
    buildTable(
      notLiveProtocols.map((entry) => ({
        protocolId: entry.protocolId,
        label: entry.label,
        publishStatus: entry.publishStatus,
        isActive: formatBoolean(entry.isActive),
      })),
      [
        { key: 'protocolId', label: 'protocolId' },
        { key: 'label', label: 'label' },
        { key: 'publishStatus', label: 'publishStatus' },
        { key: 'isActive', label: 'isActive' },
      ]
    ),
  ].join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  initializeAdmin(options);
  const db = admin.firestore();

  const [mentalExercises, simVariants, simModules, protocols] = await Promise.all([
    fetchCollection(db, 'mental-exercises'),
    fetchCollection(db, 'sim-variants'),
    fetchCollection(db, 'sim-modules'),
    fetchCollection(db, 'pulsecheck-protocols'),
  ]);

  const indexes = buildExerciseIndexes(mentalExercises);
  const moduleById = new Map(
    simModules.map((module) => [normalizeString(module.id), module])
  );

  let simAudit = simVariants.map((variant) => {
    const module = moduleById.get(normalizeString(variant.publishedModuleId));
    return buildSimAuditEntry(variant, module, indexes);
  });

  let protocolAudit = protocols.map((protocol) =>
    buildProtocolAuditEntry(protocol, moduleById, indexes)
  );

  simAudit = simAudit.sort((left, right) => {
    if (left.published !== right.published) return left.published ? -1 : 1;
    if (left.iosRunnable !== right.iosRunnable) return left.iosRunnable ? -1 : 1;
    return left.variantId.localeCompare(right.variantId);
  });

  protocolAudit = protocolAudit.sort((left, right) => {
    const leftLive = left.publishStatus === 'published' && left.isActive;
    const rightLive = right.publishStatus === 'published' && right.isActive;
    if (leftLive !== rightLive) return leftLive ? -1 : 1;
    if (left.iosRunnable !== right.iosRunnable) return left.iosRunnable ? -1 : 1;
    return left.protocolId.localeCompare(right.protocolId);
  });

  if (!options.includeUnpublished) {
    simAudit = simAudit.filter((entry) => entry.published);
    protocolAudit = protocolAudit.filter((entry) => entry.publishStatus === 'published' && entry.isActive);
  }

  const summary = compactSummary(simAudit, protocolAudit, mentalExercises);

  if (options.json) {
    console.log(JSON.stringify({ summary, sims: simAudit, protocols: protocolAudit }, null, 2));
    return;
  }

  console.log(renderTextReport(summary, simAudit, protocolAudit));
}

main().catch((error) => {
  console.error('[audit-pulsecheck-ios-runtime-live] Failed:', error?.stack || error?.message || String(error));
  process.exit(1);
});
