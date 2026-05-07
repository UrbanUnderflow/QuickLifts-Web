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

const POLAR_V4_ACTIVITY_LIST_URL = 'https://www.polaraccesslink.com/v4/data/activity/list';

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

function durationMinutesValue(value) {
  const numeric = numberValue(value);
  if (numeric !== null) return numeric;
  const seconds = durationSecondsValue(value);
  return seconds !== null ? Math.round(seconds / 60) : null;
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

function parseDateKeyParts(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map((part) => Number(part));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return { year, month, day };
}

function timeZoneOffsetMs(date, timezone = 'UTC') {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date).filter((part) => part.type !== 'literal');
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUTC - date.getTime();
}

function zonedDateTimeToUtcMs({ year, month, day, hour = 0, minute = 0, second = 0 }, timezone = 'UTC') {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = timeZoneOffsetMs(new Date(utcGuess), timezone);
  let utc = utcGuess - firstOffset;
  const secondOffset = timeZoneOffsetMs(new Date(utc), timezone);
  if (secondOffset !== firstOffset) {
    utc = utcGuess - secondOffset;
  }
  return utc;
}

function buildDayWindow(dateKey, timezone = 'UTC') {
  const resolvedTimezone = resolveTimeZone(timezone);
  const startParts = parseDateKeyParts(dateKey);
  const endParts = parseDateKeyParts(shiftDateKey(dateKey, 1));
  if (!startParts || !endParts) {
    const startAt = Date.parse(`${dateKey}T00:00:00.000Z`) / 1000;
    const endAt = Date.parse(`${shiftDateKey(dateKey, 1)}T00:00:00.000Z`) / 1000;
    return { startAt, endAt, timezone: 'UTC', windowType: 'daily' };
  }
  const startAt = zonedDateTimeToUtcMs(startParts, resolvedTimezone) / 1000;
  const endAt = zonedDateTimeToUtcMs(endParts, resolvedTimezone) / 1000;
  return { startAt, endAt, timezone: resolvedTimezone, windowType: 'daily' };
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

function polarLinkPath(link) {
  if (!link) return null;
  if (typeof link === 'string') return link.trim() || null;
  if (typeof link !== 'object') return null;
  const raw =
    link.href ||
    link.url ||
    link.uri ||
    link.path ||
    link['resource-uri'] ||
    link.resource_uri;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function appendPolarPathSegment(path, segment) {
  const raw = polarLinkPath(path);
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/${segment}`;
    return url.toString();
  }

  const [pathname, query] = raw.split('?');
  const normalizedPathname = pathname.startsWith('/v3/')
    ? pathname.slice(3)
    : pathname.startsWith('v3/')
      ? pathname.slice(2)
    : pathname;
  const nextPath = `${normalizedPathname.replace(/\/+$/, '')}/${segment}`;
  return query ? `${nextPath}?${query}` : nextPath;
}

function stepSampleEntries(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const candidates = [
    value.samples,
    value['step-samples'],
    value.step_samples,
    value['activity-step-samples'],
    value.activity_step_samples,
    value.data,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  if (value.samples && typeof value.samples === 'object') return Object.values(value.samples);
  return [];
}

function stepSampleValue(sample) {
  if (typeof sample === 'number' || typeof sample === 'string') return numberValue(sample);
  return firstNumeric(
    sample?.steps,
    sample?.stepCount,
    sample?.step_count,
    sample?.['step-count'],
    sample?.count,
    sample?.value,
  );
}

function sumStepSamples(stepSamples) {
  const directTotal = firstNumeric(stepSamples?.total_steps, stepSamples?.['total-steps'], stepSamples?.totalSteps);
  if (directTotal !== null) return directTotal;

  const samples = stepSampleEntries(stepSamples);
  const total = samples.reduce((sum, sample) => {
    const steps = stepSampleValue(sample);
    return steps !== null ? sum + steps : sum;
  }, 0);
  return samples.length > 0 ? total : null;
}

async function enrichActivityRecordWithStepSamples(accessToken, record, recordPath) {
  const stepSamplesPath = appendPolarPathSegment(recordPath, 'step-samples');
  const stepSamples = stepSamplesPath ? await optionalPolarRequest(accessToken, stepSamplesPath) : null;
  const stepSampleTotal = sumStepSamples(stepSamples);
  const stepSamplesCount = stepSampleEntries(stepSamples).length;

  return compactObject({
    ...record,
    steps: stepSampleTotal,
    totalSteps: stepSampleTotal,
    stepSampleCount: stepSamplesCount || null,
    stepSamplesStatus: stepSamples ? (stepSampleTotal !== null ? 'available' : 'empty') : 'unavailable',
    activeSteps: firstNumeric(record?.activeSteps, record?.['active-steps'], record?.active_steps),
  });
}

async function fetchActivityDays(accessToken, dateKey) {
  return optionalPolarRequest(accessToken, POLAR_V4_ACTIVITY_LIST_URL, {
    query: {
      from: dateKey,
      to: shiftDateKey(dateKey, 1),
      features: 'samples',
    },
  });
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
    const recordPath = polarLinkPath(link);
    if (!recordPath) continue;
    const record = await optionalPolarRequest(accessToken, recordPath);
    if (!record) continue;
    records.push(
      transactionFamily === 'activity'
        ? await enrichActivityRecordWithStepSamples(accessToken, record, recordPath)
        : record,
    );
  }

  await optionalPolarRequest(accessToken, listPath, { method: 'PUT' });
  return records;
}

async function fetchPolarData(connection, dateKey) {
  const accessToken = connection.accessToken;
  const polarUserId = connection.polarUserId;
  const [
    sleep,
    recharge,
    continuousHeartRate,
    activitySamples,
    activitySummaries,
    activityDays,
    cardioLoads,
    exercises,
    physicalInfos,
  ] = await Promise.all([
    optionalPolarRequest(accessToken, `/users/sleep/${dateKey}`),
    optionalPolarRequest(accessToken, `/users/nightly-recharge/${dateKey}`),
    optionalPolarRequest(accessToken, `/users/continuous-heart-rate/${dateKey}`),
    optionalPolarRequest(accessToken, `/users/activities/samples/${dateKey}`),
    fetchTransactionRecords(accessToken, polarUserId, 'activity'),
    fetchActivityDays(accessToken, dateKey),
    optionalPolarRequest(accessToken, '/users/cardio-load/'),
    fetchTransactionRecords(accessToken, polarUserId, 'exercise'),
    fetchTransactionRecords(accessToken, polarUserId, 'physical-information'),
  ]);

  return { sleep, recharge, continuousHeartRate, activitySamples, activitySummaries, activityDays, cardioLoads, exercises, physicalInfos };
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

function polarRecordDate(value) {
  const raw =
    value?.date ||
    value?.['date-key'] ||
    value?.activity_date ||
    value?.['activity-date'] ||
    value?.created ||
    value?.start_time ||
    value?.['start-time'];
  if (!raw) return null;
  return String(raw).slice(0, 10);
}

function activityEntries(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value['activity-log'])) return value['activity-log'];
  if (Array.isArray(value.days)) return value.days;
  return [value];
}

function activitySampleDayEntries(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.days)) return value.days;
  if (Array.isArray(value['activity-log'])) return value['activity-log'];
  return [value];
}

function activityDayEntries(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value?.activities?.activityDays)) return value.activities.activityDays;
  if (Array.isArray(value.activityDays)) return value.activityDays;
  if (Array.isArray(value.days)) return value.days;
  return [];
}

function selectActivityDay(entries, dateKey) {
  const normalizedEntries = (entries || []).filter(Boolean);
  const exactMatch = normalizedEntries.find((entry) => polarRecordDate(entry) === dateKey);
  if (exactMatch) return exactMatch;
  return normalizedEntries.find((entry) => !polarRecordDate(entry)) || {};
}

function summarizeV3ActivitySampleSteps(activitySampleDay) {
  const stepsPayload = activitySampleDay?.steps;
  const totalSteps = firstNumeric(
    stepsPayload?.total_steps,
    stepsPayload?.['total-steps'],
    stepsPayload?.totalSteps,
    activitySampleDay?.totalSteps,
    activitySampleDay?.total_steps,
    activitySampleDay?.['total-steps'],
  );
  if (totalSteps !== null) {
    const sampleCount = Array.isArray(stepsPayload?.samples) ? stepsPayload.samples.length : null;
    return { steps: totalSteps, sampleCount };
  }

  const samples = Array.isArray(stepsPayload?.samples) ? stepsPayload.samples : [];
  const total = samples.reduce((sum, sample) => {
    const steps = stepSampleValue(sample);
    return steps !== null ? sum + steps : sum;
  }, 0);
  return {
    steps: samples.length > 0 ? total : null,
    sampleCount: samples.length || null,
  };
}

function summarizeV4ActivitySteps(activityDay) {
  const devices = Array.isArray(activityDay?.activitiesPerDevice) ? activityDay.activitiesPerDevice : [];
  let total = 0;
  let sampleCount = 0;

  for (const device of devices) {
    const samples = Array.isArray(device?.activitySamples) ? device.activitySamples : [];
    for (const sample of samples) {
      const stepValues = Array.isArray(sample?.stepSamples?.steps) ? sample.stepSamples.steps : [];
      for (const stepValue of stepValues) {
        const steps = numberValue(stepValue);
        if (steps === null) continue;
        total += steps;
        sampleCount += 1;
      }
    }
  }

  return {
    steps: sampleCount > 0 ? total : null,
    sampleCount: sampleCount || null,
  };
}

function firstNumeric(...values) {
  for (const value of values) {
    const numeric = numberValue(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

function mapActivityPayload({ activitySamples, activitySummaries, activityDays, cardioLoads }, dateKey) {
  // The activity summary's `active-steps` field is not the same thing as a
  // daily step total. Use the non-transactional v3 sample total first because
  // it works with the existing accesslink.read_all scope, then transaction
  // step samples, then the v4 daily activity sample list.
  const v3ActivitySampleDay = selectActivityDay(activitySampleDayEntries(activitySamples), dateKey);
  const v3StepSummary = summarizeV3ActivitySampleSteps(v3ActivitySampleDay);
  const summaryDay = selectActivityDay(activityEntries(activitySummaries), dateKey);
  const v4ActivityDay = selectActivityDay(activityDayEntries(activityDays), dateKey);
  const v4StepSummary = summarizeV4ActivitySteps(v4ActivityDay);
  const matchingCardio = (Array.isArray(cardioLoads) ? cardioLoads : [])
    .find((entry) => polarRecordDate(entry) === dateKey) || {};
  const hasSummaryDay = Object.keys(v3ActivitySampleDay).length > 0 || Object.keys(summaryDay).length > 0 || Object.keys(v4ActivityDay).length > 0;
  if (!hasSummaryDay) {
    return compactObject({
      cardioLoad: numberValue(matchingCardio?.cardio_load),
      cardioLoadStatus: matchingCardio?.cardio_load_status || null,
    });
  }

  const transactionSteps = firstNumeric(summaryDay?.steps, summaryDay?.totalSteps, summaryDay?.total_steps, summaryDay?.['total-steps']);
  const totalSteps = firstNumeric(v3StepSummary.steps, transactionSteps, v4StepSummary.steps);
  const activeSteps = firstNumeric(summaryDay?.activeSteps, summaryDay?.['active-steps'], summaryDay?.active_steps);
  const stepSampleCount = firstNumeric(
    v3StepSummary.sampleCount,
    summaryDay?.stepSampleCount,
    summaryDay?.step_sample_count,
    summaryDay?.['step-sample-count'],
    v4StepSummary.sampleCount,
  );

  return compactObject({
    steps: totalSteps,
    totalSteps,
    activeSteps,
    stepsSource: v3StepSummary.steps !== null
      ? 'polar_v3_activity_samples'
      : transactionSteps !== null
      ? 'polar_activity_step_samples'
      : v4StepSummary.steps !== null
        ? 'polar_v4_activity_samples'
        : null,
    stepSampleCount,
    stepSamplesStatus: v3StepSummary.steps !== null
      ? 'available'
      : summaryDay?.stepSamplesStatus || (v4StepSummary.steps !== null ? 'available' : null),
    activeCalories: firstNumeric(summaryDay?.['active-calories'], summaryDay?.active_calories, summaryDay?.calories),
    exerciseMinutes: durationMinutesValue(summaryDay?.['active-time'] || summaryDay?.active_time || summaryDay?.duration),
    activityGoalPercentage: firstNumeric(summaryDay?.activity_goal, summaryDay?.['activity-goal'], summaryDay?.['activity-goal-percentage']),
    cardioLoad: numberValue(matchingCardio?.cardio_load),
    cardioLoadStatus: matchingCardio?.cardio_load_status || null,
  });
}

function buildActivityDebug({ activitySamples, activitySummaries, activityDays, activityPayload, dateKey }) {
  const v3Entries = activitySampleDayEntries(activitySamples);
  const selectedV3ActivitySampleDay = selectActivityDay(v3Entries, dateKey);
  const selectedV3StepSummary = summarizeV3ActivitySampleSteps(selectedV3ActivitySampleDay);
  const entries = activityEntries(activitySummaries);
  const selected = selectActivityDay(entries, dateKey);
  const v4Entries = activityDayEntries(activityDays);
  const selectedV4ActivityDay = selectActivityDay(v4Entries, dateKey);
  const selectedV4StepSummary = summarizeV4ActivitySteps(selectedV4ActivityDay);
  return compactObject({
    requestedDateKey: dateKey,
    v3ActivitySampleDayCount: v3Entries.length,
    selectedV3ActivityDateKey: polarRecordDate(selectedV3ActivitySampleDay),
    selectedV3Steps: selectedV3StepSummary.steps,
    selectedV3StepSampleCount: selectedV3StepSummary.sampleCount,
    activitySummaryCount: entries.length,
    selectedActivityDateKey: polarRecordDate(selected),
    selectedSteps: firstNumeric(selected?.steps, selected?.totalSteps, selected?.total_steps, selected?.['total-steps']),
    selectedActiveSteps: firstNumeric(selected?.activeSteps, selected?.['active-steps'], selected?.active_steps),
    selectedStepSampleCount: firstNumeric(selected?.stepSampleCount, selected?.step_sample_count, selected?.['step-sample-count']),
    selectedStepSamplesStatus: selected?.stepSamplesStatus,
    v4ActivityDayCount: v4Entries.length,
    selectedV4ActivityDateKey: polarRecordDate(selectedV4ActivityDay),
    selectedV4Steps: selectedV4StepSummary.steps,
    selectedV4StepSampleCount: selectedV4StepSummary.sampleCount,
    importedSteps: activityPayload?.steps,
    importedActiveSteps: activityPayload?.activeSteps,
    importedStepsSource: activityPayload?.stepsSource,
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

function buildSourceRecord({ userId, dateKey, timezone, syncAt, domain, sourceType, payload, raw }) {
  const sourceWindow = buildDayWindow(dateKey, timezone);
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
    timezone: sourceWindow.timezone,
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
  const sourceWindow = buildDayWindow(dateKey, timezone);
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
    sourceWindow,
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

async function syncPolarSnapshotForConnection({ userId, timezone, requestedDateKey, connectionRef, connection }) {
  const freshConnection = await ensureFreshPolarConnection(connectionRef, connection);
  const polarData = await fetchPolarData(freshConnection, requestedDateKey);
  const payloads = {
    recovery: mapRecoveryPayload(polarData),
    biometrics: mapBiometricsPayload(polarData),
    activity: mapActivityPayload(polarData, requestedDateKey),
    training: mapTrainingPayload(polarData),
  };
  const activityDebug = buildActivityDebug({
    activitySamples: polarData.activitySamples,
    activitySummaries: polarData.activitySummaries,
    activityDays: polarData.activityDays,
    activityPayload: payloads.activity,
    dateKey: requestedDateKey,
  });
  const syncAt = Date.now() / 1000;
  const hasPayload = Object.values(payloads).some((payload) => Object.keys(payload).length > 0);
  const observedAt = hasPayload ? buildDayWindow(requestedDateKey, timezone).endAt : null;
  const sourceStatusDoc = buildSourceStatusDocument({ userId, hasPayload, observedAt, syncAt, lastError: null });

  const firestore = admin.firestore();
  const batch = firestore.batch();
  batch.set(firestore.collection(HEALTH_CONTEXT_COLLECTIONS.sourceStatus).doc(sourceStatusDoc.id), sourceStatusDoc, { merge: true });
  batch.set(connectionRef, {
    lastSyncAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    lastRequestedSnapshotDateKey: requestedDateKey,
    lastSyncTimezone: timezone,
    lastPolarActivityDebug: activityDebug,
    pendingWebhookSync: false,
    pendingWebhookDateKey: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastError: '',
  }, { merge: true });

  if (!hasPayload) {
    await batch.commit();
    return {
      ok: true,
      status: 'waiting_for_data',
      snapshotDateKey: requestedDateKey,
      activityDebug,
      detail: 'Polar is connected, but no synced Polar Flow data was available for this date yet.',
    };
  }

  const sourceRecordDocs = Object.entries(payloads)
    .filter(([, payload]) => Object.keys(payload).length > 0)
    .map(([domain, payload]) => buildSourceRecord({
      userId,
      dateKey: requestedDateKey,
      timezone,
      syncAt,
      domain,
      sourceType: `pulsecheck_polar_${domain}`,
      payload,
      raw: domain === 'activity'
        ? {
          activitySamples: polarData.activitySamples,
          activitySummaries: polarData.activitySummaries,
          activityDays: polarData.activityDays,
        }
        : polarData[domain],
    }));

  for (const record of sourceRecordDocs) {
    batch.set(firestore.collection(HEALTH_CONTEXT_COLLECTIONS.sourceRecords).doc(record.id), record);
  }

  const snapshotId = `${userId}_daily_${requestedDateKey}`;
  const existingSnapshotSnap = await firestore.collection(HEALTH_CONTEXT_COLLECTIONS.snapshots).doc(snapshotId).get();
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

  batch.set(firestore.collection(HEALTH_CONTEXT_COLLECTIONS.snapshots).doc(artifacts.snapshot.id), artifacts.snapshot, { merge: true });
  batch.set(firestore.collection(HEALTH_CONTEXT_COLLECTIONS.snapshotRevisions).doc(artifacts.snapshotRevision.id), artifacts.snapshotRevision, { merge: true });
  batch.set(firestore.collection(HEALTH_CONTEXT_COLLECTIONS.assemblyTraces).doc(artifacts.assemblyTrace.id), artifacts.assemblyTrace, { merge: true });
  batch.set(connectionRef, {
    lastSuccessfulSyncAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSuccessfulSnapshotDateKey: requestedDateKey,
    lastImportedDomains: Object.entries(payloads).filter(([, payload]) => Object.keys(payload).length > 0).map(([domain]) => domain),
    lastPolarActivityDebug: activityDebug,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();

  return {
    ok: true,
    status: 'synced',
    snapshotId,
    snapshotDateKey: requestedDateKey,
    sourceRecordIds: sourceRecordDocs.map((record) => record.id),
    sourcesUsed: artifacts.snapshot.provenance.sourcesUsed,
    importedDomains: Object.entries(payloads).filter(([, payload]) => Object.keys(payload).length > 0).map(([domain]) => domain),
    activityDebug,
    detail: 'PulseCheck imported the latest Polar health context.',
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
    const connectionRef = admin.firestore().collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(userId));
    const connectionSnap = await connectionRef.get();
    const connection = connectionSnap.exists ? connectionSnap.data() || {} : null;

    const result = await syncPolarSnapshotForConnection({
      userId,
      timezone,
      requestedDateKey,
      connectionRef,
      connection,
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify(result),
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
  buildDayWindow,
  computeSleepMidpointEpochSeconds,
  mapRecoveryPayload,
  mapBiometricsPayload,
  mapActivityPayload,
  buildActivityDebug,
  sumStepSamples,
  summarizeV3ActivitySampleSteps,
  summarizeV4ActivitySteps,
  mapTrainingPayload,
};

exports.syncPolarSnapshotForConnection = syncPolarSnapshotForConnection;
exports.dateKeyInTimeZone = dateKeyInTimeZone;
exports.shiftDateKey = shiftDateKey;
exports.resolveTimeZone = resolveTimeZone;
