const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildConnectionDocId,
  buildPolarErrorResponse,
  createError,
  ensureFreshPolarConnection,
  parseJsonBody,
  polarApiRequest,
  verifyAuth,
} = require('./polar-utils');

const HEALTH_CONTEXT_COLLECTIONS = {
  sourceStatus: 'health-context-source-status',
  sourceRecords: 'health-context-source-records',
  snapshots: 'health-context-snapshots',
  snapshotRevisions: 'health-context-snapshot-revisions',
  assemblyTraces: 'health-context-assembly-traces',
};

const CONTRACT_VERSIONS = {
  sourceRecord: '1.0',
  snapshot: '1.0',
  assembler: '1.0',
  storage: '1.0',
};

function compactObject(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => compactObject(entry)).filter((entry) => entry !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, entry]) => {
      if (entry === undefined || entry === null || entry === '') return result;
      const compacted = compactObject(entry);
      if (compacted !== undefined) result[key] = compacted;
      return result;
    }, {});
  }

  return value;
}

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function durationSecondsValue(value) {
  const numeric = numberValue(value);
  if (numeric !== null) return numeric;
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return null;
  const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match;
  const total =
    Number(days) * 86400 +
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function shiftDateKey(dateKey, offsetDays) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function resolveTimeZone(value) {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch (error) {
    return 'UTC';
  }
}

function dateKeyInTimeZone(date = new Date(), timezone = 'UTC') {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function buildDayWindow(dateKey) {
  const startAt = Date.parse(`${dateKey}T00:00:00.000Z`) / 1000;
  const endAt = Date.parse(`${shiftDateKey(dateKey, 1)}T00:00:00.000Z`) / 1000;
  return { startAt, endAt, timezone: 'UTC', windowType: 'daily' };
}

function secondsToHours(value) {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  return Math.round((numeric / 3600) * 100) / 100;
}

function avg(values) {
  const numbers = (values || []).map(numberValue).filter((value) => value !== null);
  if (numbers.length === 0) return null;
  return Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 10) / 10;
}

function min(values) {
  const numbers = (values || []).map(numberValue).filter((value) => value !== null);
  return numbers.length ? Math.min(...numbers) : null;
}

function max(values) {
  const numbers = (values || []).map(numberValue).filter((value) => value !== null);
  return numbers.length ? Math.max(...numbers) : null;
}

function computeSleepMidpointEpochSeconds(startIso, endIso) {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return Math.round(((startMs + endMs) / 2) / 1000);
}

async function optionalPolarRequest(accessToken, path, options = {}) {
  try {
    return await polarApiRequest(accessToken, path, options);
  } catch (error) {
    if ([204, 404].includes(error?.polarStatus || error?.statusCode)) return null;
    console.warn('[polar-sync] optional Polar fetch failed:', path, error?.message || error);
    return null;
  }
}

async function fetchTransactionRecords(accessToken, polarUserId, transactionFamily) {
  if (!polarUserId) return [];
  const transactionPath = `/users/${encodeURIComponent(polarUserId)}/${transactionFamily}-transactions`;
  const transaction = await optionalPolarRequest(accessToken, transactionPath, { method: 'POST' });
  const transactionId = transaction?.['transaction-id'];
  const resourceUri = transaction?.['resource-uri'];
  if (!transactionId && !resourceUri) return [];

  const listPath = resourceUri || `${transactionPath}/${transactionId}`;
  const list = await optionalPolarRequest(accessToken, listPath);
  const links =
    list?.exercises ||
    list?.['activity-log'] ||
    list?.['physical-informations'] ||
    [];
  const records = [];

  for (const link of links) {
    const record = await optionalPolarRequest(accessToken, link);
    if (record) records.push(record);
  }

  await optionalPolarRequest(accessToken, listPath, { method: 'PUT' });
  return records;
}

async function fetchPolarData(connection, dateKey) {
  const accessToken = connection.accessToken;
  const polarUserId = connection.polarUserId;
  const [sleep, recharge, continuousHeartRate, activitySamples, cardioLoads, exercises, physicalInfos] = await Promise.all([
    optionalPolarRequest(accessToken, `/users/sleep/${dateKey}`),
    optionalPolarRequest(accessToken, `/users/nightly-recharge/${dateKey}`),
    optionalPolarRequest(accessToken, `/users/continuous-heart-rate/${dateKey}`),
    optionalPolarRequest(accessToken, '/users/activities/samples/', { query: { from: dateKey, to: dateKey } }),
    optionalPolarRequest(accessToken, '/users/cardio-load/'),
    fetchTransactionRecords(accessToken, polarUserId, 'exercise'),
    fetchTransactionRecords(accessToken, polarUserId, 'physical-information'),
  ]);

  return { sleep, recharge, continuousHeartRate, activitySamples, cardioLoads, exercises, physicalInfos };
}

function mapRecoveryPayload({ sleep, recharge }) {
  const sleepStart = sleep?.sleep_start_time || null;
  const sleepEnd = sleep?.sleep_end_time || null;
  const sleepHrSamples = Object.values(sleep?.heart_rate_samples || {});
  return compactObject({
    sleepDuration: sleepStart && sleepEnd ? secondsToHours((Date.parse(sleepEnd) - Date.parse(sleepStart)) / 1000) : null,
    deepSleepDuration: secondsToHours(sleep?.deep_sleep),
    remSleepDuration: secondsToHours(sleep?.rem_sleep),
    lightSleepDuration: secondsToHours(sleep?.light_sleep),
    sleepScore: numberValue(sleep?.sleep_score),
    sleepEfficiency: numberValue(sleep?.continuity),
    sleepCharge: numberValue(sleep?.sleep_charge),
    bedtimeStart: sleepStart,
    bedtimeEnd: sleepEnd,
    sleepMidpoint: computeSleepMidpointEpochSeconds(sleepStart, sleepEnd),
    heartRateResting: numberValue(recharge?.heart_rate_avg) || min(sleepHrSamples),
    heartRateVariability: numberValue(recharge?.heart_rate_variability_avg),
    respiratoryRate: numberValue(recharge?.breathing_rate_avg),
    nightlyRechargeStatus: numberValue(recharge?.nightly_recharge_status),
    ansCharge: numberValue(recharge?.ans_charge),
    ansChargeStatus: numberValue(recharge?.ans_charge_status),
    rawDeviceId: sleep?.device_id || null,
  });
}

function mapBiometricsPayload({ continuousHeartRate, physicalInfos }) {
  const samples = (continuousHeartRate?.heart_rate_samples || []).map((sample) => sample?.heart_rate);
  const latestPhysical = (physicalInfos || []).sort((left, right) => String(right?.created || '').localeCompare(String(left?.created || '')))[0] || {};
  return compactObject({
    heartRateAvg: avg(samples),
    heartRateMin: min(samples),
    heartRateMax: max(samples),
    continuousHeartRateSampleCount: samples.length || null,
    bodyWeight: numberValue(latestPhysical?.weight),
    height: numberValue(latestPhysical?.height),
    maximumHeartRate: numberValue(latestPhysical?.maximum_heart_rate || latestPhysical?.['maximum-heart-rate']),
    aerobicThreshold: numberValue(latestPhysical?.aerobic_threshold || latestPhysical?.['aerobic-threshold']),
    anaerobicThreshold: numberValue(latestPhysical?.anaerobic_threshold || latestPhysical?.['anaerobic-threshold']),
  });
}

function mapActivityPayload({ activitySamples, cardioLoads }) {
  const activityDays = Array.isArray(activitySamples) ? activitySamples : activitySamples?.['activity-log'] || activitySamples?.days || [];
  const latestDay = Array.isArray(activityDays) ? activityDays[0] || {} : activitySamples || {};
  const matchingCardio = (Array.isArray(cardioLoads) ? cardioLoads : []).find((entry) => entry?.date) || {};
  return compactObject({
    steps: numberValue(latestDay?.steps),
    activeCalories: numberValue(latestDay?.['active-calories'] || latestDay?.active_calories || latestDay?.calories),
    exerciseMinutes: numberValue(latestDay?.['active-time'] || latestDay?.active_time),
    activityGoalPercentage: numberValue(latestDay?.['active-steps'] || latestDay?.activity_goal),
    cardioLoad: numberValue(matchingCardio?.cardio_load),
    cardioLoadStatus: matchingCardio?.cardio_load_status || null,
  });
}

function mapTrainingPayload({ exercises }) {
  const recentExercises = (exercises || []).slice(0, 12);
  const durations = recentExercises.map((exercise) => durationSecondsValue(exercise?.duration || exercise?.duration_seconds)).filter((value) => value !== null);
  return compactObject({
    workoutCount: recentExercises.length || null,
    totalWorkoutDurationMinutes: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / 60) : null,
    workouts: recentExercises.map((exercise) => compactObject({
      id: exercise?.id || exercise?.['upload-time'] || exercise?.start_time,
      sport: exercise?.sport || exercise?.sport_name,
      startedAt: exercise?.start_time || exercise?.['start-time'],
      endedAt: exercise?.end_time || exercise?.['end-time'],
      durationSeconds: durationSecondsValue(exercise?.duration || exercise?.duration_seconds),
      distanceMeters: numberValue(exercise?.distance || exercise?.distance_meters || exercise?.['distance-meters']),
      calories: numberValue(exercise?.calories),
      heartRateAvg: numberValue(exercise?.heart_rate?.average || exercise?.['heart-rate']?.average),
      heartRateMax: numberValue(exercise?.heart_rate?.maximum || exercise?.['heart-rate']?.maximum),
    })),
  });
}

