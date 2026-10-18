// Generic FitWithPulse senders must not deliver to an installation claimed by PulseCheck.
// This also catches old Android tokens copied into challenge/participant snapshots.
async function assertNonPulseToken(db, token) {
  if (!db || !token) throw Object.assign(new Error('Push ownership unavailable'), {code:'push/ownership-unavailable'});
  const canonical = await db.collection('pulsecheck-push-installations').where('token','==',token).limit(1).get();
  const explicit = await db.collection('users').where('pulseCheckFcmToken','==',token).limit(1).get();
  const legacy = await db.collection('users').where('fcmToken','==',token).get();
  const pulse = !canonical.empty || !explicit.empty || legacy.docs.some(doc=>{
    const user=doc.data();return user.pulseCheckPushTokenModelVersion===2 || user.notificationPlatform==='android' || user.pushTokenSourceApp==='pulsecheck' || user.accountClosureRequestedAt;
  });
  if(pulse)throw Object.assign(new Error('PulseCheck installation requires owned product delivery'),{code:'push/product-ownership-mismatch'});
}
async function sendNonPulsePush(db,messaging,message){await assertNonPulseToken(db,message.token);return messaging.send(message);}
module.exports={assertNonPulseToken,sendNonPulsePush};
