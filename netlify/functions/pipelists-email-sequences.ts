import { isPipeListsProductionRuntime, PIPELISTS_RUNTIME_BLOCK_CODE } from '../../src/utils/pipelistsRuntime';
import type { Handler } from '@netlify/functions';

// Netlify scheduled functions are not callable through a production HTTP URL.
export const handler: Handler = async () => {
  if (!isPipeListsProductionRuntime()) {
    return { statusCode: 503, body: JSON.stringify({ success: false, code: PIPELISTS_RUNTIME_BLOCK_CODE }) };
  }
  const { getSimpBudgetFirestore } = await import('./utils/getSimpBudgetServiceAccount');
  const { COLLECTION, dispatchSequence } = await import('./lib/pipelistsEmailSequences');
  const db = await getSimpBudgetFirestore();
  const now = new Date();
  const active = await db.collection(COLLECTION).where('status', '==', 'active').get();
  const due = active.docs.filter(doc => doc.data().nextSendAt && doc.data().nextSendAt <= now.toISOString());
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  // Blocked university records remain untouched. They must not occupy every
  // batch slot and prevent unrelated, eligible sequences from being considered.
  for (const document of due) {
    if (processed + failed >= 3) break;
    try {
      const result = await dispatchSequence(db, document.id, now);
      if (result) processed++;
      else skipped++;
    } catch (error) {
      failed++;
      console.error('[PipeLists sequences] Delivery requires review', { sequenceId: document.id, error });
    }
  }
  return { statusCode: 200, body: JSON.stringify({ processed, skipped, failed }) };
};
