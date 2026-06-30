const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildConnectionDocId,
  buildWhoopErrorResponse,
  ensureFreshAccessToken,
  parseJsonBody,
  timestampToEpochSeconds,
  verifyAuth,
  whoopApiRequest,
} = require('./whoop-utils');

const HEALTH_CONTEXT_COLLECTIONS = {
  sourceStatus: 'health-context-source-status',
  sourceRecords: 'health-context-source-records',
};
const SOURCE_RECORD_CONTRACT_VERSION = '1.0';

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value.map(compactObject).filter((entry) => entry !== undefined);
  }
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined || entry === null || entry === '') continue;
      const compacted = compactObject(entry);
      if (compacted !== undefined) output[key] = compacted;
    }
    return output;
  }
  return value;
}

function msToHours(value) {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  return Math.round((numeric / 3_600_000) * 100) / 100;
}

function msToMinutes(value) {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  return Math.round((numeric / 60_000) * 10) / 10;
}

function kilojouleToCalories(value) {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  return Math.round(numeric * 0.239006);
}

function isoDateKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function shiftDateKey(dateKey, offsetDays) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return isoDateKey(date);
}

function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function resolveTimeZone(value) {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
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

function getTimeZoneOffsetMs(timeZone, date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

function convertLocalDateTimeToUtcMs(dateKey, hours, minutes, timeZone) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  let utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const offsetMs = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
    const corrected = Date.UTC(year, month - 1, day, hours, minutes, 0) - offsetMs;
    if (corrected === utcGuess) break;
    utcGuess = corrected;
  }
  return utcGuess;
}

function buildDayWindow(dateKey, timezone = 'UTC') {
  const resolvedTimezone = resolveTimeZone(timezone);
  return {
    startAt: convertLocalDateTimeToUtcMs(dateKey, 0, 0, resolvedTimezone) / 1000,
    endAt: convertLocalDateTimeToUtcMs(shiftDateKey(dateKey, 1), 0, 0, resolvedTimezone) / 1000,
    timezone: resolvedTimezone,
  };
}

function recordTimestamp(record, keys = ['updated_at', 'end', 'created_at', 'start']) {
  for (const key of keys) {
    const value = timestampToEpochSeconds(record?.[key]);
    if (value) return value;
  }
  return 0;
}

function recordsForWindow(records, window) {
  return (records || []).filter((record) => {
    const start = timestampToEpochSeconds(record.start || record.created_at || record.updated_at);
    const end = timestampToEpochSeconds(record.end || record.updated_at || record.created_at);
    const marker = end || start;
    return marker && marker >= window.startAt - 24 * 60 * 60 && marker <= window.endAt + 24 * 60 * 60;
  });
}

function chooseLatest(records, timestampKeys) {
  return [...(records || [])].sort((left, right) => recordTimestamp(right, timestampKeys) - recordTimestamp(left, timestampKeys))[0] || null;
}

function buildSourceStatusDocument({ userId, hasPayload, observedAt, syncAt, lastError, previousSourceStatus = {} }) {
  const previousObservedAt = timestampToEpochSeconds(previousSourceStatus.lastObservedRecordAt);
  const previousSuccessfulSyncAt = timestampToEpochSeconds(previousSourceStatus.lastSuccessfulSyncAt);
  const effectiveObservedAt = timestampToEpochSeconds(observedAt) || previousObservedAt || null;
  const effectiveSuccessfulSyncAt = hasPayload ? syncAt : previousSuccessfulSyncAt || null;
  const lifecycleState = lastError
    ? 'connected_error'
    : hasPayload
      ? 'connected_synced'
      : effectiveObservedAt
        ? 'connected_stale'
        : 'connected_waiting_data';

  return compactObject({
    id: `${userId}_whoop`,
    athleteUserId: userId,
    sourceFamily: 'whoop',
    lifecycleState,
    lastAttemptedSyncAt: syncAt,
    lastSuccessfulSyncAt: effectiveSuccessfulSyncAt,
    lastObservedRecordAt: effectiveObservedAt,
    lastErrorCode: lastError ? 'whoop_sync_failed' : null,
    lastErrorCategory: lastError ? 'whoop_sync' : null,
    consentMetadata: {
      syncOrigin: 'pulsecheck_whoop_refresh',
      writer: 'whoop-sync.js',
      provider: 'whoop',
    },
  });
}

