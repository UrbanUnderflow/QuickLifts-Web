import test from 'node:test';
import assert from 'node:assert/strict';
import { countNoraThreads } from '../../src/lib/coach-dashboard/noraParticipation';
const at=Date.parse('2026-10-01T12:00:00Z');
test('counts threads once, only with athlete participation, across both Nora sources',()=>{
 const rows=[{id:'a',source:'chat' as const,data:{messages:[{isFromUser:true,timestamp:at/1000},{isFromUser:true,timestamp:at/1000}]}},{id:'b',source:'prompt' as const,data:{turns:[{role:'nora-opener',createdAt:at}]}},{id:'c',source:'prompt' as const,data:{turns:[{role:'athlete-reply',createdAt:at}]}},{id:'d',source:'chat' as const,data:{syntheticRedTeam:true,messages:[{isFromUser:true,timestamp:at}]}}];
 assert.equal(countNoraThreads(rows,'2026-09-28','2026-10-04'),2);
});
test('uses turn time rather than creation or update, and keeps missing evidence distinct from zero',()=>{
 const row={id:'a',source:'chat' as const,data:{createdAt:at,messages:[{isFromUser:true,timestamp:Date.parse('2026-10-05T00:00:00Z')}]}};
 assert.equal(countNoraThreads([row],'2026-09-28','2026-10-04'),0);
 assert.equal(countNoraThreads([{id:'b',source:'chat',data:{}}],'2026-09-28','2026-10-04'),null);
 assert.equal(countNoraThreads([],'2026-09-28','2026-10-04'),0);
});
