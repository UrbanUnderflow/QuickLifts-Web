import test from 'node:test';
import assert from 'node:assert/strict';
import { backfillInsightReports, findInsightReport, insightFactsFingerprint, insightReportId, listInsightReportHistory, saveInsightReport } from '../../src/lib/coach-dashboard/insightHistory';
import { buildFallbackReport } from '../../src/lib/coach-dashboard/insights';
function fixture() {
 const records = new Map<string, any>();
 let capabilities = ['coaching', 'athletic_trainer'];
 const db: any = { collection(name: string) {
  const filters: [string, any][] = [];
  const collection: any = {
   where(key: string, _op: string, value: any) { filters.push([key,value]); return collection; },
   async get() { return { docs: [...records.values()].filter(v=>filters.every(([k,x])=>v[k]===x)).map(v=>({data:()=>v})) }; },
   doc(id: string) { return {
    async set(value: any) { records.set(id,value); },
    async get() {
     const value = name === 'pulsecheck-team-memberships' ? { userId:'u',teamId:'team',organizationId:'org',role:'coach',staffCapabilities:capabilities }
      : name === 'pulsecheck-teams' ? {organizationId:'org',status:'active'} : name === 'pulsecheck-organizations' ? {status:'active'} : records.get(id);
     return { exists:!!value,data:()=>value };
    }
   }; }
  }; return collection;
 }};
 return {db, records, revoke:()=>{capabilities=['coaching'];}};
}
const report = buildFallbackReport('trainer',[],'2026-09-20','2026-09-26');
const fingerprint=insightFactsFingerprint({facts:[],allowed:['athlete']});
test('stable fingerprints and viewer scoped deterministic IDs',()=>{
 assert.equal(insightFactsFingerprint({b:2,a:1}),insightFactsFingerprint({a:1,b:2}));
 assert.notEqual(insightReportId('u','team','coach',report.to),insightReportId('v','team','coach',report.to));
 assert.throws(()=>insightReportId('u','team','coach','2026-02-30'));
});
test('changed sharing evidence prevents archived content from being returned',async()=>{
 const {db}=fixture();await saveInsightReport(db,'u','team',report,fingerprint);
 assert.equal((await findInsightReport(db,'u','team','trainer',report.to,fingerprint)).status,'available');
 assert.deepEqual(await findInsightReport(db,'u','team','trainer',report.to,insightFactsFingerprint({facts:[],allowed:[]})),{status:'stale'});
 const history=await listInsightReportHistory(db,'u','team','trainer');
 assert.equal(history.length,1);assert.ok(!('takeaway' in history[0]));assert.ok(!('facts' in history[0]));
});
test('revoked trainer permission blocks history and cached reads',async()=>{
 const {db,revoke}=fixture();await saveInsightReport(db,'u','team',report,fingerprint);revoke();
 await assert.rejects(findInsightReport(db,'u','team','trainer',report.to,fingerprint),{status:403});
 await assert.rejects(listInsightReportHistory(db,'u','team','trainer'),{status:403});
});
test('backfill deduplicates weeks and overwrites deterministic documents',async()=>{
 const {db,records}=fixture();let count=0;
 const options={db,uid:'u',teamId:'team',role:'trainer' as const,weekEnds:[report.to,report.to],generate:async()=>{count++;return{report,fingerprint};}};
 await backfillInsightReports(options);await backfillInsightReports(options);
 assert.equal(count,2);assert.equal(records.size,1);
});
