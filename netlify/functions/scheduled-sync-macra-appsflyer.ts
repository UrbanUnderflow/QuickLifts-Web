import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { runMacraAppsFlyerPullImport } from './sync-macra-appsflyer-raw-data';

// Pulls the last 7 days on every run so late-arriving attribution is captured;
// row-level dedupe in the importer keeps re-pulled days from double counting.
const PULL_DAYS_BACK = 7;

export const handler: Handler = async () => {
  try {
    const db = await getFirestore();
    const result = await runMacraAppsFlyerPullImport({
      db,
      actor: { uid: 'scheduled-cron', email: 'scheduled-sync-macra-appsflyer', source: 'netlify_schedule' },
      body: { daysBack: PULL_DAYS_BACK },
    });

    const payload = result.payload || {};
    if (result.status !== 200) {
      console.error('[scheduled-sync-macra-appsflyer] Pull failed', {
        status: result.status,
        error: payload.error,
        reportErrors: payload.reportErrors,
        secretManagerErrors: payload.secretManagerErrors,
      });
      return { statusCode: result.status, body: JSON.stringify({ success: false, error: payload.error || 'pull failed' }) };
    }

    console.log('[scheduled-sync-macra-appsflyer] Pull complete', {
      runId: payload.runId,
      fetchedRows: payload.fetchedRows,
      importedRows: payload.importedRows,
      duplicateRows: payload.duplicateRows,
      reportErrors: payload.reportErrors,
      events: payload.summary?.events?.total,
      installs: payload.summary?.installs?.total,
    });
    return { statusCode: 200, body: JSON.stringify({ success: true, runId: payload.runId }) };
  } catch (error: any) {
    console.error('[scheduled-sync-macra-appsflyer] Failed:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'scheduled pull failed' }) };
  }
};
