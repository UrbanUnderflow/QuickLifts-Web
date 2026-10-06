import test from 'node:test';
import assert from 'node:assert/strict';
import { lifetimeCheckIns } from '../../src/lib/coach-dashboard/lifetimeParticipation';
import { countNoraThreads } from '../../src/lib/coach-dashboard/noraParticipation';
test('all-time check-ins deduplicate recovery across legacy and current records and count each period separately',()=>{
 assert.deepEqual(lifetimeCheckIns([{date:'2026-09-04',data:{level:'ready',subjectiveRecoveryLevel:3,eveningCheckIn:{level:'good'}}}],[{date:'2026-09-04',subjectiveRecoveryScore:3},{date:'2026-09-05',subjectiveRecoveryScore:4}]),{morning:1,recovery:2,evening:1});
});
test('historical conversations count all time but remain excluded from weekly overview',()=>{
 const rows=[{id:'september',source:'chat' as const,data:{messages:[{isFromUser:true,timestamp:Date.parse('2026-09-04')/1000}]}}];
 assert.equal(countNoraThreads(rows,'1970-01-01','2026-10-05'),1);
 assert.equal(countNoraThreads(rows,'2026-09-28','2026-10-04'),0);
});
