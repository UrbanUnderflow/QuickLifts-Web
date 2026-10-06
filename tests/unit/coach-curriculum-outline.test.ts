import test from 'node:test';
import assert from 'node:assert/strict';
import { outlineRows } from '../../src/lib/coach-dashboard/curriculumOutline';
test('full list retains unassigned skills and matches current legacy aliases without inventing next assignments',()=>{
 const rows=outlineRows([{id:'breathing',name:'Breathing',type:'protocol',aliases:['legacy-breathing']},{id:'focus',name:'Focus',type:'simulation'}],[{currentSkill:{id:'legacy-breathing'}}] as any);
 assert.equal(rows.length,2);
 assert.equal(rows[0].currentCount,1);
 assert.equal(rows[1].currentCount,0);
 assert.equal(rows[1].nextCount,0);
});
