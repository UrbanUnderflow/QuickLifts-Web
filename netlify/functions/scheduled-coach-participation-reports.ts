import { schedule } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { runReportDeliveries } from '../../src/lib/coach-dashboard/reportDeliveryRunner';
// Provider-controlled schedule. Per-recipient persisted dedupe also protects retries.
export const handler=schedule('*/5 * * * *',async()=>{
 const result=await runReportDeliveries(await getFirestore());
 console.log('[coach-participation-reports]',result);
 return {statusCode:200,body:JSON.stringify(result)};
});
