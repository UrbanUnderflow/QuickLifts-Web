import { schedule } from '@netlify/functions';
import { transportReady } from '../../src/lib/coach-communications/service';
import { processQueue, sendQueuedSms } from '../../src/lib/coach-communications/queue';
// Set gates only in Netlify's production Functions scope. Schedules run on published deploys.
// No Firebase initialization while held; no build-only CONTEXT variable is assumed.
export const handler = schedule('* * * * *', async () => {
  if (!transportReady('prod')) return { statusCode: 200, body: JSON.stringify({ enabled: false }) };
  const { getFirestore } = await import('./utils/getServiceAccount');
  return { statusCode: 200, body: JSON.stringify(await processQueue(await getFirestore(), sendQueuedSms)) };
});
