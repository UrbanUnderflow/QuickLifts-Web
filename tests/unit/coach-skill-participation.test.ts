import test from 'node:test';
import assert from 'node:assert/strict';
import { latestAssignedSkill, skillCompletion } from '../../src/lib/coach-dashboard/skillParticipation';
test('uses latest primary athlete task, published label, and team scope',()=>{
 const base={teamId:'team',sourceDate:'2026-10-05',status:'assigned',protocolId:'breathing',protocolLabel:'Breathing'};
 const rows=[{...base,updatedAt:3,isPrimaryForDate:false,protocolId:'secondary'},{...base,updatedAt:2},{...base,updatedAt:4,status:'superseded',protocolId:'old'},{...base,teamId:'other',updatedAt:8}];
 assert.deepEqual(latestAssignedSkill(rows,'team','2026-09-28','2026-10-05'),{id:'breathing',name:'Breathing',phase:null,assignedDate:'2026-10-05'});
 assert.equal(latestAssignedSkill(rows,'team','2026-09-28','2026-10-04'),null);
});
test('skill progress excludes other skills and superseded tasks',()=>{
 assert.deepEqual(skillCompletion([{skillId:'a',completedAt:1},{protocolId:'a',status:'assigned'},{skillId:'a',status:'superseded',completedAt:1},{skillId:'b',completedAt:1}],'a'),{completed:1,expected:2,rate:50});
 assert.equal(skillCompletion([],'a').rate,null);
});
