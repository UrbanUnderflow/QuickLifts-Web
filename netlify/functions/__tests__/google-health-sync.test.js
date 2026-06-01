const test = require('node:test');
const assert = require('node:assert/strict');

const firebaseConfigPath = require.resolve('../config/firebase');
require.cache[firebaseConfigPath] = {
  id: firebaseConfigPath,
  filename: firebaseConfigPath,
  loaded: true,
  exports: {
    initializeFirebaseAdmin: () => ({}),
    admin: {},
  },
};

const googleHealthUtilsPath = require.resolve('../google-health-utils');
require.cache[googleHealthUtilsPath] = {
  id: googleHealthUtilsPath,
  filename: googleHealthUtilsPath,
  loaded: true,
  exports: {
    CONNECTIONS_COLLECTION: 'health-provider-connections',
    RESPONSE_HEADERS: {},
    buildConnectionDocId: (userId) => `${userId}_google_health`,
    buildGoogleHealthErrorResponse: () => ({ statusCode: 500, headers: {}, body: '{}' }),
    ensureFreshGoogleHealthConnection: async (_connectionRef, connection) => connection,
    getGoogleHealthIdentity: async () => ({ healthUserId: 'health_user_test' }),
    googleHealthApiRequest: async () => ({}),
    parseJsonBody: () => ({}),
    verifyAuth: async () => ({ uid: 'user_test' }),
  },
};

const {
  mapActivityPayload,
  mapBiometricsPayload,
  mapRecoveryPayload,
  mapTrainingPayload,
  shouldWriteDomain,
} = require('../google-health-sync').__test;

test('mapActivityPayload imports Google Health daily rollups into activity context', () => {
  const payload = mapActivityPayload({
    steps: { rollupDataPoints: [{ steps: { countSum: '3822' } }] },
    activeEnergyBurned: { rollupDataPoints: [{ activeEnergyBurned: { caloriesSum: '512' } }] },
    totalCalories: { rollupDataPoints: [{ totalCalories: { caloriesSum: '2410' } }] },
    activeMinutes: { rollupDataPoints: [{ activeMinutes: { minutesSum: '74' } }] },
    activeZoneMinutes: { rollupDataPoints: [{ activeZoneMinutes: { minutesSum: '28' } }] },
    distance: { rollupDataPoints: [{ distance: { metersSum: '6400' } }] },
  });

  assert.equal(payload.steps, 3822);
  assert.equal(payload.activeCalories, 512);
  assert.equal(payload.totalCalories, 2410);
  assert.equal(payload.activeMinutes, 74);
  assert.equal(payload.activeZoneMinutes, 28);
  assert.equal(payload.distanceMeters, 6400);
});

test('mapRecoveryPayload maps Fitbit sleep stages and daily recovery metrics', () => {
  const payload = mapRecoveryPayload({
    dateKey: '2026-03-04',
    sleep: {
      dataPoints: [
        {
          dataSource: { platform: 'FITBIT', device: { displayName: 'Charge 6' } },
          sleep: {
            interval: {
              startTime: '2026-03-03T20:57:30Z',
              endTime: '2026-03-04T04:41:30Z',
            },
            metadata: { main: true, stagesStatus: 'SUCCEEDED' },
            summary: {
              minutesInSleepPeriod: '464',
              minutesAsleep: '407',
              minutesAwake: '57',
              stagesSummary: [
                { type: 'AWAKE', minutes: '56' },
                { type: 'LIGHT', minutes: '198' },
                { type: 'DEEP', minutes: '114' },
                { type: 'REM', minutes: '94' },
              ],
            },
          },
        },
      ],
    },
    dailyRestingHeartRate: { dataPoints: [{ dailyRestingHeartRate: { bpm: '54' } }] },
    dailyHeartRateVariability: { dataPoints: [{ dailyHeartRateVariability: { rmssdMillis: '71' } }] },
    dailyOxygenSaturation: { dataPoints: [{ dailyOxygenSaturation: { percentage: '96.5' } }] },
    dailyRespiratoryRate: { dataPoints: [{ dailyRespiratoryRate: { breathsPerMinute: '14.4' } }] },
  });

  assert.equal(payload.sleepDuration, 6.78);
  assert.equal(payload.deepSleepDuration, 1.9);
  assert.equal(payload.remSleepDuration, 1.57);
  assert.equal(payload.sleepEfficiency, 0.88);
  assert.equal(payload.sleepScore, 88);
  assert.equal(payload.heartRateResting, 54);
  assert.equal(payload.heartRateVariability, 71);
  assert.equal(payload.oxygenSaturation, 96.5);
  assert.equal(payload.respiratoryRate, 14.4);
});

test('mapBiometricsPayload summarizes heart-rate samples and profile metrics', () => {
  const payload = mapBiometricsPayload({
    heartRate: {
      dataPoints: [
        { heartRate: { bpm: '50' } },
        { heartRate: { bpm: '66' } },
        { heartRate: { bpm: '82' } },
      ],
    },
    dailyVo2Max: { dataPoints: [{ dailyVo2Max: { vo2MillilitersPerMinuteKilogram: '48.2' } }] },
    weight: { dataPoints: [{ weight: { kilograms: '81.5' } }] },
    bodyFat: { dataPoints: [{ bodyFat: { percentage: '13.4' } }] },
  });

  assert.equal(payload.heartRateAvg, 66);
  assert.equal(payload.heartRateMin, 50);
  assert.equal(payload.heartRateMax, 82);
  assert.equal(payload.continuousHeartRateSampleCount, 3);
  assert.equal(payload.vo2Max, 48.2);
  assert.equal(payload.bodyWeight, 81.5);
  assert.equal(payload.bodyFatPercentage, 13.4);
});

test('mapTrainingPayload converts exercise intervals into workout summaries', () => {
  const payload = mapTrainingPayload({
    exercise: {
      dataPoints: [
        {
          name: 'users/me/dataTypes/exercise/dataPoints/workout_1',
          dataSource: { platform: 'FITBIT', device: { displayName: 'Fitbit Air' } },
          exercise: {
            exerciseType: 'RUNNING',
            interval: {
              startTime: '2026-03-04T12:00:00Z',
              endTime: '2026-03-04T12:42:00Z',
            },
            distanceMeters: '6500',
            calories: '410',
          },
        },
      ],
    },
  });

  assert.equal(payload.workoutCount, 1);
  assert.equal(payload.totalWorkoutDurationMinutes, 42);
  assert.equal(payload.workouts[0].sport, 'RUNNING');
  assert.equal(payload.workouts[0].durationSeconds, 2520);
  assert.equal(payload.workouts[0].distanceMeters, 6500);
});

test('shouldWriteDomain preserves stronger existing source winners', () => {
  assert.equal(
    shouldWriteDomain({ provenance: { domainWinners: { recovery: 'polar' } } }, 'recovery', true),
    false
  );
  assert.equal(
    shouldWriteDomain({ provenance: { domainWinners: { activity: 'oura' } } }, 'activity', true),
    true
  );
  assert.equal(
    shouldWriteDomain({ provenance: { domainWinners: { biometrics: 'health_kit' } } }, 'biometrics', true),
    false
  );
});
