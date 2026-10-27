import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicRegistration, registerPublicCoach, publicProgram, UMES_ORGANIZATION_ID } from '../../src/lib/coachSurveys/publicRegistration';
const input = {organization:'umes',email:'Coach@umes.edu',phone:'954-548-4221',teamId:'team1',accountConsent:true,requestId:'12345678-1234-1234-1234-123456789abc'};
function fakeDb() {
 const records = new Map<string,any>([['pulsecheck-organizations/'+UMES_ORGANIZATION_ID,{status:'active',displayName:'UMES',productBrand:'athleticmind'}],['pulsecheck-teams/team1',{status:'active',organizationId:UMES_ORGANIZATION_ID,displayName:'Golf'}]]);
 const ref = (path:string):any => ({path,doc:(id:string)=>ref(path+'/'+id),collection:(name:string)=>ref(path+'/'+name),get:async()=>({exists:records.has(path),data:()=>records.get(path)}),where:()=>({get:async()=>({docs:[{id:'team1',data:()=>records.get('pulsecheck-teams/team1')}]})})});
 const db:any = {collection:ref,runTransaction:async(fn:any)=>fn({get:(r:any)=>r.get(),create:(r:any,d:any)=>{assert(!records.has(r.path));records.set(r.path,d);},set:(r:any,d:any)=>records.set(r.path,{...records.get(r.path),...d})})};
 return {db,records};
}
test('requires explicit consent, institutional email, team and international-normalized phone',()=>{
 assert.equal(validatePublicRegistration(input).phone,'+19545484221');
 for(const change of [{email:'x@gmail.com'},{email:'x@umes.edu.attacker.test'},{accountConsent:false},{phone:'12'},{teamId:'../admin'}]) assert.throws(()=>validatePublicRegistration({...input,...change}));
});
test('public registration reuses account without membership, verified identity, or role grants; retries retain token',async()=>{
 const {db,records}=fakeDb(); let lookups=0;
 const auth={getUserByEmail:async()=>{lookups++;return {uid:'existing-person'};},createUser:async()=>{throw Error('must not recreate');}};
 const first=await registerPublicCoach(db,auth,input,'test-ip',1000);
 const retry=await registerPublicCoach(db,auth,input,'test-ip',2000);
 assert.deepEqual(first,retry);assert.equal(lookups,2);
 assert.equal([...records.keys()].filter(k=>k.includes('/invitations/')).length,1);
 assert(![...records.keys()].some(k=>k.startsWith('users/')||k.includes('memberships')));
 const reg=[...records.entries()].find(([k])=>k.includes('/public-registrations/'))![1];
 assert.equal(reg.identityStatus,'unverified');assert.equal(reg.candidateAuthUid,'existing-person');assert.match(reg.participantId,/^pending_/);assert.equal(reg.smsConsent,false);
 await assert.rejects(registerPublicCoach(db,auth,{...input,phone:'2025550111'},'test-ip',2000),/details changed/);
});
test('unknown teams are rejected before auth and failed account creation can recover',async()=>{
 const {db}=fakeDb();let calls=0;
 const auth={getUserByEmail:async()=>{calls++;throw Object.assign(Error(),{code:'auth/user-not-found'});},createUser:async()=>{throw Error('temporary provider failure');}};
 await assert.rejects(registerPublicCoach(db,auth,{...input,teamId:'other'},'ip',1000),/current UMES/);assert.equal(calls,0);
 await assert.rejects(registerPublicCoach(db,auth,input,'ip',1000),/temporary/);
 const result=await registerPublicCoach(db,{...auth,createUser:async()=>({uid:'new-person'})},input,'ip',2000);
 assert.match(result.path,/#token=/);
});

test('uses provisioned displayName for organization and team', async()=>{ const {db}=fakeDb(); const result=await publicProgram(db,'umes'); assert.equal(result.organization.name,'UMES'); assert.equal(result.teams[0].name,'Golf'); });
