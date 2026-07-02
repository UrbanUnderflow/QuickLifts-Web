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
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  },
};

const {
  buildDayWindow,
  buildWhoopSnapshotArtifacts,
  buildWhoopSourceRecords,
  mapRecoveryPayload,
  mapSleepPayload,
  mapWorkoutPayload,
} = require('../whoop-sync').__test;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function buildWhoopFixture() {
  return {
    profile: { user_id: 789, email: 'athlete@example.com' },
    bodyMeasurement: {
      weight_kilogram: 82.3,
      height_meter: 1.88,
      max_heart_rate: 191,
    },
    cycles: {
      records: [{
        id: 'cycle-1',
        start: '2026-06-25T06:00:00.000Z',
        end: '2026-06-26T05:00:00.000Z',
        updated_at: '2026-06-26T05:01:00.000Z',
        score_state: 'SCORED',
        score: {
          strain: 12.3,
          kilojoule: 2100,
          average_heart_rate: 86,
          max_heart_rate: 171,
        },
      }],
    },
    recoveries: {
      records: [{
        cycle_id: 'cycle-1',
        sleep_id: 'sleep-1',
        created_at: '2026-06-25T12:00:00.000Z',
        updated_at: '2026-06-25T12:01:00.000Z',
        score_state: 'SCORED',
        score: {
          recovery_score: 74,
          resting_heart_rate: 51,
          hrv_rmssd_milli: 67.5,
          spo2_percentage: 96.2,
          skin_temp_celsius: 33.4,
          user_calibrating: false,
        },
      }],
    },
    sleeps: {
      records: [{
        id: 'sleep-1',
        cycle_id: 'cycle-1',
        nap: false,
        start: '2026-06-24T23:30:00.000Z',
        end: '2026-06-25T07:00:00.000Z',
        updated_at: '2026-06-25T07:05:00.000Z',
        score_state: 'SCORED',
        score: {
          sleep_efficiency_percentage: 87,
          sleep_performance_percentage: 91,
          sleep_consistency_percentage: 80,
          respiratory_rate: 15.5,
          sleep_needed: { baseline_milli: 8 * HOUR_MS },
          stage_summary: {
            total_in_bed_time_milli: 7.5 * HOUR_MS,
            total_awake_time_milli: 0.5 * HOUR_MS,
            total_light_sleep_time_milli: 4 * HOUR_MS,
            total_slow_wave_sleep_time_milli: 1.25 * HOUR_MS,
            total_rem_sleep_time_milli: 1.75 * HOUR_MS,
            total_no_data_time_milli: 0,
            sleep_cycle_count: 4,
            disturbance_count: 7,
          },
        },
      }],
    },
    workouts: {
      records: [{
        id: 'workout-1',
        sport_name: 'Basketball',
        sport_id: 1,
        start: '2026-06-25T18:00:00.000Z',
        end: '2026-06-25T19:20:00.000Z',
        updated_at: '2026-06-25T19:25:00.000Z',
        score_state: 'SCORED',
        score: {
          strain: 8.9,
          average_heart_rate: 142,
          max_heart_rate: 188,
          kilojoule: 1500,
          percent_recorded: 100,
          distance_meter: 2300,
          altitude_gain_meter: 20,
          zone_durations: {
            zone_two_milli: 20 * MINUTE_MS,
            zone_three_milli: 30 * MINUTE_MS,
            zone_four_milli: 15 * MINUTE_MS,
          },
        },
      }],
    },
  };
}

test('WHOOP payload mappers preserve recovery, sleep, and workout fields', () => {
  const fixture = buildWhoopFixture();

  assert.deepEqual(mapRecoveryPayload(fixture.recoveries.records[0]), {
    recoveryScore: 74,
    readinessScore: 74,
    heartRateResting: 51,
    heartRateVariability: 67.5,
    oxygenSaturation: 96.2,
    skinTemperatureCelsius: 33.4,
    userCalibrating: false,
    scoreState: 'SCORED',
    whoopCycleId: 'cycle-1',
    whoopSleepId: 'sleep-1',
  });
  assert.equal(mapSleepPayload(fixture.sleeps.records[0]).sleepDuration, 7);
  assert.equal(mapSleepPayload(fixture.sleeps.records[0]).timeInBed, 7.5);
  assert.equal(mapWorkoutPayload(fixture.workouts.records).totalDurationMinutes, 80);
  assert.equal(mapWorkoutPayload(fixture.workouts.records).activeCalories, 359);
});

test('buildWhoopSourceRecords emits canonical health-context source records by domain', () => {
  const syncAt = 1_782_408_000;
  const records = buildWhoopSourceRecords({
    userId: 'athlete-1',
    dateKey: '2026-06-25',
    timezone: 'UTC',
    syncAt,
    whoopData: buildWhoopFixture(),
  });

  assert.deepEqual(records.map((record) => record.domain).sort(), [
    'activity',
    'biometrics',
    'recovery',
    'training',
  ]);

  const recovery = records.find((record) => record.domain === 'recovery');
  const activity = records.find((record) => record.domain === 'activity');
  const training = records.find((record) => record.domain === 'training');
  const biometrics = records.find((record) => record.domain === 'biometrics');

  assert.equal(recovery.id, 'athlete-1_whoop_recovery_2026-06-25');
  assert.equal(recovery.sourceFamily, 'whoop');
  assert.equal(recovery.recordType, 'summary_input');
  assert.equal(recovery.observedWindowStart, Date.parse('2026-06-25T00:00:00.000Z') / 1000);
  assert.equal(recovery.observedWindowEnd, Date.parse('2026-06-26T00:00:00.000Z') / 1000);
  assert.equal(recovery.payload.recoveryScore, 74);
  assert.equal(recovery.payload.sleepDuration, 7);

  assert.equal(activity.payload.strain, 12.3);
  assert.equal(activity.payload.activeCalories, 502);
  assert.equal(training.recordType, 'session_input');
  assert.equal(training.payload.workoutCount, 1);
  assert.equal(training.payload.distanceKm, 2.3);
  assert.equal(training.payload.workouts[0].zoneMinutes.zone4, 15);
  assert.equal(biometrics.payload.bodyWeightKg, 82.3);
  assert.equal(biometrics.payload.maxHeartRate, 191);
});

