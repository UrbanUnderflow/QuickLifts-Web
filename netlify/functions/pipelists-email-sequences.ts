import type { Handler } from '@netlify/functions';
import { getSimpBudgetFirestore } from './utils/getSimpBudgetServiceAccount';
import { COLLECTION, dispatchSequence } from './lib/pipelistsEmailSequences';

// Netlify scheduled functions are not callable through a production HTTP URL.
export const handler: Handler = async () => {
  const db = await getSimpBudgetFirestore();
  const now = new Date();
  const active = await db.collection(COLLECTION).where('status', '==', 'active').get();
  const due = active.docs.filter(doc => doc.data().nextSendAt && doc.data().nextSendAt <= now.toISOString()).slice(0, 3);
  let processed = 0;
  await Promise.all(due.map(async document => {
    try { await dispatchSequence(db, document.id, now); processed++; }
    catch (error) { console.error('[PipeLists sequences] Delivery requires review', { sequenceId: document.id, error }); }
  }));
  return { statusCode: 200, body: JSON.stringify({ processed }) };
};
