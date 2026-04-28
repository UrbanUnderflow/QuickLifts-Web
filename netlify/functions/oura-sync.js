const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildOuraErrorResponse,
  buildConnectionDocId,
  createError,
  getOauthCredentials,
  verifyAuth,
} = require('./oura-utils');
const {
  buildNoraBiometricBriefNotification,
  resolveAthleteFirstName,
  resolvePulseCheckPushTarget,
  loadPulseCheckNudgeSuppressionState,
  sendLoggedNoraPush,
} = require('./pulsecheck-notification-utils');

const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';
const OURA_API_BASE_URL = 'https://api.ouraring.com/v2/usercollection';

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

function parseJsonBody(event) {
  if (!event?.body) return {};
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (error) {
    return {};
  }
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => compactObject(entry))
      .filter((entry) => entry !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, entry]) => {
      if (entry === undefined || entry === null || entry === '') {
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

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstNumber(source, keys) {
  for (const key of keys) {
    const value = numberValue(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function firstString(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function secondsToHours(value) {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  return Math.round((numeric / 3600) * 100) / 100;
}

function metersToKilometers(value) {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  return Math.round((numeric / 1000) * 100) / 100;
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
    Number(map.second)
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
  const startAt = convertLocalDateTimeToUtcMs(dateKey, 0, 0, resolvedTimezone) / 1000;
  const endAt = convertLocalDateTimeToUtcMs(shiftDateKey(dateKey, 1), 0, 0, resolvedTimezone) / 1000;
  return {
    startAt,
    endAt,
    timezone: resolvedTimezone,
    windowType: 'daily',
  };
}

function compareNumberDescending(left, right) {
  const leftValue = numberValue(left);
  const rightValue = numberValue(right);

  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return rightValue - leftValue;
}

function compareStringDescending(left, right) {
  const leftValue = typeof left === 'string' ? left.trim() : '';
  const rightValue = typeof right === 'string' ? right.trim() : '';

  if (!leftValue && !rightValue) return 0;
  if (!leftValue) return 1;
  if (!rightValue) return -1;
  return rightValue.localeCompare(leftValue);
}

function chooseLatestRecord(records, options = {}) {
  const timestampKeys = Array.isArray(options.timestampKeys) && options.timestampKeys.length > 0
    ? options.timestampKeys
    : ['timestamp'];

  return (records || [])
    .filter(Boolean)
    .sort((left, right) => {
      const byDay = compareStringDescending(firstString(left, ['day']), firstString(right, ['day']));
      if (byDay !== 0) return byDay;

      const byTimestamp = compareStringDescending(firstString(left, timestampKeys), firstString(right, timestampKeys));
      if (byTimestamp !== 0) return byTimestamp;

      return compareStringDescending(firstString(left, ['id']), firstString(right, ['id']));
    })[0] || null;
}

function sleepRecordTypePriority(record) {
  switch ((firstString(record, ['type']) || '').toLowerCase()) {
    case 'long_sleep':
      return 3;
    case 'sleep':
      return 2;
    case 'late_nap':
      return 1;
    default:
      return 0;
  }
}

function isUsableSleepRecord(record) {
  const type = (firstString(record, ['type']) || '').toLowerCase();
  return Boolean(record) && type !== 'deleted' && type !== 'rest';
}

function compareSleepRecords(left, right) {
  const byDay = compareStringDescending(firstString(left, ['day']), firstString(right, ['day']));
  if (byDay !== 0) return byDay;

  const byTypePriority = compareNumberDescending(sleepRecordTypePriority(left), sleepRecordTypePriority(right));
  if (byTypePriority !== 0) return byTypePriority;

  const byTotalSleep = compareNumberDescending(
    firstNumber(left, ['total_sleep_duration']),
    firstNumber(right, ['total_sleep_duration'])
  );
  if (byTotalSleep !== 0) return byTotalSleep;

  const byTimeInBed = compareNumberDescending(
    firstNumber(left, ['time_in_bed']),
    firstNumber(right, ['time_in_bed'])
  );
  if (byTimeInBed !== 0) return byTimeInBed;

  const byBedtimeEnd = compareStringDescending(firstString(left, ['bedtime_end']), firstString(right, ['bedtime_end']));
  if (byBedtimeEnd !== 0) return byBedtimeEnd;

  const byBedtimeStart = compareStringDescending(firstString(left, ['bedtime_start']), firstString(right, ['bedtime_start']));
  if (byBedtimeStart !== 0) return byBedtimeStart;

  return compareStringDescending(firstString(left, ['id']), firstString(right, ['id']));
}

// Oura can return multiple sleep periods for the same day; prefer the main overnight sleep.
function chooseBestSleepRecord(records, preferredDateKey) {
  const candidates = (records || []).filter(isUsableSleepRecord);
  if (candidates.length === 0) return null;

  const preferredDayCandidates = isValidDateKey(preferredDateKey)
    ? candidates.filter((record) => firstString(record, ['day']) === preferredDateKey)
    : [];

  const pool = preferredDayCandidates.length > 0 ? preferredDayCandidates : candidates;
  return pool.sort(compareSleepRecords)[0] || null;
}

function summarizeSleepRecord(record) {
  if (!record) return null;

  return compactObject({
    id: firstString(record, ['id']),
    day: firstString(record, ['day']),
    type: firstString(record, ['type']),
    bedtimeStart: firstString(record, ['bedtime_start']),
    bedtimeEnd: firstString(record, ['bedtime_end']),
    totalSleepMinutes: Math.round((firstNumber(record, ['total_sleep_duration']) || 0) / 60),
    timeInBedMinutes: Math.round((firstNumber(record, ['time_in_bed']) || 0) / 60),
    efficiency: firstNumber(record, ['efficiency']),
  });
}

function buildSleepSelectionDebug(records, selectedRecord, preferredDateKey) {
  const candidates = (records || [])
    .filter(isUsableSleepRecord)
    .sort(compareSleepRecords)
    .slice(0, 6)
    .map((record) => summarizeSleepRecord(record));

  return compactObject({
    preferredDateKey,
    candidateCount: (records || []).filter(isUsableSleepRecord).length,
    selectedRecord: summarizeSleepRecord(selectedRecord),
    candidatePreview: candidates,
  });
}

function buildDefaultSourceStatus(existingMap = {}) {
  return {
    quicklifts: existingMap.quicklifts || { sourceFamily: 'quicklifts', lifecycleState: 'not_connected' },
    healthkit: existingMap.healthkit || { sourceFamily: 'healthkit', lifecycleState: 'not_connected' },
    pulsecheck_self_report:
      existingMap.pulsecheck_self_report || { sourceFamily: 'pulsecheck_self_report', lifecycleState: 'not_connected' },
  };
}

function mergeFreshness(existingFreshness = {}, hasRecovery) {
  const next = {
    ...existingFreshness,
    recovery: hasRecovery ? 'fresh' : existingFreshness.recovery || 'missing',
    evaluatedAt: Date.now() / 1000,
  };

  const freshnessValues = ['training', 'recovery', 'activity', 'nutrition', 'biometrics', 'behavioral']
    .map((key) => next[key])
    .filter(Boolean);

  next.overall = freshnessValues.includes('fresh')
    ? 'fresh'
    : existingFreshness.overall || (hasRecovery ? 'fresh' : 'missing');

  return next;
}

// Universal sleep-midpoint computation: works for any source that records
// a sleep window (Oura, Apple HealthKit, Whoop, Polar, Garmin, self-report).
// Returns epoch seconds at the midpoint of the sleep period.
function computeSleepMidpointEpochSeconds(bedtimeStartIso, bedtimeEndIso) {
  if (!bedtimeStartIso || !bedtimeEndIso) return null;
  const startMs = Date.parse(bedtimeStartIso);
  const endMs = Date.parse(bedtimeEndIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return Math.round(((startMs + endMs) / 2) / 1000);
}

function mapSleepPayload(record) {
  const bedtimeStart = firstString(record, ['bedtime_start']);
  const bedtimeEnd = firstString(record, ['bedtime_end']);
  const sleepMidpoint = computeSleepMidpointEpochSeconds(bedtimeStart, bedtimeEnd);

  return compactObject({
    sleepDuration: secondsToHours(firstNumber(record, ['total_sleep_duration'])),
    deepSleepDuration: secondsToHours(firstNumber(record, ['deep_sleep_duration'])),
    remSleepDuration: secondsToHours(firstNumber(record, ['rem_sleep_duration'])),
    sleepEfficiency: firstNumber(record, ['efficiency']),
    timeInBedHours: secondsToHours(firstNumber(record, ['time_in_bed'])),
    heartRateResting: firstNumber(record, ['lowest_heart_rate', 'resting_heart_rate', 'average_heart_rate']),
    heartRateVariability: firstNumber(record, ['average_hrv', 'hrv']),
    respiratoryRate: firstNumber(record, ['average_breath', 'respiratory_rate']),
    // --- universal cross-device fields (added Phase A) ---
    bedtimeStart,
    bedtimeEnd,
    sleepMidpoint,
    // sleepMidpointShiftMinutes is computed at snapshot-assembly time
    // (assembler reads last 7 days of midpoints from HCSR and computes the delta).
  });
}

function mapReadinessPayload(record) {
  return compactObject({
    readinessScore: firstNumber(record, ['score']),
    recoveryIndex: firstNumber(record, ['recovery_index_score']),
    temperatureDeviation: firstNumber(record, ['temperature_deviation']),
    readinessState: firstString(record, ['state', 'status']),
  });
}

// Oura's daily_stress endpoint surfaces high-stress minutes (sustained sympathetic
// activation during waking hours). This is the universal "daytime autonomic load"
// signal — same name across all wearable adapters; each adapter computes it from
// whatever signals its device exposes (Oura: stress_high; Whoop: strain proxy;
// Apple Watch: minutes-above-RHR-delta excluding workouts).
function mapStressPayload(record) {
  return compactObject({
    daytimeAutonomicLoadMinutes: firstNumber(record, ['stress_high']),
    recoveryHighMinutes: firstNumber(record, ['recovery_high']),
    daySummary: firstString(record, ['day_summary']),
  });
}

async function refreshToken(refreshToken) {
  const { clientId, clientSecret } = getOauthCredentials();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    data = { rawText };
  }

  if (!response.ok) {
    throw createError(
      response.status,
      data?.detail || data?.error_description || data?.error || `Failed to refresh Oura access token.`
    );
  }

  return data;
}

async function fetchOuraCollection(accessToken, endpoint, params) {
  const url = new URL(`${OURA_API_BASE_URL}/${endpoint}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    data = { rawText };
  }

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.title ||
      data?.error_description ||
      data?.error ||
      `Oura ${endpoint} request failed`;
    const error = createError(response.status, detail);
    error.ouraStatus = response.status;
    throw error;
  }

  return Array.isArray(data?.data) ? data.data : [];
}

async function ensureFreshAccessToken(connectionRef, connection) {
  const expiresAt = numberValue(connection?.accessTokenExpiresAt);
  const now = Date.now();
  const shouldRefresh = Boolean(connection?.refreshToken) && (!connection?.accessToken || !expiresAt || now >= expiresAt - 60_000);

  if (!shouldRefresh) {
    return connection;
  }

  const tokenData = await refreshToken(connection.refreshToken);
  const nextConnection = {
    ...connection,
    accessToken: tokenData.access_token || connection.accessToken || '',
    refreshToken: tokenData.refresh_token || connection.refreshToken || '',
    accessTokenExpiresAt: typeof tokenData.expires_in === 'number' ? now + tokenData.expires_in * 1000 : connection.accessTokenExpiresAt || null,
    accessTokenIssuedAt: now,
    updatedAt: now,
    lastError: '',
    lastErrorAt: null,
  };

  await connectionRef.set(
    {
      accessToken: nextConnection.accessToken,
      refreshToken: nextConnection.refreshToken,
      accessTokenExpiresAt: nextConnection.accessTokenExpiresAt,
      accessTokenIssuedAt: nextConnection.accessTokenIssuedAt,
      updatedAt: now,
      lastError: '',
      lastErrorAt: null,
    },
    { merge: true }
  );

  return nextConnection;
}

async function fetchOuraData(connectionRef, connection, dateKey) {
  let nextConnection = await ensureFreshAccessToken(connectionRef, connection);
  const startDate = shiftDateKey(dateKey, -2);
  const endDate = shiftDateKey(dateKey, 1);

  async function perform(accessToken) {
    const [sleepRecords, readinessRecords, stressRecords] = await Promise.all([
      fetchOuraCollection(accessToken, 'sleep', {
        start_date: startDate,
        end_date: endDate,
      }),
      fetchOuraCollection(accessToken, 'daily_readiness', {
        start_date: startDate,
        end_date: endDate,
      }),
      // daily_stress is a newer Oura endpoint; tolerate failure (e.g. older
      // ring firmware or scope mismatch) without breaking the whole sync.
      fetchOuraCollection(accessToken, 'daily_stress', {
        start_date: startDate,
        end_date: endDate,
      }).catch((err) => {
        console.warn('[oura-sync] daily_stress fetch failed (non-fatal):', err?.message || err);
        return [];
      }),
    ]);

    return { sleepRecords, readinessRecords, stressRecords };
  }

  try {
    return await perform(nextConnection.accessToken);
  } catch (error) {
    if ((error?.ouraStatus === 401 || error?.statusCode === 401) && nextConnection.refreshToken) {
      nextConnection = await ensureFreshAccessToken(connectionRef, {
        ...nextConnection,
        accessTokenExpiresAt: 0,
      });
      return perform(nextConnection.accessToken);
    }
    throw error;
  }
}

function buildSourceStatusDocument({ userId, observedAt, syncAt, lifecycleState, lastError }) {
  return {
    id: `${userId}_oura`,
    athleteUserId: userId,
    sourceFamily: 'oura',
    lifecycleState,
    lastAttemptedSyncAt: syncAt,
    lastSuccessfulSyncAt: observedAt ? syncAt : null,
    lastObservedRecordAt: observedAt || null,
    lastErrorCode: lastError ? 'oura_sync_failed' : null,
    lastErrorCategory: lastError ? 'oura_sync' : null,
    consentMetadata: {
      syncOrigin: 'pulsecheck_oura_refresh',
      writer: 'oura-sync.js',
    },
  };
}

function buildSourceRecordDocuments({ userId, dateKey, timezone, syncAt, sleepPayload, readinessPayload, stressPayload, rawSleep, rawReadiness, rawStress }) {
  const sourceWindow = buildDayWindow(dateKey, timezone);
  const records = [];

  if (Object.keys(sleepPayload).length > 0) {
    const id = `${userId}_oura_recovery_${dateKey}`;
    records.push({
      id,
      athleteUserId: userId,
      sourceFamily: 'oura',
      sourceType: 'pulsecheck_oura_recovery',
      recordType: 'summary_input',
      domain: 'recovery',
      observedAt: sourceWindow.endAt,
      observedWindowStart: sourceWindow.startAt,
      observedWindowEnd: sourceWindow.endAt,
      ingestedAt: syncAt,
      timezone,
      status: 'active',
      dedupeKey: `${userId}|oura|recovery|${dateKey}`,
      payloadVersion: CONTRACT_VERSIONS.sourceRecord,
      payload: sleepPayload,
      sourceMetadata: {
        syncOrigin: 'pulsecheck_oura_refresh',
        writer: 'oura-sync.js',
      },
      provenance: {
        mode: 'direct',
        sourceSystem: 'oura_cloud_api',
        rawDay: rawSleep?.day || dateKey,
      },
    });
  }

  if (Object.keys(readinessPayload).length > 0) {
    const id = `${userId}_oura_readiness_${dateKey}`;
    records.push({
      id,
      athleteUserId: userId,
      sourceFamily: 'oura',
      sourceType: 'pulsecheck_oura_readiness',
      recordType: 'summary_input',
      domain: 'summary',
      observedAt: sourceWindow.endAt,
      observedWindowStart: sourceWindow.startAt,
      observedWindowEnd: sourceWindow.endAt,
      ingestedAt: syncAt,
      timezone,
      status: 'active',
      dedupeKey: `${userId}|oura|summary|${dateKey}`,
      payloadVersion: CONTRACT_VERSIONS.sourceRecord,
      payload: readinessPayload,
      sourceMetadata: {
        syncOrigin: 'pulsecheck_oura_refresh',
        writer: 'oura-sync.js',
      },
      provenance: {
        mode: 'direct',
        sourceSystem: 'oura_cloud_api',
        rawDay: rawReadiness?.day || dateKey,
      },
    });
  }

  if (stressPayload && Object.keys(stressPayload).length > 0) {
    const id = `${userId}_oura_autonomic_${dateKey}`;
    records.push({
      id,
      athleteUserId: userId,
      sourceFamily: 'oura',
      sourceType: 'pulsecheck_oura_autonomic_load',
      recordType: 'summary_input',
      domain: 'recovery',
      observedAt: sourceWindow.endAt,
      observedWindowStart: sourceWindow.startAt,
      observedWindowEnd: sourceWindow.endAt,
      ingestedAt: syncAt,
      timezone,
      status: 'active',
      dedupeKey: `${userId}|oura|autonomic|${dateKey}`,
      payloadVersion: CONTRACT_VERSIONS.sourceRecord,
      payload: stressPayload,
      sourceMetadata: {
        syncOrigin: 'pulsecheck_oura_refresh',
        writer: 'oura-sync.js',
      },
      provenance: {
        mode: 'direct',
        sourceSystem: 'oura_cloud_api',
        rawDay: rawStress?.day || dateKey,
      },
    });
  }

  return records;
}

function buildSnapshotArtifacts({
  userId,
  dateKey,
  timezone,
  syncAt,
  requestedDateKey,
  observedDateKey,
  sourceStatusDoc,
  sourceRecordDocs,
  sleepPayload,
  readinessPayload,
  stressPayload,
  existingSnapshot,
}) {
  const snapshotId = `${userId}_daily_${dateKey}`;
  const revisionId = `${snapshotId}_${Math.trunc(syncAt * 1000)}`;
  const existingSourceStatus = existingSnapshot?.sourceStatus || {};
  const defaults = buildDefaultSourceStatus(existingSourceStatus);
  const existingProvenance = existingSnapshot?.provenance || {};
  const existingDomains = existingSnapshot?.domains || {};
  const existingSourceRecordIds = Array.isArray(existingProvenance.sourceRecordIds) ? existingProvenance.sourceRecordIds : [];
  const existingSourcesUsed = Array.isArray(existingProvenance.sourcesUsed)
    ? existingProvenance.sourcesUsed
    : Array.isArray(existingDomains?.summary?.dataSourcesUsed)
    ? existingDomains.summary.dataSourcesUsed
    : [];

  const nextSourceRecordIds = uniqueStrings([
    ...existingSourceRecordIds,
    ...sourceRecordDocs.map((record) => record.id),
  ]);
  const nextSourcesUsed = uniqueStrings([
    ...existingSourcesUsed,
    'oura',
  ]);

  const nextDomainWinners = {
    ...(existingProvenance.domainWinners || {}),
    recovery: Object.keys(sleepPayload).length > 0 ? 'pulsecheck_oura' : existingProvenance?.domainWinners?.recovery || 'none',
    summary: 'pulsecheck_oura',
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
    sourceWindow: existingSnapshot?.sourceWindow || buildDayWindow(dateKey, timezone),
    permissions: {
      ...(existingSnapshot?.permissions || {}),
      ouraAuthorized: true,
      syncOrigin: 'pulsecheck_oura_refresh',
    },
    sourceStatus: {
      ...defaults,
      ...existingSourceStatus,
      oura: sourceStatusDoc,
    },
    freshness: mergeFreshness(existingSnapshot?.freshness, Object.keys(sleepPayload).length > 0),
    provenance: {
      ...existingProvenance,
      summaryMode: existingSnapshot ? 'merged' : 'direct',
      sourcesUsed: nextSourcesUsed,
      sourceRecordIds: nextSourceRecordIds,
      domainWinners: nextDomainWinners,
      requestedSnapshotDateKey: requestedDateKey || dateKey,
      latestObservedOuraDateKey: observedDateKey || dateKey,
    },
    domains: {
      ...existingDomains,
      identity: existingDomains.identity || {
        athleteUserId: userId,
        timezone,
        snapshotDate: dateKey,
      },
      recovery: compactObject({
        ...(existingDomains.recovery || {}),
        ...sleepPayload,
        ...(stressPayload || {}),
      }),
      summary: compactObject({
        ...(existingDomains.summary || {}),
        dataSourcesUsed: nextSourcesUsed,
        lastSyncTimestamp: syncAt,
        syncOrigin: 'pulsecheck_oura_refresh',
        ouraLastSyncTimestamp: syncAt,
        ouraRequestedSnapshotDateKey: requestedDateKey || dateKey,
        ouraObservedDateKey: observedDateKey || dateKey,
        ...readinessPayload,
      }),
    },
    lastTriggerReason: 'pulsecheck_oura_refresh',
  };

  const snapshotRevision = {
    id: revisionId,
    snapshotId,
    revision: String(Math.trunc(syncAt * 1000)),
    generatedAt: syncAt,
    triggerReason: 'pulsecheck_oura_refresh',
    payload: snapshot,
    diffSummary: {
      sourceFamily: 'oura',
      syncOrigin: 'pulsecheck_oura_refresh',
      snapshotDateKey: dateKey,
      requestedDateKey: requestedDateKey || dateKey,
      observedDateKey: observedDateKey || dateKey,
    },
  };

  const assemblyTrace = {
    id: `${revisionId}_1`,
    athleteUserId: userId,
    snapshotId,
    snapshotRevisionId: revisionId,
    triggerReason: 'pulsecheck_oura_refresh',
    selectedRecordIds: sourceRecordDocs.map((record) => record.id),
    droppedRecordIds: [],
    dropReasons: {},
    domainWinnerSummary: nextDomainWinners,
    contractVersions: CONTRACT_VERSIONS,
    createdAt: syncAt,
  };

  return { snapshot, snapshotRevision, assemblyTrace };
}

async function maybeSendBiometricBriefReadyNotification({
  userId,
  timezone,
  requestedDateKey,
  observedDateKey,
}) {
  const todayDateKey = dateKeyInTimeZone(new Date(), timezone);
  if (requestedDateKey !== todayDateKey) {
    return { success: false, reason: 'not_current_day' };
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return { success: false, reason: 'user_not_found' };
  }

  const userData = userSnap.data() || {};
  const pushTarget = resolvePulseCheckPushTarget(userData);
  if (!pushTarget.eligible) {
    return { success: false, reason: pushTarget.reason };
  }
  const fcmToken = pushTarget.token;

  if (userData.mentalTrainingPreferences?.checkInNotificationsEnabled === false) {
    return { success: false, reason: 'notifications_disabled' };
  }

  const nudgeSuppression = await loadPulseCheckNudgeSuppressionState({
    db,
    athleteId: userId,
  });
  if (nudgeSuppression.suppressed) {
    return {
      success: false,
      reason: nudgeSuppression.reason,
      suppressionReason: nudgeSuppression.reason,
    };
  }

  const lastSentSnapshotDateKey = userData.noraNotificationState?.biometricBriefReady?.lastSentSnapshotDateKey;
  if (lastSentSnapshotDateKey === requestedDateKey) {
    return { success: false, reason: 'already_sent_for_snapshot' };
  }

  const notification = buildNoraBiometricBriefNotification({
    athleteName: resolveAthleteFirstName(userData),
    snapshotDateKey: requestedDateKey,
    observedDateKey,
  });

  const result = await sendLoggedNoraPush({
    messaging: admin.messaging(),
    db,
    userId,
    fcmToken,
    title: notification.title,
    body: notification.body,
    subtitle: notification.subtitle,
    data: notification.data,
    notificationType: notification.notificationType,
    functionName: 'netlify/oura-sync',
    additionalContext: {
      mode: 'oura-sync',
      requestedDateKey,
      observedDateKey,
    },
  });

  if (!result.success) {
    return {
      success: false,
      reason: 'send_failed',
      error: result.error || null,
      errorCode: result.errorCode || null,
      failureCategory: result.failureCategory || null,
      needsConsoleConfig: result.needsConsoleConfig === true,
      recommendedAction: result.recommendedAction || null,
    };
  }

  await userRef.set(
    {
      noraNotificationState: {
        biometricBriefReady: {
          lastSentSnapshotDateKey: requestedDateKey,
          lastObservedDateKey: observedDateKey,
          lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
    },
    { merge: true }
  );

  return { success: true, reason: 'sent', messageId: result.messageId || null };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }

  if (!['POST', 'GET'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    initializeFirebaseAdmin(event);
    const decoded = await verifyAuth(event);
    const body = parseJsonBody(event);
    const userId = decoded.uid;
    const timezone = resolveTimeZone(body.timezone);
    const includeDebug = body.includeDebug === true;
    const requestedDateKey = typeof body.snapshotDateKey === 'string' && isValidDateKey(body.snapshotDateKey)
      ? body.snapshotDateKey.trim()
      : dateKeyInTimeZone(new Date(), timezone);
    const syncAt = Date.now() / 1000;

    const connectionRef = admin.firestore().collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(userId));
    const connectionSnap = await connectionRef.get();
    const connection = connectionSnap.exists ? connectionSnap.data() || {} : null;

    if (!connection || connection.status !== 'connected' || !connection.accessToken) {
      throw createError(409, 'Connect Oura before refreshing the recovery lane.');
    }

    const { sleepRecords, readinessRecords, stressRecords } = await fetchOuraData(connectionRef, connection, requestedDateKey);
    const latestSleep = chooseBestSleepRecord(sleepRecords, requestedDateKey);
    const latestReadiness = chooseLatestRecord(readinessRecords, { timestampKeys: ['timestamp'] });
    const latestStress = chooseLatestRecord(stressRecords, { timestampKeys: ['timestamp', 'day'] });
    const resolvedLatestDateKey = firstString(latestSleep, ['day']) || firstString(latestReadiness, ['day']) || requestedDateKey;
    const latestDateKey = isValidDateKey(resolvedLatestDateKey) ? resolvedLatestDateKey : requestedDateKey;
    const sleepSelectionDebug = buildSleepSelectionDebug(sleepRecords, latestSleep, requestedDateKey);
    const sleepPayload = mapSleepPayload(latestSleep || {});
    const readinessPayload = mapReadinessPayload(latestReadiness || {});
    const stressPayload = mapStressPayload(latestStress || {});
    const hasPayload =
      Object.keys(sleepPayload).length > 0 ||
      Object.keys(readinessPayload).length > 0 ||
      Object.keys(stressPayload).length > 0;

    console.log('[oura-sync] Sleep selection summary', {
      userId,
      timezone,
      requestedDateKey,
      observedDateKey: latestDateKey,
      sleepSelectionDebug,
    });

    const sourceStatusDoc = buildSourceStatusDocument({
      userId,
      observedAt: hasPayload ? buildDayWindow(latestDateKey, timezone).endAt : null,
      syncAt,
      lifecycleState: hasPayload ? 'connected_synced' : 'connected_waiting_data',
      lastError: null,
    });

    const sourceStatusRef = admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.sourceStatus).doc(sourceStatusDoc.id);
    const batch = admin.firestore().batch();
    batch.set(sourceStatusRef, sourceStatusDoc, { merge: true });

    if (!hasPayload) {
      await batch.commit();
      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          ok: true,
          status: 'waiting_for_data',
          snapshotDateKey: requestedDateKey,
          detail: 'Oura is connected, but no fresh recovery payload was available yet. Open the Oura app and sync the ring, then try refresh again.',
          ...(includeDebug ? { debug: { sleepSelection: sleepSelectionDebug } } : {}),
        }),
      };
    }

    const sourceRecordDocs = buildSourceRecordDocuments({
      userId,
      dateKey: latestDateKey,
      timezone,
      syncAt,
      sleepPayload,
      readinessPayload,
      stressPayload,
      rawSleep: latestSleep,
      rawReadiness: latestReadiness,
      rawStress: latestStress,
    });

    for (const record of sourceRecordDocs) {
      batch.set(
        admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.sourceRecords).doc(record.id),
        record,
        { merge: true }
      );
    }

    const snapshotDateKeys = uniqueStrings([requestedDateKey, latestDateKey]);
    const existingSnapshots = await Promise.all(
      snapshotDateKeys.map(async (snapshotDateKey) => {
        const snapshotId = `${userId}_daily_${snapshotDateKey}`;
        const snapshot = await admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.snapshots).doc(snapshotId).get();
        return snapshot.data() || null;
      })
    );

    const snapshotArtifacts = snapshotDateKeys.map((snapshotDateKey, index) =>
      buildSnapshotArtifacts({
        userId,
        dateKey: snapshotDateKey,
        timezone,
        syncAt,
        requestedDateKey,
        observedDateKey: latestDateKey,
        sourceStatusDoc,
        sourceRecordDocs,
        sleepPayload,
        readinessPayload,
        stressPayload,
        existingSnapshot: existingSnapshots[index],
      })
    );

    for (const artifacts of snapshotArtifacts) {
      batch.set(
        admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.snapshots).doc(artifacts.snapshot.id),
        artifacts.snapshot,
        { merge: true }
      );
      batch.set(
        admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.snapshotRevisions).doc(artifacts.snapshotRevision.id),
        artifacts.snapshotRevision,
        { merge: true }
      );
      batch.set(
        admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.assemblyTraces).doc(artifacts.assemblyTrace.id),
        artifacts.assemblyTrace,
        { merge: true }
      );
    }

    await batch.commit();

    let biometricBriefNotification = { success: false, reason: 'skipped' };
    if (event.httpMethod === 'POST') {
      try {
        biometricBriefNotification = await maybeSendBiometricBriefReadyNotification({
          userId,
          timezone,
          requestedDateKey,
          observedDateKey: latestDateKey,
        });
      } catch (notificationError) {
        console.warn('[oura-sync] Nora biometric brief notification failed (non-blocking):', notificationError);
        biometricBriefNotification = {
          success: false,
          reason: 'send_failed',
          error: notificationError?.message || 'Unknown error',
        };
      }
    }

    const requestedSnapshot = snapshotArtifacts.find((artifacts) => artifacts.snapshot.snapshotDateKey === requestedDateKey)
      || snapshotArtifacts[0];

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: true,
        status: 'synced',
        snapshotId: requestedSnapshot?.snapshot.id,
        snapshotDateKey: requestedDateKey,
        observedDateKey: latestDateKey,
        updatedSnapshotDateKeys: snapshotArtifacts.map((artifacts) => artifacts.snapshot.snapshotDateKey),
        sourceRecordIds: sourceRecordDocs.map((record) => record.id),
        sourcesUsed: requestedSnapshot?.snapshot.provenance.sourcesUsed || ['oura'],
        biometricBriefNotification,
        detail: 'PulseCheck imported the latest Oura recovery context.',
        ...(includeDebug ? {
          debug: {
            requestedDateKey,
            observedDateKey: latestDateKey,
            sleepSelection: sleepSelectionDebug,
          },
        } : {}),
      }),
    };
  } catch (error) {
    console.error('[oura-sync] Failed:', error);
    return buildOuraErrorResponse(error, {
      errorCode: 'OURA_SYNC_FAILED',
      message: 'We could not refresh your Oura recovery data right now.',
    });
  }
};

exports.__test = {
  chooseLatestRecord,
  chooseBestSleepRecord,
  compareSleepRecords,
  isUsableSleepRecord,
  sleepRecordTypePriority,
  computeSleepMidpointEpochSeconds,
  mapSleepPayload,
  mapStressPayload,
};
