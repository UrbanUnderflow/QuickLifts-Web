const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildConnectionDocId,
  buildGoogleHealthErrorResponse,
  ensureFreshGoogleHealthConnection,
  getGoogleHealthIdentity,
  googleHealthApiRequest,
  parseJsonBody,
  verifyAuth,
} = require('./google-health-utils');

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

const GOOGLE_WEARABLES_SOURCE_FAMILY = 'users/me/dataSourceFamilies/google-wearables';

const DATA_TYPE_PAYLOAD_KEYS = {
  'active-energy-burned': ['activeEnergyBurned', 'active_energy_burned'],
  'active-minutes': ['activeMinutes', 'active_minutes'],
  'active-zone-minutes': ['activeZoneMinutes', 'active_zone_minutes'],
  'body-fat': ['bodyFat', 'body_fat'],
  'daily-heart-rate-variability': ['dailyHeartRateVariability', 'daily_heart_rate_variability'],
  'daily-oxygen-saturation': ['dailyOxygenSaturation', 'daily_oxygen_saturation'],
  'daily-respiratory-rate': ['dailyRespiratoryRate', 'daily_respiratory_rate'],
  'daily-resting-heart-rate': ['dailyRestingHeartRate', 'daily_resting_heart_rate'],
  'daily-sleep-temperature-derivations': ['dailySleepTemperatureDerivations', 'daily_sleep_temperature_derivations'],
  'daily-vo2-max': ['dailyVo2Max', 'daily_vo2_max'],
  distance: ['distance'],
  exercise: ['exercise'],
  'heart-rate': ['heartRate', 'heart_rate'],
  'heart-rate-variability': ['heartRateVariability', 'heart_rate_variability'],
  sleep: ['sleep'],
  steps: ['steps'],
  'total-calories': ['totalCalories', 'total_calories'],
  weight: ['weight'],
};