function buildSourceRecord({ userId, dateKey, timezone, syncAt, domain, sourceType, payload, rawRevision }) {
  const sourceWindow = buildDayWindow(dateKey, timezone);
  const segment = sourceType.replace(/^pulsecheck_whoop_/, '');
  const id = `${userId}_whoop_${segment}_${dateKey}`;
  return {
    id,
    athleteUserId: userId,
    sourceFamily: 'whoop',
    sourceType,
    recordType: domain === 'training' ? 'session_input' : 'summary_input',
    domain,
    observedAt: sourceWindow.endAt,
    observedWindowStart: sourceWindow.startAt,
    observedWindowEnd: sourceWindow.endAt,
    ingestedAt: syncAt,
    timezone: sourceWindow.timezone,
    status: 'active',
    dedupeKey: `${userId}|whoop|${domain}|${dateKey}`,
    payloadVersion: SOURCE_RECORD_CONTRACT_VERSION,
    payload,
    sourceMetadata: compactObject({
      syncOrigin: 'pulsecheck_whoop_refresh',
      writer: 'whoop-sync.js',
      upstreamRevision: rawRevision,
      provider: 'whoop',
    }),
    provenance: {
      mode: 'direct',
      sourceSystem: 'whoop_api',
      rawDay: dateKey,
      confidenceLabel: 'stable',
    },
  };
}

function mapRecoveryPayload(recovery) {
  const score = recovery?.score || {};
  return compactObject({
    recoveryScore: numberValue(score.recovery_score),
    readinessScore: numberValue(score.recovery_score),
    heartRateResting: numberValue(score.resting_heart_rate),
    heartRateVariability: numberValue(score.hrv_rmssd_milli),
    oxygenSaturation: numberValue(score.spo2_percentage),
    skinTemperatureCelsius: numberValue(score.skin_temp_celsius),
    userCalibrating: typeof score.user_calibrating === 'boolean' ? score.user_calibrating : undefined,
    scoreState: recovery?.score_state,
    whoopCycleId: recovery?.cycle_id,
    whoopSleepId: recovery?.sleep_id,
  });
}

function mapSleepPayload(sleep) {
  const score = sleep?.score || {};
  const stages = score.stage_summary || {};
  const totalSleepMilli = (
    numberValue(stages.total_light_sleep_time_milli) || 0
  ) + (
    numberValue(stages.total_slow_wave_sleep_time_milli) || 0
  ) + (
    numberValue(stages.total_rem_sleep_time_milli) || 0
  );
  return compactObject({
    sleepDuration: totalSleepMilli > 0 ? msToHours(totalSleepMilli) : null,
    timeInBed: msToHours(stages.total_in_bed_time_milli),
    awakeDuration: msToHours(stages.total_awake_time_milli),
    lightSleepDuration: msToHours(stages.total_light_sleep_time_milli),
    deepSleepDuration: msToHours(stages.total_slow_wave_sleep_time_milli),
    remSleepDuration: msToHours(stages.total_rem_sleep_time_milli),
    noDataDuration: msToHours(stages.total_no_data_time_milli),
    sleepEfficiency: numberValue(score.sleep_efficiency_percentage),
    sleepPerformancePercentage: numberValue(score.sleep_performance_percentage),
    sleepConsistencyPercentage: numberValue(score.sleep_consistency_percentage),
    respiratoryRate: numberValue(score.respiratory_rate),
    sleepCycleCount: numberValue(stages.sleep_cycle_count),
    disturbanceCount: numberValue(stages.disturbance_count),
    sleepNeededHours: msToHours(score.sleep_needed?.baseline_milli),
    scoreState: sleep?.score_state,
    nap: sleep?.nap,
    whoopSleepId: sleep?.id,
    whoopCycleId: sleep?.cycle_id,
  });
}

function mapCyclePayload(cycle) {
  const score = cycle?.score || {};
  return compactObject({
    strain: numberValue(score.strain),
    activeCalories: kilojouleToCalories(score.kilojoule),
    averageHeartRate: numberValue(score.average_heart_rate),
    maxHeartRate: numberValue(score.max_heart_rate),
    scoreState: cycle?.score_state,
    whoopCycleId: cycle?.id,
  });
}