function buildSourceStatusDocument({ userId, hasPayload, observedAt, syncAt, lastError }) {
  return {
    id: `${userId}_polar`,
    athleteUserId: userId,
    sourceFamily: 'polar',
    lifecycleState: lastError ? 'connected_error' : hasPayload ? 'connected_synced' : 'connected_waiting_data',
    lastAttemptedSyncAt: syncAt,
    lastSuccessfulSyncAt: hasPayload ? syncAt : null,
    lastObservedRecordAt: observedAt || null,
    lastErrorCode: lastError ? 'polar_sync_failed' : null,
    lastErrorCategory: lastError ? 'polar_sync' : null,
    consentMetadata: {
      syncOrigin: 'pulsecheck_polar_refresh',
      writer: 'polar-sync.js',
    },
  };
}

function buildSourceRecord({ userId, dateKey, syncAt, domain, sourceType, payload, raw }) {
  const sourceWindow = buildDayWindow(dateKey);
  const id = `${userId}_${sourceType}_${dateKey}`;
  return {
    id,
    athleteUserId: userId,
    sourceFamily: 'polar',
    sourceType,
    recordType: 'summary_input',
    domain,
    observedAt: sourceWindow.endAt,
    observedWindowStart: sourceWindow.startAt,
    observedWindowEnd: sourceWindow.endAt,
    ingestedAt: syncAt,
    timezone: 'UTC',
    status: 'active',
    dedupeKey: `${userId}|polar|${domain}|${sourceType}|${dateKey}`,
    payloadVersion: CONTRACT_VERSIONS.sourceRecord,
    payload,
    sourceMetadata: {
      syncOrigin: 'pulsecheck_polar_refresh',
      writer: 'polar-sync.js',
    },
    provenance: {
      mode: 'direct',
      sourceSystem: 'polar_accesslink_api',
      rawDate: raw?.date || dateKey,
    },
  };
}

