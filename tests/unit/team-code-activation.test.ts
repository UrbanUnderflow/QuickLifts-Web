import test from 'node:test';
import assert from 'node:assert/strict';
import {getOrCreateTeamCode, regenerateTeamCode} from '../../src/api/firebase/pulsecheckProvisioning/teamCode';
import {resolveActivation} from '../../src/lib/server/pulsecheck/activation-preview';
function fixture() {
 const rows:any = {'pulsecheck-teams':{team:{status:'active',organizationId:'org',displayName:'Volleyball',teamCode:'ABCDEF'}},'pulsecheck-organizations':{org:{status:'active',displayName:'University'}},'pulsecheck-invite-links':{}};
 const snap=(c:string,id:string)=>({id,ref:doc(c,id),exists:!!rows[c]?.[id],data:()=>rows[c]?.[id]});
 const doc=(c:string,id:string):any=>({c,id,get:async()=>snap(c,id)});
 const query=(c:string,f:string,op:string,v:any):any=>({get:async()=>{const docs=Object.entries(rows[c]||{}).filter(([,r]:any)=>op==='array-contains'?r[f]?.includes(v):r[f]===v).map(([id])=>snap(c,id));return{docs,empty:!docs.length}},limit:()=>query(c,f,op,v)});
 const db:any={collection:(c:string)=>({doc:(id:string)=>doc(c,id),where:(f:string,op:string,v:any)=>query(c,f,op,v)}),runTransaction:async(fn:any)=>{const writes:any[]=[];const out=await fn({get:(ref:any)=>ref.get(),set:(ref:any,data:any)=>writes.push([ref,data,false]),update:(ref:any,data:any)=>writes.push([ref,data,true])});for(const[r,d,merge]of writes){rows[r.c]??={};rows[r.c][r.id]=merge?{...rows[r.c][r.id],...d}:d;for(const k of Object.keys(rows[r.c][r.id]))if(rows[r.c][r.id][k]==='DELETE')delete rows[r.c][r.id][k];}return out;}};
 return {rows,db,args:{database:db,fieldValue:{serverTimestamp:()=>new Date(),delete:()=>'DELETE'} as any,teamId:'team'}};
}
test('legacy team code is atomically backed by usable athlete invitation and get is idempotent',async()=>{
 const f=fixture();await getOrCreateTeamCode(f.args);const first=await resolveActivation(f.db,'abcdef');assert.equal(first.teamId,'team');assert.equal(first.activationCode,'ABCDEF');await getOrCreateTeamCode(f.args);assert.equal(Object.keys(f.rows['pulsecheck-invite-links']).length,1);
});
test('new team code is six characters and resolves before it is returned',async()=>{
 const f=fixture();delete f.rows['pulsecheck-teams'].team.teamCode;const result=await getOrCreateTeamCode(f.args);assert.match(result.code,/^[A-Z2-9]{6}$/);assert.equal((await resolveActivation(f.db,result.code)).teamId,'team');
});
test('rotation invalidates old short code, preserves token link and existing membership context',async()=>{
 const f=fixture();await getOrCreateTeamCode(f.args);const old=await resolveActivation(f.db,'ABCDEF');const code=await regenerateTeamCode(f.args);assert.notEqual(code,'ABCDEF');await assert.rejects(resolveActivation(f.db,'ABCDEF'));assert.equal((await resolveActivation(f.db,code)).teamId,'team');assert.equal((await resolveActivation(f.db,old.inviteToken)).teamId,'team');
});
test('get never reactivates revoked, expired, staff or exhausted invitation',async()=>{
 for(const patch of [{status:'revoked'},{expiresAt:new Date(0)},{teamMembershipRole:'coach'},{maxUses:1,redemptionCount:1}]){const f=fixture();await getOrCreateTeamCode(f.args);const id=Object.keys(f.rows['pulsecheck-invite-links'])[0];Object.assign(f.rows['pulsecheck-invite-links'][id],patch);await assert.rejects(getOrCreateTeamCode(f.args));assert.equal(Object.keys(f.rows['pulsecheck-invite-links']).length,1);}
});
test('inactive parents and conflicting code namespaces fail without writes',async()=>{
 for(const variant of ['team','org','invite','duplicate-team']){const f=fixture();if(variant==='team')f.rows['pulsecheck-teams'].team.status='archived';if(variant==='org')f.rows['pulsecheck-organizations'].org.status='archived';if(variant==='invite')f.rows['pulsecheck-invite-links'].other={activationAliases:['ABCDEF'],teamId:'other'};if(variant==='duplicate-team')f.rows['pulsecheck-teams'].other={teamCode:'ABCDEF'};const before=JSON.stringify(f.rows);await assert.rejects(getOrCreateTeamCode(f.args));assert.equal(JSON.stringify(f.rows),before);}
});
test('existing mapped codes reject direct-token shadowing and duplicate team ownership',async()=>{
 for(const shadow of [true,false]){const f=fixture();await getOrCreateTeamCode(f.args);if(shadow)f.rows['pulsecheck-invite-links'].ABCDEF={...Object.values(f.rows['pulsecheck-invite-links'])[0] as any,teamId:'other'};else f.rows['pulsecheck-teams'].other={teamCode:'ABCDEF'};await assert.rejects(getOrCreateTeamCode(f.args));}
});
test('unmapped legacy code reuses scoped invitation without bypassing closed enrollment',async()=>{
 const f=fixture();f.rows['pulsecheck-pilots']={pilot:{status:'active',organizationId:'org',teamId:'team'}};
 f.rows['pulsecheck-invite-links'].scoped={inviteType:'team-access',teamMembershipRole:'athlete',redemptionMode:'general',status:'active',organizationId:'org',teamId:'team',pilotId:'pilot'};
 await getOrCreateTeamCode(f.args);assert.equal((await resolveActivation(f.db,'ABCDEF')).inviteToken,'scoped');assert.equal(Object.keys(f.rows['pulsecheck-invite-links']).length,1);
 const fresh=fixture();fresh.rows['pulsecheck-invite-links'].scoped={...f.rows['pulsecheck-invite-links'].scoped,activationAliases:[],status:'revoked'};await assert.rejects(getOrCreateTeamCode(fresh.args));assert.equal(Object.keys(fresh.rows['pulsecheck-invite-links']).length,1);
});
