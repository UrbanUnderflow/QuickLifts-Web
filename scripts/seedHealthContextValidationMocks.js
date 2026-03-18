#!/usr/bin/env node

/**
 * Seed representative mock daily-health-summaries for health-context validation.
 *
 * The scenarios are inspired by real production summary shapes, but anonymized and
 * simplified so we can safely validate the bridge + parity pipeline in dev.
 *
 * Usage:
 *   node scripts/seedHealthContextValidationMocks.js --dry-run
 *   node scripts/seedHealthContextValidationMocks.js --project=quicklifts-dev-01
 *   node scripts/seedHealthContextValidationMocks.js --project=quicklifts-dev-01 --force
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const fetch = require('node-fetch');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const LEGACY_COLLECTION = 'daily-health-summaries';

function parseArgs(argv) {
  const args = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    project: 'quicklifts-dev-01',
  };

  for (const arg of argv) {
    if (arg.startsWith('--project=')) {
      args.project = arg.split('=')[1];
    }
  }

  return args;
}

function buildAdminApp(projectId) {
  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    return null;
  }

  return initializeApp({
    projectId,
    credential: cert(require(keyPath)),
  }, `health-context-validation-mocks-${projectId}`);
}

function toFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((entry) => toFirestoreValue(entry)) } };
  }
  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.entries(value).reduce((result, [key, entry]) => {
          if (entry !== undefined) {
            result[key] = toFirestoreValue(entry);
          }
          return result;
        }, {}),
      },
    };
  }

  return { nullValue: null };
}

function toFirestoreDocument(data) {
  return {
    fields: Object.entries(data).reduce((result, [key, value]) => {
      if (value !== undefined) {
        result[key] = toFirestoreValue(value);
      }
      return result;
    }, {}),
  };
}

function buildRestClient(projectId) {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  function getAccessToken() {
    return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
  }

  async function request(method, url, body) {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${url} failed (${response.status}): ${text}`);
    }

    if (response.status === 204) {
      return {};
    }

    return response.json();
  }

  return {
    kind: 'rest',
    async getDocument(collection, id) {
      const doc = await request('GET', `${baseUrl}/${collection}/${id}`);
      return doc ? { exists: true, raw: doc } : null;
    },
    async setDocument(collection, id, data) {
      await request('PATCH', `${baseUrl}/${collection}/${id}`, toFirestoreDocument(data));
    },
  };
}

function buildClient(projectId) {
  const adminApp = buildAdminApp(projectId);
  if (adminApp) {
    const db = getFirestore(adminApp);
    return {
      kind: 'admin',
      async getDocument(collection, id) {
        const doc = await db.collection(collection).doc(id).get();
        return doc.exists ? { exists: true, raw: doc.data() } : null;
      },
      async setDocument(collection, id, data) {
        await db.collection(collection).doc(id).set(data, { merge: true });
      },
    };
  }

  return buildRestClient(projectId);
}

function baseSummary({ userId, dateKey, date, createdAt, updatedAt, lastSyncTimestamp }) {
  return {
    id: `${userId}_${dateKey}`,
    userId,
    date,
    createdAt,
    updatedAt,
    lastSyncTimestamp,
    dataSourcesUsed: ['HealthKit', 'Pulse'],
    workoutRatings: [],
    workoutSummaries: [],
    primaryBodyPartsWorked: [],
    meals: [],
    mealCount: 0,
    caloriesConsumed: 0,
    proteinConsumed: 0,
    carbsConsumed: 0,
    fatConsumed: 0,
    fiberConsumed: 0,
    sugarConsumed: 0,
    sodiumConsumed: 0,
    cholesterolConsumed: 0,
    calciumConsumed: 0,
    ironConsumed: 0,
    vitaminCConsumed: 0,
    vitaminDConsumed: 0,
    waterIntake: null,
    calorieGoal: null,
    proteinGoal: null,
    carbGoal: null,
    fatGoal: null,
    calorieDeficitSurplus: 0,
    macroBalance: '',
    hasCalorieGaps: false,
    calorieDataCompleteness: 'complete',
    totalCalories: 0,
    activeCalories: 0,
    restingCalories: null,
    steps: 0,
    distance: 0,
    exerciseMinutes: 0,
    standHours: 0,
    sleepDuration: 0,
    deepSleepDuration: 0,
    remSleepDuration: 0,
    sleepEfficiency: 0,
    timeInBedHours: null,
    heartRateMin: null,
    heartRateMax: null,
    heartRateResting: null,
    heartRateVariability: null,
    heartRateAvg: null,
    bodyWeight: null,
    bodyFatPercentage: null,
    muscleMass: null,
    bodyWaterPercentage: null,
    vo2Max: null,
    respiratoryRate: null,
    oxygenSaturation: null,
    mindfulnessMinutes: 0,
    workoutCount: 0,
    totalWeightLifted: 0,
    totalSetsCompleted: 0,
    totalRepsCompleted: 0,
    totalExercisesCompleted: 0,
    deepAnalysisGeneratedAt: 0,
  };
}

function buildScenarios() {
  return [
    (() => {
      const userId = 'mockHealthCtxTraining001';
      const dateKey = '2026-03-03';
      const summary = baseSummary({
        userId,
        dateKey,
        date: 1772514000,
        createdAt: 1772552301.944243,
        updatedAt: 1772552301.9442439,
        lastSyncTimestamp: 1772552301.945097,
      });
      return {
        description: 'Workout-heavy training day with detailed workout summaries',
        summary: {
          ...summary,
          workoutCount: 5,
          totalWeightLifted: 1000,
          totalSetsCompleted: 5,
          totalRepsCompleted: 52,
          totalExercisesCompleted: 3,
          steps: 4218,
          distance: 2.84,
          exerciseMinutes: 61,
          standHours: 6,
          activeCalories: 312.5,
          totalCalories: 1788.2,
          primaryBodyPartsWorked: ['back', 'biceps', 'chest', 'deltoids', 'triceps'],
          workoutSummaries: [
            {
              id: 'mock-workout-1',
              workoutTitle: 'Upper Body Power',
              caloriesBurned: 247,
              completedAt: 1772552297.5463619,
              bodyParts: ['chest', 'back', 'biceps'],
            },
            {
              id: 'mock-workout-2',
              workoutTitle: 'Accessory Finisher',
              caloriesBurned: 65,
              completedAt: 1772551297.5463619,
              bodyParts: ['deltoids', 'triceps'],
            },
          ],
        },
      };
    })(),
    (() => {
      const userId = 'mockHealthCtxRecovery001';
      const dateKey = '2025-09-12';
      const summary = baseSummary({
        userId,
        dateKey,
        date: 1757649600,
        createdAt: 1757710597.9586921,
        updatedAt: 1757710597.9586921,
        lastSyncTimestamp: 1757710597.95872,
      });
      return {
        description: 'Wearable-driven recovery and activity day',
        summary: {
          ...summary,
          steps: 3736,
          distance: 2.8108348186176153,
          exerciseMinutes: 54,
          standHours: 8,
          activeCalories: 272.26500000000004,
          totalCalories: 1845.1260000000002,
          heartRateVariability: 29.668991578325556,
          heartRateResting: 80,
          heartRateMax: 126,
          heartRateAvg: 95.687128918473292,
          oxygenSaturation: 95.333333333333329,
          respiratoryRate: 16.8,
        },
      };
    })(),
    (() => {
      const userId = 'mockHealthCtxActivity001';
      const dateKey = '2025-09-22';
      const summary = baseSummary({
        userId,
        dateKey,
        date: 1758513600,
        createdAt: 1758576287.0115871,
        updatedAt: 1758576287.0115871,
        lastSyncTimestamp: 1758576287.011647,
      });
      return {
        description: 'High-steps activity day with sparse recovery and no workouts',
        summary: {
          ...summary,
          steps: 10252,
          distance: 6.544134389794082,
          exerciseMinutes: 47,
          activeCalories: 237.70899999999997,
          totalCalories: 1487.567,
        },
      };
    })(),
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = buildClient(args.project);
  const scenarios = buildScenarios();

  console.log('Seed health-context validation mocks');
  console.log(`Project: ${args.project}`);
  console.log(`Auth mode: ${client.kind === 'admin' ? 'serviceAccountKey.json' : 'gcloud access token'}`);
  if (args.dryRun) console.log('Mode: DRY RUN');
  if (args.force) console.log('Force: enabled');
  console.log(`Scenarios: ${scenarios.length}`);

  let seeded = 0;
  let skipped = 0;

  for (const scenario of scenarios) {
    const { summary, description } = scenario;
    const existing = await client.getDocument(LEGACY_COLLECTION, summary.id);
    if (existing && !args.force) {
      skipped += 1;
      console.log(`[skip] ${summary.id} (${description})`);
      continue;
    }

    if (args.dryRun) {
      seeded += 1;
      console.log(`[dry-run] would seed ${summary.id} (${description})`);
      continue;
    }

    await client.setDocument(LEGACY_COLLECTION, summary.id, summary);
    seeded += 1;
    console.log(`[write] seeded ${summary.id} (${description})`);
  }

  console.log('\nDone.');
  console.log(args.dryRun ? `Would seed: ${seeded}` : `Seeded: ${seeded}`);
  console.log(`Skipped existing: ${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