function buildSnapshotArtifacts({ userId, dateKey, timezone, syncAt, sourceStatusDoc, sourceRecordDocs, payloads, existingSnapshot }) {
  const snapshotId = `${userId}_daily_${dateKey}`;
  const revisionId = `${snapshotId}_${Math.trunc(syncAt * 1000)}`;
  const existingDomains = existingSnapshot?.domains || {};
  const existingSourceStatus = existingSnapshot?.sourceStatus || {};
  const existingProvenance = existingSnapshot?.provenance || {};
  const existingSourceRecordIds = Array.isArray(existingProvenance.sourceRecordIds) ? existingProvenance.sourceRecordIds : [];
  const nextSourceRecordIds = Array.from(new Set([...existingSourceRecordIds, ...sourceRecordDocs.map((record) => record.id)]));
  const existingSourcesUsed = Array.isArray(existingProvenance.sourcesUsed) ? existingProvenance.sourcesUsed : [];
  const nextSourcesUsed = Array.from(new Set([...existingSourcesUsed, 'polar']));
  const nextDomainWinners = {
    ...(existingProvenance.domainWinners || {}),
    ...(Object.keys(payloads.recovery).length ? { recovery: 'polar' } : {}),
    ...(Object.keys(payloads.biometrics).length ? { biometrics: 'polar' } : {}),
    ...(Object.keys(payloads.activity).length ? { activity: 'polar' } : {}),
    ...(Object.keys(payloads.training).length ? { training: 'polar' } : {}),
  };

  const snapshot = {
    ...(existingSnapshot || {}),
    id: snapshotId,
    athleteUserId: userId,
    snapshotType: 'daily',
    snapshotDateKey: dateKey,
    activeRevisionId: revisionId,
    generatedAt: syncAt,
    contractVersions: existingSnapshot?.contractVersions || CONTRACT_VERSIONS,
    sourceWindow: existingSnapshot?.sourceWindow || buildDayWindow(dateKey),
    permissions: {
      ...(existingSnapshot?.permissions || {}),
      polarAuthorized: true,
      syncOrigin: 'pulsecheck_polar_refresh',
    },
    sourceStatus: {
      ...existingSourceStatus,
      polar: sourceStatusDoc,
    },
    freshness: {
      ...(existingSnapshot?.freshness || {}),
      recovery: Object.keys(payloads.recovery).length ? 'fresh' : existingSnapshot?.freshness?.recovery || 'missing',
      biometrics: Object.keys(payloads.biometrics).length ? 'fresh' : existingSnapshot?.freshness?.biometrics || 'missing',
      activity: Object.keys(payloads.activity).length ? 'fresh' : existingSnapshot?.freshness?.activity || 'missing',
      training: Object.keys(payloads.training).length ? 'fresh' : existingSnapshot?.freshness?.training || 'missing',
      overall: 'fresh',
      evaluatedAt: syncAt,
    },
    provenance: {
      ...existingProvenance,
      summaryMode: existingSnapshot ? 'merged' : 'direct',
      sourcesUsed: nextSourcesUsed,
      sourceRecordIds: nextSourceRecordIds,
      domainWinners: nextDomainWinners,
      latestObservedPolarDateKey: dateKey,
    },
    domains: {
      ...existingDomains,
      identity: existingDomains.identity || { athleteUserId: userId, timezone, snapshotDate: dateKey },
      recovery: compactObject({ ...(existingDomains.recovery || {}), ...payloads.recovery }),
      biometrics: compactObject({ ...(existingDomains.biometrics || {}), ...payloads.biometrics }),
      activity: compactObject({ ...(existingDomains.activity || {}), ...payloads.activity }),
      training: compactObject({ ...(existingDomains.training || {}), ...payloads.training }),
      summary: compactObject({
        ...(existingDomains.summary || {}),
        dataSourcesUsed: nextSourcesUsed,
        lastSyncTimestamp: syncAt,
        syncOrigin: 'pulsecheck_polar_refresh',
        polarLastSyncTimestamp: syncAt,
        polarObservedDateKey: dateKey,
      }),
    },
    lastTriggerReason: 'pulsecheck_polar_refresh',
  };

  return {
    snapshot,
    snapshotRevision: {
      id: revisionId,
      snapshotId,
      revision: String(Math.trunc(syncAt * 1000)),
      generatedAt: syncAt,
      triggerReason: 'pulsecheck_polar_refresh',
      payload: snapshot,
      diffSummary: { sourceFamily: 'polar', snapshotDateKey: dateKey },
    },
    assemblyTrace: {
      id: `${revisionId}_1`,
      athleteUserId: userId,
      snapshotId,
      snapshotRevisionId: revisionId,
      triggerReason: 'pulsecheck_polar_refresh',
      selectedRecordIds: sourceRecordDocs.map((record) => record.id),
      droppedRecordIds: [],
      dropReasons: {},
      domainWinnerSummary: nextDomainWinners,
      contractVersions: CONTRACT_VERSIONS,
      createdAt: syncAt,
    },
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  if (!['POST', 'GET'].includes(event.httpMethod)) {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    initializeFirebaseAdmin(event);
    const decoded = await verifyAuth(event);
    const body = parseJsonBody(event);
    const userId = decoded.uid;
    const timezone = resolveTimeZone(body.timezone);
    const requestedDateKey = typeof body.snapshotDateKey === 'string' && isValidDateKey(body.snapshotDateKey)
      ? body.snapshotDateKey.trim()
      : dateKeyInTimeZone(new Date(), timezone);
    const syncAt = Date.now() / 1000;
    const connectionRef = admin.firestore().collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(userId));
    const connectionSnap = await connectionRef.get();
    const connection = connectionSnap.exists ? connectionSnap.data() || {} : null;

    const freshConnection = await ensureFreshPolarConnection(connectionRef, connection);
    const polarData = await fetchPolarData(freshConnection, requestedDateKey);
    const payloads = {
      recovery: mapRecoveryPayload(polarData),
      biometrics: mapBiometricsPayload(polarData),
      activity: mapActivityPayload(polarData),
      training: mapTrainingPayload(polarData),
    };
    const hasPayload = Object.values(payloads).some((payload) => Object.keys(payload).length > 0);
    const observedAt = hasPayload ? buildDayWindow(requestedDateKey).endAt : null;
    const sourceStatusDoc = buildSourceStatusDocument({ userId, hasPayload, observedAt, syncAt, lastError: null });
    const sourceRecordDocs = Object.entries(payloads)
      .filter(([, payload]) => Object.keys(payload).length > 0)
      .map(([domain, payload]) => buildSourceRecord({
        userId,
        dateKey: requestedDateKey,
        syncAt,
        domain,
        sourceType: `pulsecheck_polar_${domain}`,
        payload,
        raw: polarData[domain],
      }));

    const batch = admin.firestore().batch();
    batch.set(admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.sourceStatus).doc(sourceStatusDoc.id), sourceStatusDoc, { merge: true });
    batch.set(connectionRef, {
      lastSyncAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRequestedSnapshotDateKey: requestedDateKey,
      pendingWebhookSync: false,
      pendingWebhookDateKey: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: '',
    }, { merge: true });

    if (!hasPayload) {
      await batch.commit();
      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          ok: true,
          status: 'waiting_for_data',
          snapshotDateKey: requestedDateKey,
          detail: 'Polar is connected, but no synced Polar Flow data was available for this date yet.',
        }),
      };
    }

    for (const record of sourceRecordDocs) {
      batch.set(admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.sourceRecords).doc(record.id), record, { merge: true });
    }

    const snapshotId = `${userId}_daily_${requestedDateKey}`;
    const existingSnapshotSnap = await admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.snapshots).doc(snapshotId).get();
    const artifacts = buildSnapshotArtifacts({
      userId,
      dateKey: requestedDateKey,
      timezone,
      syncAt,
      sourceStatusDoc,
      sourceRecordDocs,
      payloads,
      existingSnapshot: existingSnapshotSnap.data() || null,
    });

    batch.set(admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.snapshots).doc(artifacts.snapshot.id), artifacts.snapshot, { merge: true });
    batch.set(admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.snapshotRevisions).doc(artifacts.snapshotRevision.id), artifacts.snapshotRevision, { merge: true });
    batch.set(admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.assemblyTraces).doc(artifacts.assemblyTrace.id), artifacts.assemblyTrace, { merge: true });
    batch.set(connectionRef, {
      lastSuccessfulSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSuccessfulSnapshotDateKey: requestedDateKey,
      lastImportedDomains: Object.entries(payloads).filter(([, payload]) => Object.keys(payload).length > 0).map(([domain]) => domain),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: true,
        status: 'synced',
        snapshotId,
        snapshotDateKey: requestedDateKey,
        sourceRecordIds: sourceRecordDocs.map((record) => record.id),
        sourcesUsed: artifacts.snapshot.provenance.sourcesUsed,
        importedDomains: Object.entries(payloads).filter(([, payload]) => Object.keys(payload).length > 0).map(([domain]) => domain),
        detail: 'PulseCheck imported the latest Polar health context.',
      }),
    };
  } catch (error) {
    console.error('[polar-sync] Failed:', error);
    return buildPolarErrorResponse(error, {
      errorCode: 'POLAR_SYNC_FAILED',
      message: 'We could not refresh your Polar health data right now.',
    });
  }
};

exports.__test = {
  computeSleepMidpointEpochSeconds,
  mapRecoveryPayload,
  mapBiometricsPayload,
  mapActivityPayload,
  mapTrainingPayload,
};