function mapWorkoutPayload(workouts) {
  const workoutPayloads = (workouts || []).map((workout) => {
    const score = workout.score || {};
    const startAt = timestampToEpochSeconds(workout.start);
    const endAt = timestampToEpochSeconds(workout.end);
    return compactObject({
      id: workout.id,
      sportName: workout.sport_name,
      sportId: workout.sport_id,
      startAt,
      endAt,
      durationMinutes: startAt && endAt && endAt > startAt ? Math.round((endAt - startAt) / 60) : null,
      strain: numberValue(score.strain),
      averageHeartRate: numberValue(score.average_heart_rate),
      maxHeartRate: numberValue(score.max_heart_rate),
      activeCalories: kilojouleToCalories(score.kilojoule),
      percentRecorded: numberValue(score.percent_recorded),
      distanceMeters: numberValue(score.distance_meter),
      altitudeGainMeters: numberValue(score.altitude_gain_meter),
      zoneMinutes: compactObject({
        zone0: msToMinutes(score.zone_durations?.zone_zero_milli),
        zone1: msToMinutes(score.zone_durations?.zone_one_milli),
        zone2: msToMinutes(score.zone_durations?.zone_two_milli),
        zone3: msToMinutes(score.zone_durations?.zone_three_milli),
        zone4: msToMinutes(score.zone_durations?.zone_four_milli),
        zone5: msToMinutes(score.zone_durations?.zone_five_milli),
      }),
      scoreState: workout.score_state,
    });
  });

  const totalDurationMinutes = workoutPayloads.reduce((sum, workout) => sum + (numberValue(workout.durationMinutes) || 0), 0);
  const totalStrain = workoutPayloads.reduce((sum, workout) => sum + (numberValue(workout.strain) || 0), 0);
  const totalCalories = workoutPayloads.reduce((sum, workout) => sum + (numberValue(workout.activeCalories) || 0), 0);
  const totalDistanceMeters = workoutPayloads.reduce((sum, workout) => sum + (numberValue(workout.distanceMeters) || 0), 0);

  return compactObject({
    workoutCount: workoutPayloads.length,
    totalDurationMinutes: totalDurationMinutes || null,
    totalStrain: totalStrain ? Math.round(totalStrain * 100) / 100 : null,
    activeCalories: totalCalories || null,
    distanceKm: totalDistanceMeters ? Math.round((totalDistanceMeters / 1000) * 100) / 100 : null,
    workouts: workoutPayloads,
  });
}

function mapBodyMeasurementPayload(body) {
  return compactObject({
    bodyWeightKg: numberValue(body?.weight_kilogram),
    heightMeters: numberValue(body?.height_meter),
    maxHeartRate: numberValue(body?.max_heart_rate),
  });
}

