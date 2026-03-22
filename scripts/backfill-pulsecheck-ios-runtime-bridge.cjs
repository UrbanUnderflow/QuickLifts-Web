#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CANONICAL_BRIDGE_EXERCISES = [
  {
    id: 'focus-3-second-reset',
    family: 'Reset',
    simSpecId: 'reset',
    name: 'Reset',
    description: 'Mental recovery training — how fast can you recover after something goes wrong? Reset simulates disruption, measures your recovery time, and tracks improvement over sessions. The single most important mental skill in competitive athletics.',
    category: 'focus',
    difficulty: 'beginner',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'reset',
        duration: 180,
        progressionLevel: 1,
        instructions: ['Train your mental recovery speed through disruption-recovery cycles'],
      },
    },
    benefits: [
      'Faster mental recovery from mistakes',
      'Disruption resilience under pressure',
      'Consistency in high-stakes moments',
      'Measurable improvement over time',
    ],
    bestFor: ['mistake recovery', 'pre-competition', 'in-season training', 'pressure performance'],
    origin: 'Grounded in Attentional Control Theory and disruption-recovery training used in elite performance settings.',
    neuroscience: 'Reset targets executive control after disruption and helps shorten the gap between a mistake and re-engaged execution.',
    overview: {
      when: 'Regular training sessions, pre-competition preparation',
      focus: 'How fast you bounce back after something breaks your concentration',
      timeScale: '2-4 minutes (5-7 rounds)',
      skill: 'Disruption recovery speed',
      analogy: 'Like flipping the circuit breaker back on after overload.',
    },
    iconName: 'zap',
    isActive: true,
    sortOrder: 23,
  },
  {
    id: 'focus-noise-gate',
    family: 'Noise Gate',
    simSpecId: 'noise_gate',
    name: 'Noise Gate',
    description: 'Train selective attention by locking onto the live signal while visual and audio clutter compete for your focus.',
    category: 'focus',
    difficulty: 'intermediate',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'distraction',
        duration: 180,
        progressionLevel: 2,
        instructions: ['Filter noise, ignore decoys, and hold the right cue under clutter.'],
      },
    },
    benefits: [
      'Improves cue filtering under clutter',
      'Builds tolerance for audio and visual distraction',
      'Sharpens selective attention under time pressure',
    ],
    bestFor: ['crowd noise', 'visual clutter', 'distraction control', 'recognition speed'],
    origin: 'Built from attention-systems research and sport concentration training used to help athletes ignore bait, clutter, and crowd noise.',
    neuroscience: 'Noise Gate targets attentional selection by preserving task-relevant information while suppressing distractors.',
    overview: {
      when: 'Before noisy competition environments or when athletes are losing the right cue to clutter',
      focus: 'Selective attention under distraction',
      timeScale: '2-4 minutes',
      skill: 'Holding the live signal while noise rises',
      analogy: 'Like tuning a radio until only the station you need comes through clearly.',
    },
    iconName: 'radio',
    isActive: true,
    sortOrder: 24,
  },
  {
    id: 'decision-brake-point',
    family: 'Brake Point',
    simSpecId: 'brake_point',
    name: 'Brake Point',
    description: 'Train impulse control by cancelling the wrong move fast enough to avoid compounding the mistake.',
    category: 'focus',
    difficulty: 'intermediate',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'cue_word',
        duration: 150,
        progressionLevel: 2,
        instructions: ['Read go / no-go conflict quickly and brake before the false move completes.'],
      },
    },
    benefits: [
      'Reduces impulsive errors',
      'Improves cancellation speed',
      'Builds cleaner response inhibition under pressure',
    ],
    bestFor: ['fake-outs', 'false starts', 'impulsive decisions', 'decision control'],
    origin: 'Grounded in executive-function research on inhibitory control and adapted for pressure-heavy sport decisions.',
    neuroscience: 'Brake Point trains rapid suppression of prepotent responses before error cascades can form.',
    overview: {
      when: 'When athletes are overcommitting, biting on fakes, or false-starting',
      focus: 'Stopping the wrong action fast',
      timeScale: '2-3 minutes',
      skill: 'Response inhibition',
      analogy: 'Like hitting the brakes before a skid turns into a crash.',
    },
    iconName: 'octagon-x',
    isActive: true,
    sortOrder: 25,
  },
  {
    id: 'decision-signal-window',
    family: 'Signal Window',
    simSpecId: 'signal_window',
    name: 'Signal Window',
    description: 'Compress the decision window and force the athlete to choose the real cue before the opportunity disappears.',
    category: 'focus',
    difficulty: 'intermediate',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 165,
        progressionLevel: 2,
        instructions: ['Pick the live signal, reject decoys, and decide before the window closes.'],
      },
    },
    benefits: [
      'Improves read-and-react speed',
      'Sharpens cue discrimination',
      'Reduces decoy susceptibility',
    ],
    bestFor: ['tight reads', 'recognition speed', 'ambiguous cues', 'decision clarity'],
    origin: 'Inspired by perceptual-cognitive training work on cue discrimination and fast decision-making.',
    neuroscience: 'Signal Window strengthens the link between selective attention and decisive action under compressed time windows.',
    overview: {
      when: 'For athletes who know what to do but do not read it fast enough',
      focus: 'Correct reads under tight time pressure',
      timeScale: '2-3 minutes',
      skill: 'Cue discrimination',
      analogy: 'Like catching the green light before it turns red.',
    },
    iconName: 'scan-eye',
    isActive: true,
    sortOrder: 26,
  },
  {
    id: 'decision-sequence-shift',
    family: 'Sequence Shift',
    simSpecId: 'sequence_shift',
    name: 'Sequence Shift',
    description: 'Force quick adaptation when rules or priorities change mid-rep so the athlete can re-stabilize without freezing.',
    category: 'focus',
    difficulty: 'advanced',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'distraction',
        duration: 180,
        progressionLevel: 3,
        instructions: ['Hold the sequence, update the rule, and keep executing after the switch.'],
      },
    },
    benefits: [
      'Improves working-memory updating',
      'Builds faster re-stabilization after rule changes',
      'Strengthens mental flexibility',
    ],
    bestFor: ['audibles', 'assignment changes', 'install work', 'rule switching'],
    origin: 'Grounded in executive-function research on updating and attentional shifting.',
    neuroscience: 'Sequence Shift trains working-memory updating and attentional shifting so athletes can preserve structure through change.',
    overview: {
      when: 'When athletes struggle after audibles, changed assignments, or late instructions',
      focus: 'Maintaining execution through rule change',
      timeScale: '3 minutes',
      skill: 'Working-memory updating',
      analogy: 'Like changing lanes at speed without losing control of the car.',
    },
    iconName: 'shuffle',
    isActive: true,
    sortOrder: 27,
  },
  {
    id: 'focus-endurance-lock',
    family: 'Endurance Lock',
    simSpecId: 'endurance_lock',
    name: 'Endurance Lock',
    description: 'Extended focus rep designed to expose late-session lapses, variance, and fatigue-driven decision decay.',
    category: 'focus',
    difficulty: 'advanced',
    durationMinutes: 6,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 360,
        progressionLevel: 4,
        instructions: ['Stay locked in as time-on-task accumulates and the rep gets mentally heavier.'],
      },
    },
    benefits: [
      'Reveals fatigability',
      'Measures late-session sharpness',
      'Builds sustained attention under accumulating load',
    ],
    bestFor: ['late-game focus', 'fatigability', 'consistency', 'extended reps'],
    origin: 'Built from concentration training and mental-fatigue literature on time-on-task breakdown.',
    neuroscience: 'Endurance Lock measures how quickly performance decays as cognitive load accumulates.',
    overview: {
      when: 'Periodic stress tests and high-value reassessment days',
      focus: 'Degradation slope over time',
      timeScale: '5-8 minutes',
      skill: 'Sustained attention under fatigue',
      analogy: 'Like checking whether your mechanics still hold in the fourth quarter.',
    },
    iconName: 'timer-reset',
    isActive: true,
    sortOrder: 28,
  },
];

