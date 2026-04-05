const { schedule } = require('@netlify/functions');
const {
  admin,
  getFirebaseAdminApp,
  initializeFirebaseAdmin,
} = require('./config/firebase');
const {
  REPAIRABLE_SOURCE_COLLECTIONS,
  listRepairCandidateRunRounds,
  repairRunRoundDuplicates,
} = require('./utils/run-round-duplicate-repair');

const REPAIR_LOOKBACK_DAYS = 21;

exports.handler = schedule('0 */2 * * *', async () => {
  try {
    initializeFirebaseAdmin({ headers: {} });
    const adminApp = getFirebaseAdminApp({ headers: {} });
    const db = admin.firestore(adminApp);

    const candidateRounds = await listRepairCandidateRunRounds(db, {
      lookbackDays: REPAIR_LOOKBACK_DAYS,
    });

    const roundsChecked = [];
    const roundsRepaired = [];
    let auditsWritten = 0;
    let deletesApplied = 0;
    let suppressedRuns = 0;

    for (const round of candidateRounds) {
      const report = await repairRunRoundDuplicates(db, {
        mode: 'prod',
        challengeId: round.challengeId,
        writeAudits: true,
        deleteSources: REPAIRABLE_SOURCE_COLLECTIONS,
      });

      roundsChecked.push({
        challengeId: report.challengeId,
        title: report.roundTitle,
        duplicateGroups: report.totalDuplicateGroups,
        suppressedRuns: report.totalSuppressedRuns,
      });

      if (report.totalDuplicateGroups > 0 || report.deletesApplied > 0 || report.auditsWritten > 0) {
        roundsRepaired.push({
          challengeId: report.challengeId,
          title: report.roundTitle,
          duplicateGroups: report.totalDuplicateGroups,
          suppressedRuns: report.totalSuppressedRuns,
          auditsWritten: report.auditsWritten,
          deletesApplied: report.deletesApplied,
        });
      }

      auditsWritten += report.auditsWritten;
      deletesApplied += report.deletesApplied;
      suppressedRuns += report.totalSuppressedRuns;
    }

    const summary = {
      success: true,
      checkedRoundCount: roundsChecked.length,
      repairedRoundCount: roundsRepaired.length,
      suppressedRuns,
      auditsWritten,
      deletesApplied,
      lookbackDays: REPAIR_LOOKBACK_DAYS,
      roundsRepaired,
    };

    console.log('[scheduled-repair-run-round-duplicates] Completed', summary);

    return {
      statusCode: 200,
      body: JSON.stringify(summary),
    };
  } catch (error) {
    console.error('[scheduled-repair-run-round-duplicates] Failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Failed to repair run round duplicates.',
      }),
    };
  }
});
