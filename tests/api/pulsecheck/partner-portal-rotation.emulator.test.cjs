const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Firestore}=require('@google-cloud/firestore');
const portal=require('../../../netlify/functions/lib/partner-portal'),keys=require('../../../netlify/functions/lib/partner-api-keys');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
test('real Firestore transaction atomically rotates partner key, binding and sessions; signatures honor overlap', {skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8188'},async()=>{
 const db=new Firestore({projectId:'demo-portal-'+crypto.randomBytes(4).toString('hex')});
 const now=Date.now(),secret='synthetic-only-original-secret',password='synthetic-only-password-for-tests';
 const enc=Buffer.alloc(32,4),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',enc,iv);cipher.setAAD(Buffer.from(portal.KEY_ID));
 const env={PARTNER_API_KEY_ENCRYPTION_KEYS_JSON:JSON.stringify({v1:enc.toString('base64')}),PARTNER_API_KEY_ACTIVE_ENCRYPTION_VERSION:'v1'};
 const root=db.collection(keys.COLLECTIONS.keys).doc(hash(portal.KEY_ID));
 const expiresAt=new Date(now+86400000).toISOString();
 try{
 await db.doc('pulsecheck-organizations/synthetic-org').set({status:'active',productBrand:'athleticmind'});
 await db.doc('pulsecheck-teams/synthetic-team').set({status:'active',organizationId:'synthetic-org'});
 await root.set({keyId:portal.KEY_ID,requestId:'synthetic-request',partnerId:'auntedna',partnerName:'AuntEdna',environment:'production',status:'active',scopeMode:'explicit',grants:[{organizationId:'synthetic-org',teamIds:['synthetic-team']}],scopes:[keys.SCOPE],maxRequestsPerMinute:30,expiresAt,expiresAtMs:Date.parse(expiresAt),encryptedSecret:{version:'v1',iv:iv.toString('base64'),ciphertext:Buffer.concat([cipher.update(secret),cipher.final()]).toString('base64'),tag:cipher.getAuthTag().toString('base64')}});
 await portal.configurePartnerPortal(db,{password,actorEmail:'synthetic-admin',now});
 const action=input=>portal.partnerPortalAction(db,{now,env,...input});
 const cookieHeader=(await action({action:'login',password})).cookie.split(';')[0];
 const results=await Promise.allSettled([1,2].map(()=>action({action:'rotate',cookieHeader,expectedKeyId:portal.KEY_ID,overlapMinutes:1})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const rotated=results.find(r=>r.status==='fulfilled').value.body;
 const revealed=(await action({action:'secret',cookieHeader})).body;
 assert.equal(revealed.keyId,rotated.keyId);assert.notEqual(revealed.secret,secret);
 assert.equal((await db.collection(keys.COLLECTIONS.keys).get()).size,2);
 const auth=(keyId,secret,at)=>{const rawBody='{"teamId":"synthetic-team"}',path='/.netlify/functions/auntedna-snapshot-pull',t=Math.floor(at/1000);const sig=crypto.createHmac('sha256',secret).update(`${t}.POST.${path}.${rawBody}`).digest('hex');return keys.authenticatePartnerRequest(db,{keyId,signature:`t=${t},v1=${sig}`,rawBody,path,method:'POST',teamId:'synthetic-team',scope:keys.SCOPE,environment:'production',now:at,env});};
 assert.equal((await auth(portal.KEY_ID,secret,now+1000)).ok,true);
 assert.equal((await auth(portal.KEY_ID,secret,now+61000)).ok,false);
 assert.equal((await auth(rotated.keyId,revealed.secret,now+61000)).ok,true);
 const relogin=await action({action:'login',password,address:'second',now:now+61000});assert.equal(relogin.body.keyId,rotated.keyId);
 const audit=await db.collection(keys.COLLECTIONS.audit).get();assert.equal(JSON.stringify(audit.docs.map(d=>d.data())).includes(revealed.secret),false);
 }finally{await db.terminate();}
});
