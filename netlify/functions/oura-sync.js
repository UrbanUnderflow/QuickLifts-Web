const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildConnectionDocId,
  createError,
  getOauthCredentials,
  verifyAuth,
} = require('./oura-utils');

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

function buildDayWindow(dateKey, timezone = 'UTC') {
  const startAt = Date.parse(`${dateKey}T00:00:00.000Z`) / 1000;
  return {
    startAt,
    endAt: startAt + 24 * 60 * 60,
    timezone,
    windowType: 'daily',
  };
}

function chooseLatestRecord(records) {
  return (records || [])
    .filter(Boolean)
    .sort((left, right) => {
      const leftDay = firstString(left, ['day']) || '';
      const rightDay = firstString(right, ['day']) || '';
      return rightDay.localeCompare(leftDay);
    })[0] || null;
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

function mapSleepPayload(record) {
  return compactObject({
    sleepDuration: secondsToHours(firstNumber(record, ['total_sleep_duration'])),
    deepSleepDuration: secondsToHours(firstNumber(record, ['deep_sleep_duration'])),
    remSleepDuration: secondsToHours(firstNumber(record, ['rem_sleep_duration'])),
    sleepEfficiency: firstNumber(record, ['efficiency']),
    timeInBedHours: secondsToHours(firstNumber(record, ['time_in_bed'])),
    heartRateResting: firstNumber(record, ['lowest_heart_rate', 'resting_heart_rate', 'average_heart_rate']),
    heartRateVariability: firstNumber(record, ['average_hrv', 'hrv']),
    respiratoryRate: firstNumber(record, ['average_breath', 'respiratory_rate']),
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
    const [sleepRecords, readinessRecords] = await Promise.all([
      fetchOuraCollection(accessToken, 'sleep', {
        start_date: startDate,
        end_date: endDate,
      }),
      fetchOuraCollection(accessToken, 'daily_readiness', {
        start_date: startDate,
        end_date: endDate,
      }),
    ]);

    return { sleepRecords, readinessRecords };
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

function buildSourceRecordDocuments({ userId, dateKey, timezone, syncAt, sleepPayload, readinessPayload, rawSleep, rawReadiness }) {
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

  return records;
}

function buildSnapshotArtifacts({
  userId,
  dateKey,
  timezone,
  syncAt,
  sourceStatusDoc,
  sourceRecordDocs,
  sleepPayload,
  readinessPayload,
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
      }),
      summary: compactObject({
        ...(existingDomains.summary || {}),
        dataSourcesUsed: nextSourcesUsed,
        lastSyncTimestamp: syncAt,
        syncOrigin: 'pulsecheck_oura_refresh',
        ouraLastSyncTimestamp: syncAt,
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
    const requestedDateKey = typeof body.snapshotDateKey === 'string' && body.snapshotDateKey.trim()
      ? body.snapshotDateKey.trim()
      : isoDateKey();
    const timezone = typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : 'UTC';
    const syncAt = Date.now() / 1000;

    const connectionRef = admin.firestore().collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(userId));
    const connectionSnap = await connectionRef.get();
    const connection = connectionSnap.exists ? connectionSnap.data() || {} : null;

    if (!connection || connection.status !== 'connected' || !connection.accessToken) {
      throw createError(409, 'Connect Oura before refreshing the recovery lane.');
    }

    const { sleepRecords, readinessRecords } = await fetchOuraData(connectionRef, connection, requestedDateKey);
    const latestSleep = chooseLatestRecord(sleepRecords);
    const latestReadiness = chooseLatestRecord(readinessRecords);
    const latestDateKey = firstString(latestSleep, ['day']) || firstString(latestReadiness, ['day']) || requestedDateKey;
    const sleepPayload = mapSleepPayload(latestSleep || {});
    const readinessPayload = mapReadinessPayload(latestReadiness || {});
    const hasPayload = Object.keys(sleepPayload).length > 0 || Object.keys(readinessPayload).length > 0;

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
      rawSleep: latestSleep,
      rawReadiness: latestReadiness,
    });

    for (const record of sourceRecordDocs) {
      batch.set(
        admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.sourceRecords).doc(record.id),
        record,
        { merge: true }
      );
    }

    const snapshotId = `${userId}_daily_${latestDateKey}`;
    const existingSnapshot = (await admin.firestore().collection(HEALTH_CONTEXT_COLLECTIONS.snapshots).doc(snapshotId).get()).data() || null;
    const artifacts = buildSnapshotArtifacts({
      userId,
      dateKey: latestDateKey,
      timezone,
      syncAt,
      sourceStatusDoc,
      sourceRecordDocs,
      sleepPayload,
      readinessPayload,
      existingSnapshot,
    });

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

    await batch.commit();

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: true,
        status: 'synced',
        snapshotId: artifacts.snapshot.id,
        snapshotDateKey: latestDateKey,
        sourceRecordIds: sourceRecordDocs.map((record) => record.id),
        sourcesUsed: artifacts.snapshot.provenance.sourcesUsed,
        detail: 'PulseCheck imported the latest Oura recovery context.',
      }),
    };
  } catch (error) {
    console.error('[oura-sync] Failed:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to refresh Oura recovery data.',
      }),
    };
  }
};
