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
    description: 'Match left and right arrows before and after brief interruptions. Reset compares task response time and accuracy across otherwise matched trials.',
    category: 'focus',
    difficulty: 'beginner',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'reset',
        duration: 180,
        progressionLevel: 1,
        instructions: ['Match each arrow direction; after an interruption and fixed reset interval, return to the same arrow task'],
      },
    },
    benefits: [
      'Practice returning to the same rule after an interruption',
      'Compare reference and post-interruption task responses',
      'Keep response time and accuracy visible as separate observations',
      'Repeat a consistent reset-and-return routine',
    ],
    bestFor: ['interruption practice', 'task return', 'matched-condition reassessment', 'reset routine rehearsal'],
    origin: 'Evidence-informed by experimental work on post-error behavior, attentional reorientation, and task switching. The PulseCheck task itself has not yet been externally validated.',
    neuroscience: 'The task observes response-time and accuracy differences on the same arrow rule before and after an interruption. It does not directly measure emotional recovery, resilience, readiness, or a particular brain process.',
    overview: {
      when: 'Regular training sessions, pre-competition preparation',
      focus: 'Returning to the same left-or-right rule after a brief interruption',
      timeScale: '2-4 minutes (matched reference and post-interruption trials)',
      skill: 'Attentional reorientation and task return',
      analogy: 'The same arrow task appears before and after an interruption so the two conditions can be compared.',
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
    description: 'Find the called number while a flashing marker or crowd sound tries to pull your attention away.',
    category: 'focus',
    difficulty: 'intermediate',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'distraction',
        duration: 180,
        progressionLevel: 2,
        instructions: ['The number at the top stays visible. Find and tap that same number in the field. Ignore anything that flashes and any crowd sound.'],
      },
    },
    benefits: [
      'Practices visual search with a clear goal',
      'Adds audio and visual distractions without changing the task',
      'Tracks how accuracy and response time change when distractions appear',
    ],
    bestFor: ['crowd noise', 'visual distraction', 'goal-directed focus', 'visual search'],
    origin: 'Evidence-informed by Attentional Control Theory and visual-search inhibition training. The mobile task is a controlled attention drill, not proof of sport transfer.',
    neuroscience: 'The same visual-search task is performed with and without an attention-grabbing wrong cue. PulseCheck compares the conditions to estimate task-specific distraction effects.',
    overview: {
      when: 'Before noisy competition environments or when athletes are losing the right cue to clutter',
      focus: 'Finding the exact match while irrelevant cues compete for attention',
      timeScale: '2-4 minutes',
      skill: 'Goal-directed visual search under distraction',
      analogy: 'Like finding the teammate your coach called while the sideline is moving and the crowd is loud.',
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
    description: 'Match each arrow with left or right. On some trials, a delayed red STOP signal means withhold the response.',
    category: 'focus',
    difficulty: 'intermediate',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 150,
        progressionLevel: 2,
        instructions: ['Match left and right arrows. If a delayed STOP signal appears, do not tap.'],
      },
    },
    benefits: [
      'Practices withholding a prepared response after a delayed stop signal',
      'Reports go accuracy and stopping behavior separately',
      'Provides a provisional stopping-time estimate only when quality checks pass',
    ],
    bestFor: ['delayed-stop practice', 'response-inhibition reassessment', 'go accuracy', 'withholding behavior'],
    origin: 'Evidence-informed by the stop-signal paradigm and independent race-model research. PulseCheck task reliability and sport transfer have not yet been established.',
    neuroscience: 'The task creates a dominant left-or-right response and occasionally introduces a delayed signal to withhold it. Results remain task-specific and do not establish trait impulsivity or sport inhibition.',
    overview: {
      when: 'A focused response-inhibition practice or reassessment session',
      focus: 'Withholding an initiated arrow response after a delayed stop signal',
      timeScale: 'About 3-5 minutes including practice',
      skill: 'Task-specific response inhibition',
      analogy: 'Most arrows require a response; a late STOP signal changes the correct action to no response.',
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
    description: 'Read a field of nine arrows and choose whether most point left or right. Evidence strength changes across balanced trials.',
    category: 'focus',
    difficulty: 'intermediate',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 165,
        progressionLevel: 2,
        instructions: ['Choose left or right based on the direction shown by most arrows.'],
      },
    },
    benefits: [
      'Practices a two-choice visual discrimination',
      'Compares accuracy across declared evidence levels',
      'Keeps correct-response time separate from accuracy',
    ],
    bestFor: ['visual discrimination', 'evidence-strength practice', 'decision accuracy', 'correct-response timing'],
    origin: 'Evidence-informed by psychophysical research on sensory evidence strength, decision accuracy, and response time. The PulseCheck task and sport transfer remain unvalidated.',
    neuroscience: 'The arrow field varies how much visual evidence supports one direction. The task observes accuracy and response time from field onset; it does not establish game-day decision quality.',
    overview: {
      when: 'A focused visual-discrimination practice or reassessment session',
      focus: 'Choosing the majority direction as visual evidence changes',
      timeScale: '2-3 minutes',
      skill: 'Task-specific perceptual discrimination',
      analogy: 'Count the direction supported by most arrows, then choose left or right.',
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
    description: 'Use one pair of keys to classify letters and numbers. A cue tells you which rule applies, and scored trials balance rule repeats and switches.',
    category: 'focus',
    difficulty: 'advanced',
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'distraction',
        duration: 180,
        progressionLevel: 3,
        instructions: ['Use the letter or number rule shown. Left means vowel or odd; right means consonant or even.'],
      },
    },
    benefits: [
      'Practices switching between two cued classification rules',
      'Compares repeat and switch response time and accuracy',
      'Separates eligible old-rule responses from other errors',
    ],
    bestFor: ['cued rule switching', 'repeat-switch comparison', 'classification practice', 'task-switching reassessment'],
    origin: 'Evidence-informed by classic cued task-switching research. This is not a working-memory-capacity test, and broad flexibility or sport-transfer claims require validation.',
    neuroscience: 'The cue selects either a letter or number classification while response keys stay fixed. Repeat-versus-switch differences describe this task only.',
    overview: {
      when: 'A focused cued task-switching practice or reassessment session',
      focus: 'Applying a letter or number rule after a fixed cue interval',
      timeScale: '3 minutes',
      skill: 'Task-specific rule switching',
      analogy: 'The keys stay the same while the cue changes which part of the pair matters.',
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
    description: 'Wait for the same visual signal and tap once when it appears. The rule and display stay constant while waiting times vary across six blocks.',
    category: 'focus',
    difficulty: 'advanced',
    durationMinutes: 6,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 360,
        progressionLevel: 4,
        instructions: ['Wait for the center visual signal, then tap once. Taps before the signal are recorded separately.'],
      },
    },
    benefits: [
      'Observes response time across one constant visual task',
      'Reports variability, responses at or above 500 ms, early taps, and timeouts separately',
      'Describes within-session change without assigning a cause',
    ],
    bestFor: ['sustained-attention practice', 'visual response timing', 'within-session variability', 'longer reassessment sessions'],
    origin: 'Evidence-informed by psychomotor-vigilance and sustained-attention research. This short mobile task cannot identify fatigue, sleep loss, motivation, or sport transfer.',
    neuroscience: 'The task records visual response time over time while the rule and display remain constant. A change can have many causes, so the result is limited to this session.',
    overview: {
      when: 'Periodic sustained-attention practice or reassessment sessions',
      focus: 'Response-time change, variability, responses at or above 500 ms, early taps, and timeouts',
      timeScale: '5-8 minutes',
      skill: 'Task-specific sustained attention',
      analogy: 'The visual task stays the same so performance can be described across the session.',
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
