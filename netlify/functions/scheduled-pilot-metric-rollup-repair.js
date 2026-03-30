const { schedule } = require('@netlify/functions');
const { initializeFirebaseAdmin, getFirebaseAdminApp, admin } = require('./config/firebase');
const {
  repairRecentPilotMetricRollups,
  ROLLUP_REPAIR_LOOKBACK_DAYS,
  writePilotMetricOpsStatus,
} = require('./utils/pulsecheck-pilot-metrics');

exports.handler = schedule('0 6 * * *', async () => {
  try {
    initializeFirebaseAdmin({ headers: {} });
    const adminApp = getFirebaseAdminApp({ headers: {} });
    const db = admin.firestore(adminApp);
    const startedAtMs = Date.now();
    await writePilotMetricOpsStatus({
      db,
      pilotId: '_global',
      scope: 'scheduled_rollup_repair',
      status: 'running',
      details: {
        startedAt: admin.firestore.Timestamp.fromMillis(startedAtMs),
        startedAtMs,
        lookbackDays: ROLLUP_REPAIR_LOOKBACK_DAYS,
      },
    });

    const repairResult = await repairRecentPilotMetricRollups({
      db,
      lookbackDays: ROLLUP_REPAIR_LOOKBACK_DAYS,
    });

    await writePilotMetricOpsStatus({
      db,
      pilotId: '_global',
      scope: 'scheduled_rollup_repair',
      status: 'succeeded',
      details: {
        lastSuccessAt: admin.firestore.Timestamp.fromMillis(Date.now()),
        lastSuccessAtMs: Date.now(),
        durationMs: Date.now() - startedAtMs,
        repairedPilotCount: repairResult.repairedPilotCount,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...repairResult,
      }),
    };
  } catch (error) {
    console.error('[scheduled-pilot-metric-rollup-repair] Failed:', error);
    try {
      initializeFirebaseAdmin({ headers: {} });
      const adminApp = getFirebaseAdminApp({ headers: {} });
      const db = admin.firestore(adminApp);
      await writePilotMetricOpsStatus({
        db,
        pilotId: '_global',
        scope: 'scheduled_rollup_repair',
        status: 'failed',
        details: {
          lastFailureAt: admin.firestore.Timestamp.fromMillis(Date.now()),
          lastFailureAtMs: Date.now(),
          lastError: error?.message || 'Failed to repair pilot metric rollups.',
        },
      });
    } catch (nestedError) {
      console.error('[scheduled-pilot-metric-rollup-repair] Failed to write ops status:', nestedError);
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Failed to repair pilot metric rollups.',
      }),
    };
  }
});