const DATA_TYPE_FILTER_KEYS = {
  'active-energy-burned': 'active_energy_burned',
  'active-minutes': 'active_minutes',
  'active-zone-minutes': 'active_zone_minutes',
  'body-fat': 'body_fat',
  'daily-heart-rate-variability': 'daily_heart_rate_variability',
  'daily-oxygen-saturation': 'daily_oxygen_saturation',
  'daily-respiratory-rate': 'daily_respiratory_rate',
  'daily-resting-heart-rate': 'daily_resting_heart_rate',
  'daily-sleep-temperature-derivations': 'daily_sleep_temperature_derivations',
  'daily-vo2-max': 'daily_vo2_max',
  distance: 'distance',
  exercise: 'exercise',
  'heart-rate': 'heart_rate',
  'heart-rate-variability': 'heart_rate_variability',
  sleep: 'sleep',
  steps: 'steps',
  'total-calories': 'total_calories',
  weight: 'weight',
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

function firstNumeric(...values) {
  for (const value of values) {
    const numeric = numberValue(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

function secondsToHours(value) {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  return Math.round((numeric / 3600) * 100) / 100;
}

function minutesToHours(value) {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  return Math.round((numeric / 60) * 100) / 100;
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

function buildCivilDayRange(dateKey) {
  const start = parseDateKeyParts(dateKey);
  const end = parseDateKeyParts(dateKey);
  if (!start || !end) return null;
  return {
    start: {
      date: start,
      time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
    },
    end: {
      date: end,
      time: { hours: 23, minutes: 59, seconds: 59, nanos: 0 },
    },
  };
}

function buildPhysicalDayRange(dateKey, timezone) {
  const dayWindow = buildDayWindow(dateKey, timezone);
  return {
    startIso: new Date(dayWindow.startAt * 1000).toISOString(),
    endIso: new Date(dayWindow.endAt * 1000 - 1000).toISOString(),
  };
}

function computeSleepMidpointEpochSeconds(startIso, endIso) {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return Math.round(((startMs + endMs) / 2) / 1000);
}

async function optionalGoogleHealthRequest(accessToken, path, options = {}) {
  try {
    return await googleHealthApiRequest(accessToken, path, options);
  } catch (error) {
    if ([204, 404].includes(error?.googleHealthStatus || error?.statusCode)) return null;
    console.warn('[google-health-sync] optional Google Health fetch failed:', path, error?.message || error);
    return null;
  }
}

function dataPointsFromResponse(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  return [
    ...(Array.isArray(response.dataPoints) ? response.dataPoints : []),
    ...(Array.isArray(response.rollupDataPoints) ? response.rollupDataPoints : []),
  ];
}

async function fetchPagedDataPoints(accessToken, path, query) {
  const dataPoints = [];
  let pageToken = '';
  for (let page = 0; page < 5; page += 1) {
    const response = await optionalGoogleHealthRequest(accessToken, path, {
      query: {
        ...(query || {}),
        ...(pageToken ? { pageToken } : {}),
      },
    });
    dataPoints.push(...dataPointsFromResponse(response));
    pageToken = response?.nextPageToken || response?.next_page_token || '';
    if (!pageToken) break;
  }
  return { dataPoints };
}

async function dailyRollUpDataType(accessToken, dataType, dateKey) {
  const range = buildCivilDayRange(dateKey);
  if (!range) return null;
  return optionalGoogleHealthRequest(accessToken, `/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`, {
    method: 'POST',
    body: {
      range,
      windowSizeDays: 1,
    },
  });
}

async function reconcileDataPoints(accessToken, dataType, query = {}) {
  return fetchPagedDataPoints(accessToken, `/users/me/dataTypes/${dataType}/dataPoints:reconcile`, {
    dataSourceFamily: GOOGLE_WEARABLES_SOURCE_FAMILY,
    pageSize: 1000,
    ...query,
  });
}

async function listDataPoints(accessToken, dataType, query = {}) {
  return fetchPagedDataPoints(accessToken, `/users/me/dataTypes/${dataType}/dataPoints`, {
    pageSize: 1000,
    ...query,
  });
}

function payloadForDataType(point, dataType) {
  if (!point || typeof point !== 'object') return {};
  const keys = DATA_TYPE_PAYLOAD_KEYS[dataType] || [dataType];
  for (const key of keys) {
    if (point[key] && typeof point[key] === 'object') return point[key];
  }
  return {};
}

function sumMetric(dataPoints, dataType, keys) {
  let total = 0;
  let count = 0;
  for (const point of dataPointsFromResponse(dataPoints)) {
    const payload = payloadForDataType(point, dataType);
    const value = firstNumeric(...keys.map((key) => payload?.[key]));
    if (value === null) continue;
    total += value;
    count += 1;
  }
  return count > 0 ? total : null;
}

function latestDataPoint(dataPoints, dataType) {
  const entries = dataPointsFromResponse(dataPoints)
    .map((point) => ({ point, payload: payloadForDataType(point, dataType) }))
    .filter(({ payload }) => payload && Object.keys(payload).length > 0);
  entries.sort((left, right) => {
    const leftTime = dataPointTime(left.point, left.payload);
    const rightTime = dataPointTime(right.point, right.payload);
    return rightTime - leftTime;
  });
  return entries[0] || null;
}

function dataPointTime(point, payload) {
  const raw =
    payload?.sampleTime?.physicalTime ||
    payload?.sampleTime?.civilTime ||
    payload?.interval?.endTime ||
    point?.endTime ||
    point?.updateTime ||
    point?.createTime ||
    point?.civilEndTime?.date;
  if (!raw) return 0;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const date = raw?.date || raw;
  if (date?.year && date?.month && date?.day) {
    return Date.UTC(date.year, date.month - 1, date.day);
  }
  return 0;
}

function stageMinutes(summary, type) {
  const stages = Array.isArray(summary?.stagesSummary) ? summary.stagesSummary : [];
  const stage = stages.find((entry) => String(entry?.type || '').toUpperCase() === type);
  return firstNumeric(stage?.minutes, stage?.durationMinutes, stage?.value);
}

function sleepQualityScore(sleepPayload) {
  const efficiency = numberValue(sleepPayload.sleepEfficiency);
  if (efficiency === null) return null;
  const bounded = efficiency <= 1 ? efficiency : efficiency / 100;
  return Math.round(Math.max(0, Math.min(1, bounded)) * 100);
}

function selectSleepRecord(sleepData, dateKey) {
  const entries = dataPointsFromResponse(sleepData)
    .map((point) => ({ point, sleep: payloadForDataType(point, 'sleep') }))
    .filter(({ sleep }) => sleep && Object.keys(sleep).length > 0);
  entries.sort((left, right) => {
    const leftMain = left.sleep?.metadata?.main === true ? 1 : 0;
    const rightMain = right.sleep?.metadata?.main === true ? 1 : 0;
    if (leftMain !== rightMain) return rightMain - leftMain;
    const leftMinutes = firstNumeric(left.sleep?.summary?.minutesAsleep, left.sleep?.summary?.minutesInSleepPeriod) || 0;
    const rightMinutes = firstNumeric(right.sleep?.summary?.minutesAsleep, right.sleep?.summary?.minutesInSleepPeriod) || 0;
    if (leftMinutes !== rightMinutes) return rightMinutes - leftMinutes;
    return dataPointTime(right.point, right.sleep) - dataPointTime(left.point, left.sleep);
  });
  const exact = entries.find(({ sleep }) => String(sleep?.interval?.endTime || '').slice(0, 10) === dateKey);
  return exact || entries[0] || null;
}

function mapSleepPayload(sleepData, dateKey) {
  const selected = selectSleepRecord(sleepData, dateKey);
  const sleep = selected?.sleep || {};
  const summary = sleep.summary || {};
  const start = sleep?.interval?.startTime || null;
  const end = sleep?.interval?.endTime || null;
  const minutesAsleep = firstNumeric(summary.minutesAsleep, summary.asleepMinutes);
  const minutesInBed = firstNumeric(summary.minutesInSleepPeriod, summary.minutesInBed);
  const efficiency = minutesAsleep !== null && minutesInBed !== null && minutesInBed > 0
    ? Math.round((minutesAsleep / minutesInBed) * 100) / 100
    : null;
  const payload = compactObject({
    sleepDuration: minutesAsleep !== null ? minutesToHours(minutesAsleep) : start && end ? secondsToHours((Date.parse(end) - Date.parse(start)) / 1000) : null,
    timeInBed: minutesInBed !== null ? minutesToHours(minutesInBed) : null,
    deepSleepDuration: minutesToHours(stageMinutes(summary, 'DEEP')),
    remSleepDuration: minutesToHours(stageMinutes(summary, 'REM')),
    lightSleepDuration: minutesToHours(stageMinutes(summary, 'LIGHT')),
    awakeDuration: minutesToHours(stageMinutes(summary, 'AWAKE') || summary.minutesAwake),
    sleepEfficiency: efficiency,
    bedtimeStart: start,
    bedtimeEnd: end,
    sleepMidpoint: computeSleepMidpointEpochSeconds(start, end),
    sleepStagesStatus: sleep?.metadata?.stagesStatus || null,
    fitbitMainSleep: sleep?.metadata?.main === true,
    rawDeviceDisplayName: selected?.point?.dataSource?.device?.displayName || null,
    rawPlatform: selected?.point?.dataSource?.platform || null,
  });
  return compactObject({
    ...payload,
    sleepScore: sleepQualityScore(payload),
  });
}

function metricValue(dataPoints, dataType, keys) {
  const latest = latestDataPoint(dataPoints, dataType);
  if (!latest) return null;
  const payload = latest.payload;
  return firstNumeric(...keys.map((key) => payload?.[key]));
}

function mapRecoveryPayload(data) {
  const sleepPayload = mapSleepPayload(data.sleep, data.dateKey);
  return compactObject({
    ...sleepPayload,
    heartRateResting: metricValue(data.dailyRestingHeartRate, 'daily-resting-heart-rate', [
      'bpm',
      'beatsPerMinute',
      'bpmAvg',
      'value',
    ]),
    heartRateVariability: metricValue(data.dailyHeartRateVariability, 'daily-heart-rate-variability', [
      'rmssdMillis',
      'rootMeanSquareSuccessiveDifferenceMs',
      'milliseconds',
      'value',
    ]),
    oxygenSaturation: metricValue(data.dailyOxygenSaturation, 'daily-oxygen-saturation', [
      'percentage',
      'saturationPercentage',
      'oxygenSaturationPercentage',
      'value',
    ]),
    respiratoryRate: metricValue(data.dailyRespiratoryRate, 'daily-respiratory-rate', [
      'breathsPerMinute',
      'rpm',
      'rate',
      'value',
    ]),
    sleepTemperatureDeviationCelsius: metricValue(data.dailySleepTemperatureDerivations, 'daily-sleep-temperature-derivations', [
      'deviationCelsius',
      'temperatureDeviationCelsius',
      'value',
    ]),
  });
}

function mapActivityPayload(data) {
  const steps = sumMetric(data.steps, 'steps', ['countSum', 'count', 'valueSum', 'value']);
  return compactObject({
    steps,
    totalSteps: steps,
    activeCalories: sumMetric(data.activeEnergyBurned, 'active-energy-burned', [
      'caloriesSum',
      'kilocaloriesSum',
      'kcaloriesSum',
      'energyKcalSum',
      'valueSum',
      'calories',
      'value',
    ]),
    totalCalories: sumMetric(data.totalCalories, 'total-calories', [
      'caloriesSum',
      'kilocaloriesSum',
      'kcaloriesSum',
      'valueSum',
      'calories',
      'value',
    ]),
    activeMinutes: sumMetric(data.activeMinutes, 'active-minutes', [
      'minutesSum',
      'activeMinutesSum',
      'durationMinutesSum',
      'valueSum',
      'minutes',
      'value',
    ]),
    activeZoneMinutes: sumMetric(data.activeZoneMinutes, 'active-zone-minutes', [
      'minutesSum',
      'activeZoneMinutesSum',
      'zoneMinutesSum',
      'valueSum',
      'minutes',
      'value',
    ]),
    distanceMeters: sumMetric(data.distance, 'distance', [
      'metersSum',
      'distanceMetersSum',
      'meterSum',
      'valueSum',
      'distanceMeters',
      'meters',
      'value',
    ]),
    dataSourceFamily: 'google-wearables',
  });
}

function intervalDurationSeconds(interval = {}) {
  const startMs = Date.parse(interval.startTime || interval.physicalStartTime || '');
  const endMs = Date.parse(interval.endTime || interval.physicalEndTime || '');
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return Math.round((endMs - startMs) / 1000);
}

function mapTrainingPayload(data) {
  const workouts = dataPointsFromResponse(data.exercise)
    .map((point) => {
      const exercise = payloadForDataType(point, 'exercise');
      const interval = exercise.interval || {};
      const durationSeconds = firstNumeric(exercise.durationSeconds, exercise.duration?.seconds)
        || intervalDurationSeconds(interval);
      return compactObject({
        id: point.name || exercise.id || interval.startTime,
        sport: exercise.activityType || exercise.exerciseType || exercise.sport || exercise.name,
        startedAt: interval.startTime || exercise.startTime,
        endedAt: interval.endTime || exercise.endTime,
        durationSeconds,
        distanceMeters: firstNumeric(exercise.distanceMeters, exercise.distance?.meters, exercise.distance),
        calories: firstNumeric(exercise.activeEnergyBurned?.calories, exercise.calories, exercise.energyKcal),
        rawDeviceDisplayName: point?.dataSource?.device?.displayName || null,
        rawPlatform: point?.dataSource?.platform || null,
      });
    })
    .filter((workout) => Object.keys(workout).length > 0)
    .slice(0, 12);
  const durations = workouts.map((workout) => numberValue(workout.durationSeconds)).filter((value) => value !== null);
  return compactObject({
    workoutCount: workouts.length || null,
    totalWorkoutDurationMinutes: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / 60) : null,
    workouts,
  });
}

function heartRateValues(dataPoints) {
  return dataPointsFromResponse(dataPoints)
    .map((point) => payloadForDataType(point, 'heart-rate'))
    .map((payload) => firstNumeric(payload.bpm, payload.beatsPerMinute, payload.value))
    .filter((value) => value !== null);
}

function mapBiometricsPayload(data) {
  const samples = heartRateValues(data.heartRate);
  return compactObject({
    heartRateAvg: avg(samples),
    heartRateMin: min(samples),
    heartRateMax: max(samples),
    continuousHeartRateSampleCount: samples.length || null,
    heartRateResting: metricValue(data.dailyRestingHeartRate, 'daily-resting-heart-rate', [
      'bpm',
      'beatsPerMinute',
      'bpmAvg',
      'value',
    ]),
    heartRateVariability: metricValue(data.dailyHeartRateVariability, 'daily-heart-rate-variability', [
      'rmssdMillis',
      'rootMeanSquareSuccessiveDifferenceMs',
      'milliseconds',
      'value',
    ]),
    oxygenSaturation: metricValue(data.dailyOxygenSaturation, 'daily-oxygen-saturation', [
      'percentage',
      'saturationPercentage',
      'oxygenSaturationPercentage',
      'value',
    ]),
    respiratoryRate: metricValue(data.dailyRespiratoryRate, 'daily-respiratory-rate', [
      'breathsPerMinute',
      'rpm',
      'rate',
      'value',
    ]),
    vo2Max: metricValue(data.dailyVo2Max, 'daily-vo2-max', [
      'vo2MillilitersPerMinuteKilogram',
      'mlPerKgMin',
      'value',
    ]),
    bodyWeight: metricValue(data.weight, 'weight', ['kilograms', 'kg', 'value']),
    bodyFatPercentage: metricValue(data.bodyFat, 'body-fat', ['percentage', 'percent', 'value']),
  });
}

function filterForInterval(dataType, dateKey, dateField = 'civil_start_time') {
  const filterKey = DATA_TYPE_FILTER_KEYS[dataType] || dataType;
  return `${filterKey}.interval.${dateField} >= "${dateKey}T00:00:00"`;
}

function filterForSample(dataType, startIso, endIso) {
  const filterKey = DATA_TYPE_FILTER_KEYS[dataType] || dataType;
  return `${filterKey}.sample_time.physical_time >= "${startIso}" AND ${filterKey}.sample_time.physical_time <= "${endIso}"`;
}

async function fetchGoogleHealthData(connection, dateKey, timezone) {
  const accessToken = connection.accessToken;
  const physicalRange = buildPhysicalDayRange(dateKey, timezone);
  const [
    steps,
    activeEnergyBurned,
    activeMinutes,
    activeZoneMinutes,
    distance,
    totalCalories,
    sleep,
    exercise,
    heartRate,
    dailyHeartRateVariability,
    dailyRestingHeartRate,
    dailyOxygenSaturation,
    dailyRespiratoryRate,
    dailySleepTemperatureDerivations,
    dailyVo2Max,
    weight,
    bodyFat,
  ] = await Promise.all([
    dailyRollUpDataType(accessToken, 'steps', dateKey),
    dailyRollUpDataType(accessToken, 'active-energy-burned', dateKey),
    dailyRollUpDataType(accessToken, 'active-minutes', dateKey),
    dailyRollUpDataType(accessToken, 'active-zone-minutes', dateKey),
    dailyRollUpDataType(accessToken, 'distance', dateKey),
    dailyRollUpDataType(accessToken, 'total-calories', dateKey),
    reconcileDataPoints(accessToken, 'sleep', {
      filter: `${DATA_TYPE_FILTER_KEYS.sleep}.interval.civil_end_time >= "${dateKey}"`,
    }),
    reconcileDataPoints(accessToken, 'exercise', {
      filter: filterForInterval('exercise', dateKey),
    }),
    reconcileDataPoints(accessToken, 'heart-rate', {
      filter: filterForSample('heart-rate', physicalRange.startIso, physicalRange.endIso),
    }),
    listDataPoints(accessToken, 'daily-heart-rate-variability', {
      filter: filterForSample('daily-heart-rate-variability', physicalRange.startIso, physicalRange.endIso),
    }),
    listDataPoints(accessToken, 'daily-resting-heart-rate', {
      filter: filterForSample('daily-resting-heart-rate', physicalRange.startIso, physicalRange.endIso),
    }),
    listDataPoints(accessToken, 'daily-oxygen-saturation', {
      filter: filterForSample('daily-oxygen-saturation', physicalRange.startIso, physicalRange.endIso),
    }),
    listDataPoints(accessToken, 'daily-respiratory-rate', {
      filter: filterForSample('daily-respiratory-rate', physicalRange.startIso, physicalRange.endIso),
    }),
    listDataPoints(accessToken, 'daily-sleep-temperature-derivations', {
      filter: filterForSample('daily-sleep-temperature-derivations', physicalRange.startIso, physicalRange.endIso),
    }),
    listDataPoints(accessToken, 'daily-vo2-max', {
      filter: filterForSample('daily-vo2-max', physicalRange.startIso, physicalRange.endIso),
    }),
    listDataPoints(accessToken, 'weight', {
      filter: filterForSample('weight', physicalRange.startIso, physicalRange.endIso),
    }),
    listDataPoints(accessToken, 'body-fat', {
      filter: filterForSample('body-fat', physicalRange.startIso, physicalRange.endIso),
    }),
  ]);

  return {
    dateKey,
    steps,
    activeEnergyBurned,
    activeMinutes,
    activeZoneMinutes,
    distance,
    totalCalories,
    sleep,
    exercise,
    heartRate,
    dailyHeartRateVariability,
    dailyRestingHeartRate,
    dailyOxygenSaturation,
    dailyRespiratoryRate,
    dailySleepTemperatureDerivations,
    dailyVo2Max,
    weight,
    bodyFat,
  };
}

function buildSourceStatusDocument({ userId, hasPayload, observedAt, syncAt, lastError }) {
  return {
    id: `${userId}_fitbit`,
    athleteUserId: userId,
    sourceFamily: 'fitbit',
    lifecycleState: lastError ? 'connected_error' : hasPayload ? 'connected_synced' : 'connected_waiting_data',
    lastAttemptedSyncAt: syncAt,
    lastSuccessfulSyncAt: hasPayload ? syncAt : null,
    lastObservedRecordAt: observedAt || null,
    lastErrorCode: lastError ? 'google_health_sync_failed' : null,
    lastErrorCategory: lastError ? 'google_health_sync' : null,
    consentMetadata: {
      syncOrigin: 'pulsecheck_google_health_refresh',
      writer: 'google-health-sync.js',
      provider: 'google_health',
    },
  };
}

function buildSourceRecord({ userId, dateKey, timezone, syncAt, domain, payload }) {
  const sourceWindow = buildDayWindow(dateKey, timezone);
  const id = `${userId}_fitbit_${domain}_${dateKey}`;
  return {
    id,
    athleteUserId: userId,
    sourceFamily: 'fitbit',
    sourceType: `pulsecheck_fitbit_${domain}`,
    recordType: 'summary_input',
    domain,
    observedAt: sourceWindow.endAt,
    observedWindowStart: sourceWindow.startAt,
    observedWindowEnd: sourceWindow.endAt,
    ingestedAt: syncAt,
    timezone: sourceWindow.timezone,
    status: 'active',
    dedupeKey: `${userId}|fitbit|${domain}|${dateKey}`,
    payloadVersion: CONTRACT_VERSIONS.sourceRecord,
    payload,
    sourceMetadata: {
      syncOrigin: 'pulsecheck_google_health_refresh',
      writer: 'google-health-sync.js',
      provider: 'google_health',
    },
    provenance: {
      mode: 'direct',
      sourceSystem: 'google_health_api',
      rawDate: dateKey,
      confidenceLabel: 'stable',
    },
  };
}

function existingWinner(existingSnapshot, domain) {
  return String(existingSnapshot?.provenance?.domainWinners?.[domain] || '').toLowerCase();
}

function shouldWriteDomain(existingSnapshot, domain, hasPayload) {
  if (!hasPayload) return false;
  const winner = existingWinner(existingSnapshot, domain);
  if (!winner || winner === 'none') return true;
  const blocked = {
    recovery: ['polar', 'oura'],
    biometrics: ['health_kit', 'apple_health', 'apple_watch'],
    activity: ['health_kit', 'apple_health', 'apple_watch', 'polar', 'garmin', 'whoop'],
    training: ['fit_with_pulse', 'health_kit', 'apple_health', 'apple_watch', 'polar', 'garmin', 'whoop'],
  };
  return !(blocked[domain] || []).some((source) => winner.includes(source));
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
  const nextSourcesUsed = Array.from(new Set([...existingSourcesUsed, 'fitbit']));
  const domainWrite = {
    recovery: shouldWriteDomain(existingSnapshot, 'recovery', Object.keys(payloads.recovery).length > 0),
    biometrics: shouldWriteDomain(existingSnapshot, 'biometrics', Object.keys(payloads.biometrics).length > 0),
    activity: shouldWriteDomain(existingSnapshot, 'activity', Object.keys(payloads.activity).length > 0),
    training: shouldWriteDomain(existingSnapshot, 'training', Object.keys(payloads.training).length > 0),
  };
  const nextDomainWinners = {
    ...(existingProvenance.domainWinners || {}),
    ...(domainWrite.recovery ? { recovery: 'fitbit' } : {}),
    ...(domainWrite.biometrics ? { biometrics: 'fitbit' } : {}),
    ...(domainWrite.activity ? { activity: 'fitbit' } : {}),
    ...(domainWrite.training ? { training: 'fitbit' } : {}),
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
      googleHealthAuthorized: true,
      fitbitAuthorized: true,
      syncOrigin: 'pulsecheck_google_health_refresh',
    },
    sourceStatus: {
      ...existingSourceStatus,
      fitbit: sourceStatusDoc,
    },
    freshness: {
      ...(existingSnapshot?.freshness || {}),
      recovery: domainWrite.recovery ? 'fresh' : existingSnapshot?.freshness?.recovery || 'missing',
      biometrics: domainWrite.biometrics ? 'fresh' : existingSnapshot?.freshness?.biometrics || 'missing',
      activity: domainWrite.activity ? 'fresh' : existingSnapshot?.freshness?.activity || 'missing',
      training: domainWrite.training ? 'fresh' : existingSnapshot?.freshness?.training || 'missing',
      overall: 'fresh',
      evaluatedAt: syncAt,
    },
    provenance: {
      ...existingProvenance,
      summaryMode: existingSnapshot ? 'merged' : 'direct',
      sourcesUsed: nextSourcesUsed,
      sourceRecordIds: nextSourceRecordIds,
      domainWinners: nextDomainWinners,
      latestObservedFitbitDateKey: dateKey,
    },
    domains: {
      ...existingDomains,
      identity: existingDomains.identity || { athleteUserId: userId, timezone, snapshotDate: dateKey },
      recovery: domainWrite.recovery
        ? compactObject({ ...(existingDomains.recovery || {}), ...payloads.recovery })
        : existingDomains.recovery || {},
      biometrics: domainWrite.biometrics
        ? compactObject({ ...(existingDomains.biometrics || {}), ...payloads.biometrics })
        : existingDomains.biometrics || {},
      activity: domainWrite.activity
        ? compactObject({ ...(existingDomains.activity || {}), ...payloads.activity })
        : existingDomains.activity || {},
      training: domainWrite.training
        ? compactObject({ ...(existingDomains.training || {}), ...payloads.training })
        : existingDomains.training || {},
      summary: compactObject({
        ...(existingDomains.summary || {}),
        dataSourcesUsed: nextSourcesUsed,
        lastSyncTimestamp: syncAt,
        syncOrigin: 'pulsecheck_google_health_refresh',
        fitbitLastSyncTimestamp: syncAt,
        fitbitObservedDateKey: dateKey,
      }),
    },
    lastTriggerReason: 'pulsecheck_google_health_refresh',
  };

  return {
    snapshot,
    snapshotRevision: {
      id: revisionId,
      snapshotId,
      revision: String(Math.trunc(syncAt * 1000)),
      generatedAt: syncAt,
      triggerReason: 'pulsecheck_google_health_refresh',
      payload: snapshot,
      diffSummary: { sourceFamily: 'fitbit', provider: 'google_health', snapshotDateKey: dateKey },
    },
    assemblyTrace: {
      id: `${revisionId}_1`,
      athleteUserId: userId,
      snapshotId,
      snapshotRevisionId: revisionId,
      triggerReason: 'pulsecheck_google_health_refresh',
      selectedRecordIds: sourceRecordDocs.map((record) => record.id),
      droppedRecordIds: [],
      dropReasons: {},
      domainWinnerSummary: nextDomainWinners,
      contractVersions: CONTRACT_VERSIONS,
      createdAt: syncAt,
    },
  };
}

async function syncGoogleHealthSnapshotForConnection({ userId, timezone, requestedDateKey, connectionRef, connection }) {
  let freshConnection = await ensureFreshGoogleHealthConnection(connectionRef, connection);
  if (!freshConnection.healthUserId && freshConnection.accessToken) {
    const identity = await getGoogleHealthIdentity(freshConnection.accessToken).catch(() => null);
    if (identity?.healthUserId || identity?.legacyUserId) {
      const identityUpdate = {
        healthUserId: identity.healthUserId || freshConnection.healthUserId || null,
        legacyUserId: identity.legacyUserId || freshConnection.legacyUserId || null,
        identityName: identity.name || freshConnection.identityName || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await connectionRef.set(identityUpdate, { merge: true });
      freshConnection = { ...freshConnection, ...identityUpdate };
    }
  }

  const googleHealthData = await fetchGoogleHealthData(freshConnection, requestedDateKey, timezone);
  const payloads = {
    recovery: mapRecoveryPayload(googleHealthData),
    biometrics: mapBiometricsPayload(googleHealthData),
    activity: mapActivityPayload(googleHealthData),
    training: mapTrainingPayload(googleHealthData),
  };
  const syncAt = Date.now() / 1000;
  const hasPayload = Object.values(payloads).some((payload) => Object.keys(payload).length > 0);
  const observedAt = hasPayload ? buildDayWindow(requestedDateKey, timezone).endAt : null;
  const sourceStatusDoc = buildSourceStatusDocument({ userId, hasPayload, observedAt, syncAt, lastError: null });
  const importedDomains = Object.entries(payloads)
    .filter(([, payload]) => Object.keys(payload).length > 0)
    .map(([domain]) => domain);

  const firestore = admin.firestore();
  const batch = firestore.batch();
  batch.set(firestore.collection(HEALTH_CONTEXT_COLLECTIONS.sourceStatus).doc(sourceStatusDoc.id), sourceStatusDoc, { merge: true });
  batch.set(connectionRef, {
    lastSyncAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    lastRequestedSnapshotDateKey: requestedDateKey,
    lastSyncTimezone: timezone,
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
      detail: 'Fitbit is connected, but no synced Google Health data was available for this date yet.',
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
      payload,
    }));

  for (const record of sourceRecordDocs) {
    batch.set(firestore.collection(HEALTH_CONTEXT_COLLECTIONS.sourceRecords).doc(record.id), record, { merge: true });
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
    lastImportedDomains: importedDomains,
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
    importedDomains,
    detail: 'PulseCheck imported the latest Fitbit health context.',
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

    const result = await syncGoogleHealthSnapshotForConnection({
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
    console.error('[google-health-sync] Failed:', error);
    return buildGoogleHealthErrorResponse(error, {
      errorCode: 'GOOGLE_HEALTH_SYNC_FAILED',
      message: 'We could not refresh your Fitbit health data right now.',
    });
  }
};

exports.__test = {
  buildCivilDayRange,
  buildDayWindow,
  computeSleepMidpointEpochSeconds,
  mapActivityPayload,
  mapBiometricsPayload,
  mapRecoveryPayload,
  mapSleepPayload,
  mapTrainingPayload,
  selectSleepRecord,
  shouldWriteDomain,
  sumMetric,
};

exports.dateKeyInTimeZone = dateKeyInTimeZone;
exports.resolveTimeZone = resolveTimeZone;
exports.shiftDateKey = shiftDateKey;
exports.syncGoogleHealthSnapshotForConnection = syncGoogleHealthSnapshotForConnection;
