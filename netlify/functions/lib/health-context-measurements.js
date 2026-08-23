const MEASURED_FIELDS_BY_DOMAIN = {
  recovery: new Set([
    'sleepDuration',
    'deepSleepDuration',
    'remSleepDuration',
    'lightSleepDuration',
    'sleepEfficiency',
    'sleepScore',
    'sleepCharge',
    'heartRateResting',
    'restingHeartRate',
    'heartRateVariability',
    'respiratoryRate',
    'oxygenSaturation',
    'readinessScore',
    'sleepTemperatureDeviationCelsius',
  ]),
  biometrics: new Set([
    'heartRateAvg',
    'averageHeartRate',
    'avgHeartRate',
    'heartRateMin',
    'heartRateMax',
    'continuousHeartRateSampleCount',
    'heartRateResting',
    'restingHeartRate',
    'heartRateVariability',
    'respiratoryRate',
    'oxygenSaturation',
    'vo2Max',
    'bodyWeight',
    'bodyFatPercentage',
    'height',
    'maximumHeartRate',
    'aerobicThreshold',
    'anaerobicThreshold',
  ]),
  activity: new Set([
    'steps',
    'totalSteps',
    'activeSteps',
    'stepSampleCount',
    'activeCalories',
    'totalCalories',
    'activeMinutes',
    'activeZoneMinutes',
    'exerciseMinutes',
    'distance',
    'distanceKm',
    'distanceMeters',
    'activityGoalPercentage',
    'cardioLoad',
  ]),
  training: new Set([
    'workoutCount',
    'totalDurationMinutes',
    'totalWorkoutDurationMinutes',
    'workouts',
  ]),
};

const ZERO_IS_MEASURED = new Set([
  'sleepTemperatureDeviationCelsius',
]);

function hasMeasuredValue(field, value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    return ZERO_IS_MEASURED.has(field) ? true : value > 0;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return false;
    return ZERO_IS_MEASURED.has(field) ? true : numeric > 0;
  }
  return false;
}

function measuredFieldNames(domain, payload) {
  const fields = MEASURED_FIELDS_BY_DOMAIN[domain];
  if (!fields || !payload || typeof payload !== 'object') return [];
  return Array.from(fields).filter((field) => hasMeasuredValue(field, payload[field]));
}

function hasMeasuredPayload(domain, payload) {
  return measuredFieldNames(domain, payload).length > 0;
}

function measuredFieldSources(domain, payload, sourceFamily) {
  return Object.fromEntries(
    measuredFieldNames(domain, payload).map((field) => [field, sourceFamily])
  );
}

function mergePayloadWithAttribution(existingPayload, nextPayload, fieldSources, fieldSourceLabels = {}) {
  const existing = existingPayload && typeof existingPayload === 'object' ? existingPayload : {};
  const previousSources = existing.fieldSources && typeof existing.fieldSources === 'object'
    ? existing.fieldSources
    : {};
  const previousLabels = existing.fieldSourceLabels && typeof existing.fieldSourceLabels === 'object'
    ? existing.fieldSourceLabels
    : {};
  return {
    ...existing,
    ...nextPayload,
    fieldSources: {
      ...previousSources,
      ...fieldSources,
    },
    fieldSourceLabels: {
      ...previousLabels,
      ...fieldSourceLabels,
    },
  };
}

module.exports = {
  hasMeasuredPayload,
  hasMeasuredValue,
  measuredFieldNames,
  measuredFieldSources,
  mergePayloadWithAttribution,
};
