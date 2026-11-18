import { schedule } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { runReportSmsDeliveries } from '../../src/lib/coach-dashboard/reportSmsDelivery';
import { runReportDeliveries } from '../../src/lib/coach-dashboard/reportDeliveryRunner';
// Provider-controlled schedule. Per-recipient persisted dedupe also protects retries.
export const handler=schedule('*/5 * * * *',async()=>{
 const db=await getFirestore();
 const result=await runReportDeliveries(db,new Date(),{budgetMs:8000});
 const sms=await runReportSmsDeliveries(db,new Date(),{budgetMs:8000});
 console.log('[coach-participation-reports]',{email:result,sms});
 return {statusCode:200,body:JSON.stringify(result)};
});