function buildWhoopSourceRecords({ userId, dateKey, timezone, syncAt, whoopData }) {
  const window = buildDayWindow(dateKey, timezone);
  const recoveries = recordsForWindow(whoopData.recoveries?.records || [], window);
  const sleeps = recordsForWindow(whoopData.sleeps?.records || [], window).filter((sleep) => !sleep.nap);
  const workouts = recordsForWindow(whoopData.workouts?.records || [], window);
  const cycles = recordsForWindow(whoopData.cycles?.records || [], window);

  const selectedRecovery = chooseLatest(recoveries, ['updated_at', 'created_at']);
  const selectedSleep = chooseLatest(sleeps, ['end', 'updated_at', 'created_at']);
  const selectedCycle = chooseLatest(cycles, ['end', 'updated_at', 'created_at']);
  const records = [];

  const sleepPayload = mapSleepPayload(selectedSleep);
  const recoveryPayload = compactObject({
    ...sleepPayload,
    ...mapRecoveryPayload(selectedRecovery),
  });
  if (Object.keys(recoveryPayload).length > 0) {
    records.push(buildSourceRecord({
      userId,
      dateKey,
      timezone,
      syncAt,
      domain: 'recovery',
      sourceType: 'pulsecheck_whoop_recovery',
      payload: recoveryPayload,
      rawRevision: selectedRecovery?.updated_at || selectedSleep?.updated_at,
    }));
  }

  const activityPayload = compactObject({
    ...mapCyclePayload(selectedCycle),
  });
  if (Object.keys(activityPayload).length > 0) {
    records.push(buildSourceRecord({
      userId,
      dateKey,
      timezone,
      syncAt,
      domain: 'activity',
      sourceType: 'pulsecheck_whoop_activity',
      payload: activityPayload,
      rawRevision: selectedCycle?.updated_at,
    }));
  }

  const trainingPayload = mapWorkoutPayload(workouts);
  if (Object.keys(trainingPayload).length > 0 && trainingPayload.workoutCount > 0) {
    records.push(buildSourceRecord({
      userId,
      dateKey,
      timezone,
      syncAt,
      domain: 'training',
      sourceType: 'pulsecheck_whoop_training',
      payload: trainingPayload,
      rawRevision: chooseLatest(workouts, ['updated_at'])?.updated_at,
    }));
  }

  const biometricsPayload = mapBodyMeasurementPayload(whoopData.bodyMeasurement);
  if (Object.keys(biometricsPayload).length > 0) {
    records.push(buildSourceRecord({
      userId,
      dateKey,
      timezone,
      syncAt,
      domain: 'biometrics',
      sourceType: 'pulsecheck_whoop_biometrics',
      payload: biometricsPayload,
      rawRevision: String(whoopData.profile?.user_id || whoopData.bodyMeasurement?.max_heart_rate || ''),
    }));
  }

  return records;
}

async function fetchPaginatedWhoopCollection(accessToken, path, query) {
  const records = [];
  let nextToken = null;
  let guard = 0;
  do {
    const data = await whoopApiRequest(accessToken, path, {
      query: {
        ...query,
        ...(nextToken ? { nextToken } : {}),
      },
    });
    records.push(...(Array.isArray(data.records) ? data.records : []));
    nextToken = data.next_token || null;
    guard += 1;
  } while (nextToken && guard < 5);
  return { records, next_token: nextToken || undefined };
}

async function fetchWhoopData(accessToken, { dateKey, timezone }) {
  const window = buildDayWindow(dateKey, timezone);
  const start = new Date(window.startAt * 1000).toISOString();
  const end = new Date(window.endAt * 1000).toISOString();
  const [profile, bodyMeasurement, cycles, recoveries, sleeps, workouts] = await Promise.all([
    whoopApiRequest(accessToken, '/v2/user/profile/basic').catch((error) => ({ fetchError: error?.message || String(error) })),
    whoopApiRequest(accessToken, '/v2/user/measurement/body').catch((error) => ({ fetchError: error?.message || String(error) })),
    fetchPaginatedWhoopCollection(accessToken, '/v2/cycle', { start, end, limit: 25 }).catch((error) => ({ records: [], fetchError: error?.message || String(error) })),
    fetchPaginatedWhoopCollection(accessToken, '/v2/recovery', { start, end, limit: 25 }).catch((error) => ({ records: [], fetchError: error?.message || String(error) })),
    fetchPaginatedWhoopCollection(accessToken, '/v2/activity/sleep', { start, end, limit: 25 }).catch((error) => ({ records: [], fetchError: error?.message || String(error) })),
    fetchPaginatedWhoopCollection(accessToken, '/v2/activity/workout', { start, end, limit: 25 }).catch((error) => ({ records: [], fetchError: error?.message || String(error) })),
  ]);
  return { profile, bodyMeasurement, cycles, recoveries, sleeps, workouts };
}

