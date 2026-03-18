#!/usr/bin/env node

/**
 * Backfill canonical health-context collections from legacy daily-health-summaries.
 *
 * Usage:
 *   node scripts/backfillHealthContext.js --dry-run
 *   node scripts/backfillHealthContext.js --project=quicklifts-dev-01
 *   node scripts/backfillHealthContext.js --project=quicklifts-dev-01 --user-id=abc123
 *   node scripts/backfillHealthContext.js --project=quicklifts-dev-01 --limit=100
 *   node scripts/backfillHealthContext.js --project=quicklifts-dev-01 --force
 *
 * Auth:
 * - Prefers serviceAccountKey.json at the project root if present
 * - Falls back to Application Default Credentials
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const fetch = require('node-fetch');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const HEALTH_CONTEXT_COLLECTIONS = {
  sourceStatus: 'health-context-source-status',
  sourceRecords: 'health-context-source-records',
  snapshots: 'health-context-snapshots',
  snapshotRevisions: 'health-context-snapshot-revisions',
  assemblyTraces: 'health-context-assembly-traces',
  legacyDailySummaries: 'daily-health-summaries',
};

const CONTRACT_VERSIONS = {
  sourceRecord: 'health-context-source-record.v1',
  snapshot: 'athlete-health-context-snapshot.v1',
  snapshotRevision: 'health-context-snapshot-revision.v1',
  assemblyTrace: 'health-context-assembly-trace.v1',
};

function parseArgs(argv) {
  const args = {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    project: 'quicklifts-dev-01',
    timezone: 'America/New_York',
    limit: 0,
    userId: null,
  };

  for (const arg of argv) {
    if (arg.startsWith('--project=')) {
      args.project = arg.split('=')[1];
    } else if (arg.startsWith('--timezone=')) {
      args.timezone = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      args.limit = Math.max(0, parseInt(arg.split('=')[1], 10) || 0);
    } else if (arg.startsWith('--user-id=')) {
      args.userId = arg.split('=')[1] || null;
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
  }, `health-context-backfill-${projectId}`);
}

function makeFormatter(timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function snapshotDateKeyFromLegacy(summary, legacyId, formatter) {
  const suffix = `${summary.userId}_`;
  if (typeof legacyId === 'string' && legacyId.startsWith(suffix)) {
    return legacyId.slice(suffix.length);
  }

  return formatter.format(new Date((summary.date || 0) * 1000));
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => compactObject(entry));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, entry]) => {
      if (entry === undefined) {
        return result;
      }

      const compacted = compactObject(entry);
      if (compacted === undefined) {
        return result;
      }

      result[key] = compacted;
      return result;
    }, {});
  }

  return value;
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) {
    const fields = value.mapValue.fields || {};
    return Object.entries(fields).reduce((result, [key, entry]) => {
      result[key] = fromFirestoreValue(entry);
      return result;
    }, {});
  }
  if ('arrayValue' in value) {
    const values = value.arrayValue.values || [];
    return values.map((entry) => fromFirestoreValue(entry));
  }

  return null;
}

function toFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => toFirestoreValue(entry)),
      },
    };
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

function toFirestoreDocument(fieldsObject) {
  return {
    fields: Object.entries(fieldsObject).reduce((result, [key, value]) => {
      if (value !== undefined) {
        result[key] = toFirestoreValue(value);
      }
      return result;
    }, {}),
  };
}

function buildRestClient(projectId) {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  let cachedAccessToken = null;
  let cachedAccessTokenExpiresAt = 0;

  function getAccessToken() {
    const now = Date.now();
    if (cachedAccessToken && now < cachedAccessTokenExpiresAt) {
      return cachedAccessToken;
    }

    const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
    cachedAccessToken = token;
    // gcloud access tokens are typically valid for ~1 hour. Refresh a bit early.
    cachedAccessTokenExpiresAt = now + (45 * 60 * 1000);
    return token;
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
    async getLegacySummaries({ userId, limit }) {
      const where = userId ? {
        fieldFilter: {
          field: { fieldPath: 'userId' },
          op: 'EQUAL',
          value: { stringValue: userId },
        },
      } : null;
      const body = {
        structuredQuery: compactObject({
          from: [{ collectionId: HEALTH_CONTEXT_COLLECTIONS.legacyDailySummaries }],
          where,
          limit: limit || undefined,
        }),
      };
      const response = await request('POST', `${baseUrl}:runQuery`, body);
      return (response || [])
        .filter((entry) => entry.document)
        .map((entry) => ({
          id: entry.document.name.split('/').pop(),
          data: fromFirestoreValue({ mapValue: { fields: entry.document.fields || {} } }),
        }));
    },
    async getDocument(collection, id) {
      const doc = await request('GET', `${baseUrl}/${collection}/${id}`);
      if (!doc) return null;
      return {
        id,
        exists: true,
        data: fromFirestoreValue({ mapValue: { fields: doc.fields || {} } }),
      };
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
      async getLegacySummaries({ userId, limit }) {
        let query = db.collection(HEALTH_CONTEXT_COLLECTIONS.legacyDailySummaries);
        if (userId) {
          query = query.where('userId', '==', userId);
        }
        if (limit) {
          query = query.limit(limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
      },
      async getDocument(collection, id) {
        const doc = await db.collection(collection).doc(id).get();
        return doc.exists ? { id, exists: true, data: doc.data() } : null;
      },
      async setDocument(collection, id, data) {
        await db.collection(collection).doc(id).set(data, { merge: true });
      },
    };
  }

  return buildRestClient(projectId);
}

function parseDayWindow(snapshotDateKey, timezone) {
  const [year, month, day] = snapshotDateKey.split('-').map(Number);
  const middayUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const localGuess = new Date(middayUtc.toLocaleString('en-US', { timeZone: timezone }));
  const utcMidday = new Date(middayUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = localGuess.getTime() - utcMidday.getTime();

  const startUtc = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs;
  const endUtc = startUtc + 24 * 60 * 60 * 1000;

  return {
    startAt: startUtc / 1000,
    endAt: endUtc / 1000,
    timezone,
    windowType: 'daily',
  };
}

function hasTrainingData(summary) {
  return (summary.workoutCount || 0) > 0 ||
    (summary.totalWeightLifted || 0) > 0 ||
    (summary.totalExercisesCompleted || 0) > 0 ||
    (Array.isArray(summary.workoutSummaries) && summary.workoutSummaries.length > 0);
}

function hasRecoveryData(summary) {
  return (summary.sleepDuration || 0) > 0 ||
    (summary.heartRateResting || 0) > 0 ||
    (summary.heartRateVariability || 0) > 0 ||
    (summary.heartRateAvg || 0) > 0;
}

function hasActivityData(summary) {
  return (summary.steps || 0) > 0 ||
    (summary.activeCalories || 0) > 0 ||
    (summary.distance || 0) > 0 ||
    (summary.exerciseMinutes || 0) > 0;
}

function hasNutritionData(summary) {
  return (summary.mealCount || 0) > 0 ||
    (summary.caloriesConsumed || 0) > 0 ||
    (summary.waterIntake || 0) > 0;
}

function hasBiometricData(summary) {
  return summary.bodyWeight != null ||
    summary.bodyFatPercentage != null ||
    summary.vo2Max != null;
}

function freshnessMap(summary) {
  const training = hasTrainingData(summary) ? 'fresh' : 'missing';
  const recovery = hasRecoveryData(summary) ? 'fresh' : 'missing';
  const activity = hasActivityData(summary) ? 'fresh' : 'missing';
  const nutrition = hasNutritionData(summary) ? 'fresh' : 'missing';
  const biometrics = hasBiometricData(summary) ? 'fresh' : 'missing';

  return {
    overall: [training, recovery, activity, nutrition, biometrics].includes('fresh') ? 'fresh' : 'missing',
    training,
    recovery,
    activity,
    nutrition,
    biometrics,
    behavioral: 'missing',
    evaluatedAt: summary.lastSyncTimestamp,
  };
}

function domainWinners(summary) {
  return {
    identity: 'quicklifts_daily_health_summary_bridge',
    training: hasTrainingData(summary) ? 'quicklifts_daily_health_summary_bridge' : 'none',
    recovery: hasRecoveryData(summary) ? 'quicklifts_daily_health_summary_bridge' : 'none',
    activity: hasActivityData(summary) ? 'quicklifts_daily_health_summary_bridge' : 'none',
    nutrition: hasNutritionData(summary) ? 'quicklifts_daily_health_summary_bridge' : 'none',
    biometrics: hasBiometricData(summary) ? 'quicklifts_daily_health_summary_bridge' : 'none',
    behavioral: 'none',
    summary: 'quicklifts_daily_health_summary_bridge',
  };
}

function buildArtifacts(summary, legacyId, timezone, formatter) {
  const snapshotDateKey = snapshotDateKeyFromLegacy(summary, legacyId, formatter);
  const snapshotId = `${summary.userId}_daily_${snapshotDateKey}`;
  const revisionToken = String(Math.trunc((summary.lastSyncTimestamp || Date.now() / 1000) * 1000));
  const revisionId = `${snapshotId}_${revisionToken}`;
  const sourceRecordId = `${summary.userId}_quicklifts_daily_summary_${snapshotDateKey}`;
  const sourceWindow = parseDayWindow(snapshotDateKey, timezone);
  const winners = domainWinners(summary);
  const fresh = freshnessMap(summary);

  const sourceStatus = {
    id: `${summary.userId}_quicklifts`,
    athleteUserId: summary.userId,
    sourceFamily: 'quicklifts',
    lifecycleState: 'connected_synced',
    lastAttemptedSyncAt: summary.lastSyncTimestamp,
    lastSuccessfulSyncAt: summary.lastSyncTimestamp,
    lastObservedRecordAt: summary.date,
    lastErrorCode: null,
    lastErrorCategory: null,
    consentMetadata: {
      bridgeMode: true,
      legacyCollection: HEALTH_CONTEXT_COLLECTIONS.legacyDailySummaries,
    },
  };

  const sourceRecord = {
    id: sourceRecordId,
    athleteUserId: summary.userId,
    sourceFamily: 'quicklifts',
    sourceType: 'quicklifts_daily_health_summary_bridge',
    recordType: 'summary_input',
    domain: 'summary',
    observedAt: summary.date,
    observedWindowStart: sourceWindow.startAt,
    observedWindowEnd: sourceWindow.endAt,
    ingestedAt: summary.lastSyncTimestamp,
    timezone,
    status: 'active',
    dedupeKey: `${summary.userId}|quicklifts_daily_health_summary_bridge|${snapshotDateKey}`,
    payloadVersion: CONTRACT_VERSIONS.sourceRecord,
    payload: summary,
    sourceMetadata: {
      legacyCollection: HEALTH_CONTEXT_COLLECTIONS.legacyDailySummaries,
      bridgeMode: true,
      dataSourcesUsed: summary.dataSourcesUsed || [],
    },
    provenance: {
      mode: 'direct',
      bridgeMode: true,
      upstreamWriter: 'backfillHealthContext.js',
      legacySummaryId: legacyId,
    },
  };

  const snapshot = {
    id: snapshotId,
    athleteUserId: summary.userId,
    snapshotType: 'daily',
    snapshotDateKey,
    activeRevisionId: revisionId,
    generatedAt: summary.lastSyncTimestamp,
    contractVersions: CONTRACT_VERSIONS,
    sourceWindow,
    permissions: {
      bridgeMode: true,
      legacyCollection: HEALTH_CONTEXT_COLLECTIONS.legacyDailySummaries,
      nativeHealthKitLinked: false,
    },
    sourceStatus: {
      quicklifts: sourceStatus,
      healthkit: { sourceFamily: 'healthkit', lifecycleState: 'not_connected', bridgeMode: true },
      oura: { sourceFamily: 'oura', lifecycleState: 'not_connected' },
      pulsecheck_self_report: { sourceFamily: 'pulsecheck_self_report', lifecycleState: 'not_connected' },
    },
    freshness: fresh,
    provenance: {
      summaryMode: 'direct',
      bridgeMode: true,
      legacyCollection: HEALTH_CONTEXT_COLLECTIONS.legacyDailySummaries,
      sourcesUsed: ['quicklifts_daily_health_summary_bridge'],
      sourceRecordIds: [sourceRecordId],
      domainWinners: winners,
    },
    domains: compactObject({
      identity: {
        athleteUserId: summary.userId,
        timezone,
        snapshotDate: snapshotDateKey,
      },
      training: {
        workoutCount: summary.workoutCount,
        workoutSummaries: summary.workoutSummaries,
        totalWeightLifted: summary.totalWeightLifted,
        totalSetsCompleted: summary.totalSetsCompleted,
        totalRepsCompleted: summary.totalRepsCompleted,
        totalExercisesCompleted: summary.totalExercisesCompleted,
        primaryBodyPartsWorked: summary.primaryBodyPartsWorked,
        workoutRatings: summary.workoutRatings,
      },
      recovery: {
        sleepDuration: summary.sleepDuration,
        deepSleepDuration: summary.deepSleepDuration,
        remSleepDuration: summary.remSleepDuration,
        sleepEfficiency: summary.sleepEfficiency,
        timeInBedHours: summary.timeInBedHours,
        heartRateMin: summary.heartRateMin,
        heartRateMax: summary.heartRateMax,
        heartRateResting: summary.heartRateResting,
        heartRateVariability: summary.heartRateVariability,
        heartRateAvg: summary.heartRateAvg,
      },
      activity: {
        steps: summary.steps,
        activeCalories: summary.activeCalories,
        restingCalories: summary.restingCalories,
        totalCalories: summary.totalCalories,
        distance: summary.distance,
        exerciseMinutes: summary.exerciseMinutes,
        standHours: summary.standHours,
      },
      nutrition: {
        mealCount: summary.mealCount,
        meals: summary.meals,
        waterIntake: summary.waterIntake,
        caloriesConsumed: summary.caloriesConsumed,
        proteinConsumed: summary.proteinConsumed,
        carbsConsumed: summary.carbsConsumed,
        fatConsumed: summary.fatConsumed,
        fiberConsumed: summary.fiberConsumed,
        sugarConsumed: summary.sugarConsumed,
        sodiumConsumed: summary.sodiumConsumed,
        cholesterolConsumed: summary.cholesterolConsumed,
        calciumConsumed: summary.calciumConsumed,
        ironConsumed: summary.ironConsumed,
        vitaminCConsumed: summary.vitaminCConsumed,
        vitaminDConsumed: summary.vitaminDConsumed,
        calorieGoal: summary.calorieGoal,
        proteinGoal: summary.proteinGoal,
        carbGoal: summary.carbGoal,
        fatGoal: summary.fatGoal,
        calorieDeficitSurplus: summary.calorieDeficitSurplus,
        macroBalance: summary.macroBalance,
        hasCalorieGaps: summary.hasCalorieGaps,
        estimatedMissedCalories: summary.estimatedMissedCalories,
        gapConfidence: summary.gapConfidence,
        calorieDataCompleteness: summary.calorieDataCompleteness,
      },
      biometrics: {
        bodyWeight: summary.bodyWeight,
        bodyFatPercentage: summary.bodyFatPercentage,
        muscleMass: summary.muscleMass,
        bodyWaterPercentage: summary.bodyWaterPercentage,
        vo2Max: summary.vo2Max,
        respiratoryRate: summary.respiratoryRate,
        oxygenSaturation: summary.oxygenSaturation,
      },
      behavioral: {
        state: 'unavailable',
        sourceFamily: 'pulsecheck_self_report',
        mindfulnessMinutes: summary.mindfulnessMinutes,
      },
      summary: {
        dataSourcesUsed: summary.dataSourcesUsed || [],
        deepAnalysis: summary.deepAnalysis,
        deepAnalysisGeneratedAt: summary.deepAnalysisGeneratedAt || null,
        nutritionDataHash: summary.nutritionDataHash,
        hasCalorieGaps: summary.hasCalorieGaps,
        estimatedMissedCalories: summary.estimatedMissedCalories,
        gapConfidence: summary.gapConfidence,
        calorieDataCompleteness: summary.calorieDataCompleteness,
        lastSyncTimestamp: summary.lastSyncTimestamp,
        legacySummaryId: legacyId,
      },
    }),
    lastTriggerReason: 'legacy_daily_summary_bridge_backfill',
  };

  const snapshotRevision = {
    id: revisionId,
    snapshotId,
    revision: revisionToken,
    generatedAt: summary.lastSyncTimestamp,
    triggerReason: 'legacy_daily_summary_bridge_backfill',
    payload: snapshot,
    diffSummary: {
      bridgeMode: true,
      legacyCollection: HEALTH_CONTEXT_COLLECTIONS.legacyDailySummaries,
      snapshotDateKey,
    },
  };

  const assemblyTrace = {
    id: `${revisionId}_1`,
    athleteUserId: summary.userId,
    snapshotId,
    snapshotRevisionId: revisionId,
    triggerReason: 'legacy_daily_summary_bridge_backfill',
    selectedRecordIds: [sourceRecordId],
    droppedRecordIds: [],
    dropReasons: {},
    domainWinnerSummary: winners,
    contractVersions: CONTRACT_VERSIONS,
    createdAt: summary.lastSyncTimestamp,
  };

  return { sourceStatus, sourceRecord, snapshot, snapshotRevision, assemblyTrace };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const formatter = makeFormatter(args.timezone);
  const client = buildClient(args.project);

  console.log(`Backfill canonical health context`);
  console.log(`Project: ${args.project}`);
  console.log(`Timezone: ${args.timezone}`);
  console.log(`Auth mode: ${client.kind === 'admin' ? 'serviceAccountKey.json' : 'gcloud access token'}`);
  if (args.dryRun) console.log(`Mode: DRY RUN`);
  if (args.userId) console.log(`User filter: ${args.userId}`);
  if (args.limit) console.log(`Limit: ${args.limit} legacy summaries`);
  if (args.force) console.log(`Force: enabled`);

  const legacySummaries = await client.getLegacySummaries({
    userId: args.userId,
    limit: args.limit,
  });
  console.log(`Found ${legacySummaries.length} legacy daily summaries to inspect.`);

  let processed = 0;
  let written = 0;
  let skippedExisting = 0;
  let errors = 0;

  for (const doc of legacySummaries) {
    processed += 1;
    const summary = compactObject({ id: doc.id, ...doc.data });
    const artifacts = buildArtifacts(summary, doc.id, args.timezone, formatter);

    try {
      if (!args.force) {
        const existingSnapshot = await client.getDocument(HEALTH_CONTEXT_COLLECTIONS.snapshots, artifacts.snapshot.id);
        if (existingSnapshot && existingSnapshot.exists) {
          skippedExisting += 1;
          continue;
        }
      }

      if (args.dryRun) {
        written += 1;
        if (written <= 10) {
          console.log(`[dry-run] would seed ${artifacts.snapshot.id}`);
        }
        continue;
      }

      await client.setDocument(HEALTH_CONTEXT_COLLECTIONS.sourceStatus, artifacts.sourceStatus.id, artifacts.sourceStatus);
      await client.setDocument(HEALTH_CONTEXT_COLLECTIONS.sourceRecords, artifacts.sourceRecord.id, artifacts.sourceRecord);
      await client.setDocument(HEALTH_CONTEXT_COLLECTIONS.snapshots, artifacts.snapshot.id, artifacts.snapshot);
      await client.setDocument(HEALTH_CONTEXT_COLLECTIONS.snapshotRevisions, artifacts.snapshotRevision.id, artifacts.snapshotRevision);
      await client.setDocument(HEALTH_CONTEXT_COLLECTIONS.assemblyTraces, artifacts.assemblyTrace.id, artifacts.assemblyTrace);
      written += 1;

      if (written <= 10) {
        console.log(`[write] seeded ${artifacts.snapshot.id}`);
      }
    } catch (error) {
      errors += 1;
      console.error(`Failed to process ${doc.id}: ${error.message}`);
    }
  }

  console.log('\nDone.');
  console.log(`Processed: ${processed}`);
  console.log(args.dryRun ? `Would seed: ${written}` : `Seeded: ${written}`);
  console.log(`Skipped existing: ${skippedExisting}`);
  console.log(`Errors: ${errors}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
