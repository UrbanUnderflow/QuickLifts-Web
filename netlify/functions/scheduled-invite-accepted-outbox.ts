import { schedule } from '@netlify/functions';
import { getFirebaseAdmin } from './utils/getServiceAccount';
import { sendCommittedInviteNotification } from './send-pulsecheck-invite-accepted-email';
const { COLLECTION, processInviteAcceptedOutbox } = require('./lib/invite-accepted-outbox');

export const handler = schedule('*/5 * * * *', async () => {
  const app = await getFirebaseAdmin();
  const db = app.firestore();
  const pending = await db.collection(COLLECTION).where('status', '==', 'pending').limit(100).get();
  const interrupted = await db.collection(COLLECTION).where('status', '==', 'sending').limit(100).get();
  let failed = 0;
  for (const job of [...pending.docs, ...interrupted.docs]) {
    try { await processInviteAcceptedOutbox(db, job.id, sendCommittedInviteNotification, Date.now(), (uid: string) => app.auth().getUser(uid)); }
    catch { failed += 1; }
  }
  return { statusCode: failed ? 503 : 200, body: JSON.stringify({ processed: pending.size + interrupted.size, failed }) };
});
