import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSupportRequests, createSupportRequestsHandler } from '../../src/pages/api/coach/support-requests';
const snap=(data:any,id='x')=>({id,exists:true,data:()=>data});
function db(capabilities=['coaching']) {
 const rows:any={
  'pulsecheck-team-memberships': [snap({userId:'athlete',organizationId:'org',teamId:'team',role:'athlete',status:'active'})],
  'escalation-records':[
    snap({userId:'athlete',tier:2,consentStatus:'accepted',createdAt:123,supportSelectionKind:'staff',supportSelectionUserId:'coach',supportSelectionTeamId:'team',supportRoute:'selected_staff'},'accepted'),
    snap({userId:'athlete',tier:2,consentStatus:'declined'},'declined'),
    snap({userId:'athlete',tier:2,consentStatus:'accepted'},'clinical-consent-only'),
    ...['excluded','implicated','other-recipient'].map((kind)=>snap({userId:'athlete',tier:2,consentStatus:'accepted',supportSelectionKind:'staff',supportSelectionUserId:kind==='other-recipient'?'other':'coach',supportSelectionTeamId:'team',supportRoute:'selected_staff',excludedRecipientIds:kind==='excluded'?['coach']:[],implicatedCoachId:kind==='implicated'?'coach':null},kind)),
    snap({userId:'athlete',tier:3,consentStatus:'not-required'},'clinical'),
    snap({userId:'outside',tier:2,consentStatus:'accepted'},'outside'),
    snap({userId:'athlete',teamId:'other',tier:2,consentStatus:'accepted'},'other'),
  ]
 };
 return {collection:(name:string)=>{const q:any={where:()=>q,select:()=>q,get:async()=>({docs:rows[name]||[]}),doc:()=>({get:async()=>snap(name==='pulsecheck-team-memberships'?{userId:'coach',teamId:'team',organizationId:'org',role:'coach',status:'active',staffCapabilities:capabilities,rosterVisibilityScope:'team'}:name==='pulsecheck-teams'?{organizationId:'org',status:'active'}:{status:'active'})})};return q;}};
}
test('support projection includes only accepted contact for the selected roster and no clinical contents',async()=>{
 assert.deepEqual(await loadSupportRequests(db(),'coach','team'),{requests:[{id:'accepted',athleteId:'athlete',createdAt:123}]});
});
test('empty explicit grants deny access',async()=>{await assert.rejects(()=>loadSupportRequests(db([]),'coach','team'),/Team access/);});
test('unauthenticated requests are rejected before reads',async()=>{
 let status=0;const res:any={setHeader(){},status(v:number){status=v;return this;},json(v:any){return v;}};
 await createSupportRequestsHandler({authorize:async()=>{throw Error();},load:async()=>{throw Error('must not read');}})({method:'GET',query:{teamId:'team'}} as any,res);
 assert.equal(status,401);
});