async function syncWhoopForConnection({ firestore, connectionRef, connection, dateKey, timezone }) {
  const userId = connection.userId;
  const freshConnection = await ensureFreshAccessToken({ firestore, connectionRef, connection });
  const syncAt = Math.round(Date.now() / 1000);
  const whoopData = await fetchWhoopData(freshConnection.accessToken, { dateKey, timezone });
  const sourceRecordDocs = buildWhoopSourceRecords({ userId, dateKey, timezone, syncAt, whoopData });
  const observedAt = sourceRecordDocs.reduce((latest, record) => Math.max(latest, record.observedAt || 0), 0);
  const sourceStatusRef = firestore.collection(HEALTH_CONTEXT_COLLECTIONS.sourceStatus).doc(`${userId}_whoop`);
  const existingSourceStatusSnap = await sourceStatusRef.get();
  const sourceStatusDoc = buildSourceStatusDocument({
    userId,
    hasPayload: sourceRecordDocs.length > 0,
    observedAt,
    syncAt,
    lastError: null,
    previousSourceStatus: existingSourceStatusSnap.exists ? existingSourceStatusSnap.data() : {},
  });

  const batch = firestore.batch();
  batch.set(sourceStatusRef, sourceStatusDoc, { merge: true });
  batch.set(firestore.collection(HEALTH_CONTEXT_COLLECTIONS.sourceStatus).doc(userId), {
    sourceStatuses: {
      whoop: {
        status: sourceStatusDoc.lifecycleState,
        lifecycleState: sourceStatusDoc.lifecycleState,
        lastSyncedAt: syncAt,
        lastSuccessfulSyncAt: sourceStatusDoc.lastSuccessfulSyncAt || null,
        lastObservedRecordAt: sourceStatusDoc.lastObservedRecordAt || null,
      },
    },
    updatedAt: syncAt,
  }, { merge: true });
  for (const record of sourceRecordDocs) {
    batch.set(firestore.collection(HEALTH_CONTEXT_COLLECTIONS.sourceRecords).doc(record.id), record, { merge: true });
  }
  batch.set(connectionRef, {
    lastSuccessfulSyncAt: syncAt,
    lastImportedDomains: Array.from(new Set(sourceRecordDocs.map((record) => record.domain))),
    updatedAt: Date.now(),
    lastError: '',
    lastErrorAt: null,
    whoopUserId: whoopData.profile?.user_id || freshConnection.whoopUserId || null,
    email: whoopData.profile?.email || freshConnection.email || null,
    firstName: whoopData.profile?.first_name || freshConnection.firstName || null,
    lastName: whoopData.profile?.last_name || freshConnection.lastName || null,
  }, { merge: true });
  await batch.commit();

  return {
    status: sourceRecordDocs.length > 0 ? 'synced' : 'waiting_for_data',
    provider: 'whoop',
    sourceFamily: 'whoop',
    snapshotDateKey: dateKey,
    sourceRecordIds: sourceRecordDocs.map((record) => record.id),
    importedDomains: Array.from(new Set(sourceRecordDocs.map((record) => record.domain))),
    sourceStatus: sourceStatusDoc.lifecycleState,
    detail: sourceRecordDocs.length > 0
      ? 'Fresh WHOOP data was imported into PulseCheck.'
      : 'WHOOP is connected, but no scored data was available for this date yet.',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    initializeFirebaseAdmin(event);
    const decoded = await verifyAuth(event);
    const body = parseJsonBody(event);
    const timezone = resolveTimeZone(body.timezone);
    const snapshotDateKey = isValidDateKey(body.snapshotDateKey)
      ? body.snapshotDateKey
      : dateKeyInTimeZone(new Date(), timezone);
    const firestore = admin.firestore();
    const connectionRef = firestore.collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(decoded.uid));
    const connectionSnap = await connectionRef.get();
    if (!connectionSnap.exists || connectionSnap.data()?.status !== 'connected') {
      return {
        statusCode: 409,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          error: 'Connect WHOOP before syncing.',
          errorCode: 'WHOOP_NOT_CONNECTED',
          provider: 'whoop',
          sourceFamily: 'whoop',
        }),
      };
    }

    const result = await syncWhoopForConnection({
      firestore,
      connectionRef,
      connection: connectionSnap.data(),
      dateKey: snapshotDateKey,
      timezone,
    });
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: JSON.stringify(result) };
  } catch (error) {
    console.error('[whoop-sync] Failed:', error);
    return buildWhoopErrorResponse(error, {
      errorCode: 'WHOOP_SYNC_FAILED',
      message: 'We could not refresh your WHOOP data right now.',
    });
  }
};

exports.__test = {
  buildDayWindow,
  buildSourceStatusDocument,
  buildWhoopSourceRecords,
  mapBodyMeasurementPayload,
  mapCyclePayload,
  mapRecoveryPayload,
  mapSleepPayload,
  mapWorkoutPayload,
  msToHours,
};
