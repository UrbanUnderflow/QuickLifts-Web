const test=require('node:test'),assert=require('node:assert/strict');
const {changeOrganizationLifecycle,purgeOrganizationBatch,RETENTION_MS}=require('../../../netlify/functions/lib/organization-lifecycle');
function mock(seed){
 const records=new Map(Object.entries(seed));
 const snapshot=(path)=>({id:path.split('/').at(-1),ref:doc(path),exists:records.has(path),data:()=>records.get(path)});
 const doc=path=>({path,get:async()=>snapshot(path),collection:name=>query(`${path}/${name}`),set:async(data,opt)=>records.set(path,opt?.merge?{...records.get(path),...data}:data),update:async data=>records.set(path,{...records.get(path),...data}),delete:async()=>records.delete(path)});
 const query=(path,filters=[],limit=Infinity,cursor='')=>({doc:id=>doc(`${path}/${id}`),where:(f,op,v)=>query(path,[...filters,[f,op,v]],limit,cursor),limit:n=>query(path,filters,n,cursor),orderBy:()=>query(path,filters,limit,cursor),startAfter:id=>query(path,filters,limit,id),get:async()=>{const docs=[...records.keys()].filter(p=>p.startsWith(`${path}/`)&&p.split('/').length===path.split('/').length+1).sort().map(snapshot).filter(s=>s.id>cursor&&filters.every(([f,op,v])=>op==='=='?s.data()[f]===v:v.includes(s.data()[f]))).slice(0,limit);return{docs,empty:!docs.length}}});
 const db={collection:query,runTransaction:async fn=>{const writes=[];const value=await fn({get:r=>r.get(),set:(r,...args)=>writes.push(()=>r.set(...args)),update:(r,d)=>writes.push(()=>r.update(d)),delete:r=>writes.push(()=>r.delete())});for(const w of writes)await w();return value}};
 return{db,records};
}
const org='pulsecheck-organizations/org',now=1000000;
test('exact name confirmation, 90day window, closed actor and restoration preserve configuration',async()=>{
 const {db,records}=mock({[org]:{displayName:'University',status:'active',configuration:{x:1}}});
 await assert.rejects(changeOrganizationLifecycle({db,organizationId:'org',actorUid:'admin',action:'delete',confirmationName:'wrong',now}));
 await changeOrganizationLifecycle({db,organizationId:'org',actorUid:'admin',action:'delete',confirmationName:'University',now});
 assert.equal(records.get(org).purgeAfter,now+RETENTION_MS);
 await assert.rejects(changeOrganizationLifecycle({db,organizationId:'org',actorUid:'admin',action:'restore',now:now+RETENTION_MS}));
 await changeOrganizationLifecycle({db,organizationId:'org',actorUid:'admin',action:'restore',now:now+RETENTION_MS-1});
 assert.equal(records.get(org).status,'active');assert.deepEqual(records.get(org).configuration,{x:1});assert.equal(records.get(org).lifecycleState,undefined);
 records.set('account-closure-jobs/admin',{});
 await assert.rejects(changeOrganizationLifecycle({db,organizationId:'org',actorUid:'admin',action:'delete',confirmationName:'University',now}));
});
test('bounded purge resumes, preserves unrelated org and personal/consent history, finishes tombstones',async()=>{
 const seed={ [org]:{displayName:'University',status:'decommissioned',lifecycleState:'deleted',deletedAt:now,purgeAfter:now+RETENTION_MS},'pulsecheck-teams/a':{organizationId:'org',displayName:'A'},'pulsecheck-teams/b':{organizationId:'org'},'pulsecheck-teams/other':{organizationId:'other'},'pulsecheck-invite-links/one':{organizationId:'org'},'pulsecheck-invite-links/two':{teamId:'a'},'pulsecheck-invite-links/other':{organizationId:'other'},'coach-team-insight-reports/delivery/configs/a':{teamId:'a'},'coach-team-insight-reports/delivery/reports/r':{teamId:'a'},'pulsecheck-team-memberships/m':{teamId:'a',consent:true},'users/u':{name:'Athlete'}};
 const {db,records}=mock(seed);
 assert.equal((await purgeOrganizationBatch({db,organizationId:'org',now})).processed,false);
 for(let i=0;i<10&&records.get(org).lifecycleState!=='purged';i++) await purgeOrganizationBatch({db,organizationId:'org',now:now+RETENTION_MS,batchSize:1});
 assert.equal(records.get(org).lifecycleState,'purged');assert.equal(records.get(org).displayName,undefined);assert.equal(records.get(org).purgeAfter,undefined,'completed tombstones must leave scheduler expiry query');
 assert.equal(records.get('pulsecheck-teams/a').status,'deleted');assert.equal(records.get('pulsecheck-teams/b').status,'deleted');
 for(const p of ['pulsecheck-teams/other','pulsecheck-invite-links/other','pulsecheck-team-memberships/m','users/u'])assert.deepEqual(records.get(p),seed[p]);
 for(const p of ['pulsecheck-invite-links/one','pulsecheck-invite-links/two','coach-team-insight-reports/delivery/configs/a','coach-team-insight-reports/delivery/reports/r'])assert.equal(records.has(p),false);
 await assert.rejects(changeOrganizationLifecycle({db,organizationId:'org',actorUid:'admin',action:'restore',now:now+RETENTION_MS}));
});
test('active lease prevents concurrent worker; expired lease retries purging state',async()=>{
 const {db,records}=mock({[org]:{lifecycleState:'purging',purgeAfter:now},[`${org}/lifecycle-jobs/purge`]:{leaseId:'other',leaseUntil:now+100}});
 assert.equal((await purgeOrganizationBatch({db,organizationId:'org',now})).processed,false);
 assert.equal((await purgeOrganizationBatch({db,organizationId:'org',now:now+101})).completed,true);
 assert.equal(records.get(org).lifecycleState,'purged');
});
test('stale ownership query cannot delete an operational record reassigned before commit',async()=>{
 const path='pulsecheck-invite-links/moved';
 const {db,records}=mock({[org]:{lifecycleState:'deleted',deletedAt:now,purgeAfter:now},[path]:{organizationId:'org'}});
 const collection=db.collection;
 db.collection=name=>{
   const base=collection(name);if(name!=='pulsecheck-invite-links')return base;
   return{...base,where:(...args)=>{const q=base.where(...args);return{...q,limit:n=>{const limited=q.limit(n);return{...limited,get:async()=>{const snapshot=await limited.get();records.set(path,{organizationId:'another'});return snapshot}}}}}};
 };
 await purgeOrganizationBatch({db,organizationId:'org',now});
 assert.equal(records.get(path).organizationId,'another');
});
test('restore preserves absent original status rather than activating an unconfigured organization',async()=>{
 const {db,records}=mock({[org]:{displayName:'University',configuration:{x:1}}});
 await changeOrganizationLifecycle({db,organizationId:'org',actorUid:'admin',action:'delete',confirmationName:'University',now});
 assert.equal(records.get(org).previousStatus,null);
 await changeOrganizationLifecycle({db,organizationId:'org',actorUid:'admin',action:'restore',now:now+1});
 assert.equal(Object.hasOwn(records.get(org),'status'),false);
 assert.deepEqual(records.get(org).configuration,{x:1});
});