test('buildWhoopSnapshotArtifacts projects WHOOP records into the canonical daily snapshot', () => {
  const syncAt = 1_782_408_000;
  const sourceRecordDocs = buildWhoopSourceRecords({
    userId: 'athlete-1',
    dateKey: '2026-06-25',
    timezone: 'UTC',
    syncAt,
    whoopData: buildWhoopFixture(),
  });

  const { snapshot, snapshotRevision, assemblyTrace } = buildWhoopSnapshotArtifacts({
    userId: 'athlete-1',
    dateKey: '2026-06-25',
    timezone: 'UTC',
    syncAt,
    sourceStatusDoc: { sourceFamily: 'whoop', lifecycleState: 'connected_synced' },
    sourceRecordDocs,
    existingSnapshot: null,
  });

  assert.equal(snapshot.id, 'athlete-1_daily_2026-06-25');
  assert.equal(snapshot.snapshotDateKey, '2026-06-25');
  assert.deepEqual(snapshot.provenance.sourcesUsed, ['whoop']);
  assert.equal(snapshot.provenance.domainWinners.recovery, 'whoop');
  assert.equal(snapshot.provenance.domainWinners.training, 'whoop');
  assert.equal(snapshot.domains.recovery.recoveryScore, 74);
  assert.equal(snapshot.domains.recovery.sleepDuration, 7);
  assert.equal(snapshot.domains.activity.strain, 12.3);
  assert.equal(snapshot.domains.training.workoutCount, 1);
  assert.equal(snapshot.domains.biometrics.bodyWeightKg, 82.3);
  assert.equal(snapshot.domains.summary.readinessScore, 74);
  assert.equal(snapshot.freshness.recovery, 'fresh');
  assert.equal(snapshot.freshness.overall, 'fresh');
  assert.equal(snapshot.sourceStatus.whoop.lifecycleState, 'connected_synced');
  assert.equal(snapshotRevision.snapshotId, snapshot.id);
  assert.equal(assemblyTrace.selectedRecordIds.length, sourceRecordDocs.length);
});

test('buildWhoopSnapshotArtifacts merges into an existing snapshot without clobbering Polar-owned recovery', () => {
  const syncAt = 1_782_408_000;
  const sourceRecordDocs = buildWhoopSourceRecords({
    userId: 'athlete-1',
    dateKey: '2026-06-25',
    timezone: 'UTC',
    syncAt,
    whoopData: buildWhoopFixture(),
  });

  const existingSnapshot = {
    contractVersions: { snapshot: '1.0' },
    sourceStatus: { healthkit: { sourceFamily: 'healthkit', lifecycleState: 'connected_synced' } },
    freshness: { nutrition: 'fresh' },
    provenance: {
      sourcesUsed: ['healthkit', 'polar'],
      sourceRecordIds: ['athlete-1_polar_recovery_2026-06-25'],
      domainWinners: { recovery: 'polar', nutrition: 'quicklifts' },
    },
    domains: {
      recovery: { sleepDuration: 6.2, heartRateVariability: 55 },
      nutrition: { caloriesConsumed: 2200 },
      summary: { dataSourcesUsed: ['healthkit', 'polar'] },
    },
  };

  const { snapshot } = buildWhoopSnapshotArtifacts({
    userId: 'athlete-1',
    dateKey: '2026-06-25',
    timezone: 'UTC',
    syncAt,
    sourceStatusDoc: { sourceFamily: 'whoop', lifecycleState: 'connected_synced' },
    sourceRecordDocs,
    existingSnapshot,
  });

  // Polar keeps the recovery domain; WHOOP takes the domains nobody owns.
  assert.equal(snapshot.provenance.domainWinners.recovery, 'polar');
  assert.equal(snapshot.domains.recovery.sleepDuration, 6.2);
  assert.equal(snapshot.provenance.domainWinners.activity, 'whoop');
  assert.equal(snapshot.provenance.domainWinners.nutrition, 'quicklifts');
  assert.equal(snapshot.domains.nutrition.caloriesConsumed, 2200);
  assert.deepEqual(snapshot.provenance.sourcesUsed, ['healthkit', 'polar', 'whoop']);
  assert.ok(snapshot.provenance.sourceRecordIds.includes('athlete-1_polar_recovery_2026-06-25'));
  assert.equal(snapshot.freshness.nutrition, 'fresh');
  assert.equal(snapshot.sourceStatus.healthkit.lifecycleState, 'connected_synced');
});

test('buildDayWindow honors athlete timezone day boundaries', () => {
  const window = buildDayWindow('2026-06-25', 'America/New_York');

  assert.equal(window.startAt, Date.parse('2026-06-25T04:00:00.000Z') / 1000);
  assert.equal(window.endAt, Date.parse('2026-06-26T04:00:00.000Z') / 1000);
  assert.equal(window.timezone, 'America/New_York');
});