function parseArgs(argv) {
  const options = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1',
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    repoRoot: path.resolve(__dirname, '..'),
    dryRun: true,
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

    if (arg === '--write') {
      options.dryRun = false;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
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
      '  node scripts/backfill-pulsecheck-ios-runtime-bridge.cjs [--project <projectId>] [--service-account <path>] [--write]',
      '',
      'What it does:',
      '  - Reads live published sim-modules',
      '  - Detects which sim families are live in production',
      '  - Upserts the canonical iOS bridge exercises into mental-exercises',
      '',
      'Defaults:',
      '  - Dry-run mode',
      '',
      'Examples:',
      '  node scripts/backfill-pulsecheck-ios-runtime-bridge.cjs',
      '  node scripts/backfill-pulsecheck-ios-runtime-bridge.cjs --write',
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
  } catch (_error) {
    return '';
  }
}

function hydrateFirebaseEnvFromNetlify(repoRoot) {
  ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_SECRET_KEY'].forEach((name) => {
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

function isPublishedSimModule(record) {
  return Boolean(
    record
    && record.isActive !== false
    && typeof record.publishedFingerprint === 'string'
    && record.publishedFingerprint.trim()
    && (
      Number.isFinite(record.variantSource?.publishedAt)
      || typeof record.syncStatus === 'string'
    )
  );
}

function createBridgePayload(definition, existingDoc) {
  const now = Date.now();
  const existingData = existingDoc && existingDoc.exists ? (existingDoc.data() || {}) : {};

  return {
    ...definition,
    bridgeSource: 'pulsecheck_ios_runtime_bridge_v1',
    bridgeSyncedAt: now,
    createdAt: existingData.createdAt || definition.createdAt || now,
    updatedAt: now,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const app = initializeAdmin(options);
  const db = admin.firestore(app);

  const simModulesSnapshot = await db.collection('sim-modules').get();
  const publishedFamilies = new Set();

  simModulesSnapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (!isPublishedSimModule(data)) {
      return;
    }

    const familyLabel =
      data.variantSource?.family
      || data.buildArtifact?.family
      || '';

    const normalizedFamily = normalizeString(familyLabel);
    if (normalizedFamily) {
      publishedFamilies.add(normalizedFamily);
    }
  });

  const targetedExercises = CANONICAL_BRIDGE_EXERCISES.filter((exercise) =>
    publishedFamilies.has(normalizeString(exercise.family))
  );

  console.log(`Project: ${options.projectId}`);
  console.log(`Mode: ${options.dryRun ? 'dry-run' : 'write'}`);
  console.log(`Published sim families detected: ${publishedFamilies.size}`);
  console.log(`Canonical bridge exercises targeted: ${targetedExercises.length}`);

  if (!targetedExercises.length) {
    console.log('No published sim families found. Nothing to do.');
    return;
  }

  let writeBatch = db.batch();
  let pendingWrites = 0;
  const operations = [];

  for (const exercise of targetedExercises) {
    const ref = db.collection('mental-exercises').doc(exercise.id);
    const existingDoc = await ref.get();
    const payload = createBridgePayload(exercise, existingDoc);
    const operation = existingDoc.exists ? 'upsert' : 'create';

    operations.push({
      operation,
      id: exercise.id,
      family: exercise.family,
      simSpecId: exercise.simSpecId,
      existing: existingDoc.exists,
    });

    if (!options.dryRun) {
      writeBatch.set(ref, payload, { merge: true });
      pendingWrites += 1;

      if (pendingWrites >= 400) {
        await writeBatch.commit();
        writeBatch = db.batch();
        pendingWrites = 0;
      }
    }
  }

  operations.forEach((entry) => {
    console.log(
      `[${entry.operation}] ${entry.id} (${entry.family}) simSpecId=${entry.simSpecId} existing=${entry.existing}`
    );
  });

  if (!options.dryRun && pendingWrites > 0) {
    await writeBatch.commit();
  }

  console.log(options.dryRun ? 'Dry-run complete.' : 'Backfill complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
