const admin=require('firebase-admin');
async function loadOwnedPulseTarget(userId){
 const db=admin.firestore();if((await db.collection('account-closure-jobs').doc(userId).get()).exists)return null;const user=await db.collection('users').doc(userId).get();
 if(!user.exists||user.data()?.accountClosureRequestedAt)return null;
 const snap=await db.collection('pulsecheck-push-installations').where('ownerUserId','==',userId).get();
 return snap.docs.map(doc=>doc.data()).find(r=>r.ownerUserId===userId&&r.sourceApp==='pulsecheck'&&r.token&&!r.revokedAt)||null;
}
function ownedPayload(message,userId,platform){
 const copy={...message,data:{...message.data,recipientUserId:userId,title:message.notification?.title||message.data?.title||'',body:message.notification?.body||message.data?.body||''}};
 if(platform==='android'){delete copy.notification;copy.android={...message.android,priority:'high'};delete copy.android.notification;}
 return copy;
}
async function sendOwnedPulsePush(userId,message){const target=await loadOwnedPulseTarget(userId);if(!target)throw Error('No owned PulseCheck installation');return admin.messaging().send(ownedPayload({...message,token:target.token},userId,target.platform));}
module.exports={loadOwnedPulseTarget,ownedPayload,sendOwnedPulsePush};
