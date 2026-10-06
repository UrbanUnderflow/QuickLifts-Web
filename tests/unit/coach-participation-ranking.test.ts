import test from 'node:test';
import assert from 'node:assert/strict';
import { participationAdherence, rankParticipation } from '../../src/lib/coach-dashboard/participationRanking';
import type { ParticipationAthlete } from '../../src/lib/coach-dashboard/types';
const athlete = (id:string, check:number|null, skill:number|null):ParticipationAthlete => ({id,displayName:id,avatarUrl:null,currentSkill:null,checkIns:{completed:0,expected:7,rate:check,status:'available'},skillTraining:{completed:0,expected:7,rate:skill,status:'available'},wearables:{completed:0,expected:7,rate:0,status:'available'}});
test('ranks full roster, shares ranks for ties, and puts unavailable last without mutating input',()=>{
 const roster=[athlete('Z',null,null),...Array.from({length:7},(_,i)=>athlete(String(i),i*10,i*10)),athlete('Tie',60,60)];
 const ranked=rankParticipation(roster);
 assert.equal(ranked.length,9); assert.equal(ranked[0].rank,1); assert.equal(ranked[1].rank,1); assert.equal(ranked[2].rank,3); assert.equal(ranked.at(-1)?.rank,null); assert.equal(roster[0].id,'Z');
});
test('includes all three check-in periods, excludes unscheduled days and wearable sync, and balances training equally',()=>{
 const a=athlete('A',100,100);
 a.dailyParticipation=[{date:'2026-10-01',scheduled:true,checkIn:true,morningCompleted:true,recoveryCompleted:false,eveningCompleted:false,skillAssigned:1,skillCompleted:1},{date:'2026-10-02',scheduled:false,checkIn:true,morningCompleted:true,recoveryCompleted:true,eveningCompleted:true,skillAssigned:0,skillCompleted:0}];
 assert.equal(participationAdherence(a),67);
 a.skillTraining.rate=null; assert.equal(participationAdherence(a),33);
});
