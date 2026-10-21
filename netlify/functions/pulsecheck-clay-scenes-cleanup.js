const {getFirebaseAdminApp,admin}=require('./config/firebase');
const c=require('./lib/pulsecheck-clay-self');
const scenes=require('./lib/pulsecheck-clay-scenes');
exports.handler=async()=>{
  let removed=0;
  for(const mode of ['prod','dev']){
    try{
      const app=getFirebaseAdminApp({headers:{'x-pulsecheck-firebase-mode':mode}}),db=admin.firestore(app);
      const cursor=db.collection('pulsecheck-system').doc('clay-scene-cleanup');
      const saved=(await cursor.get()).data();
      const result=await scenes.cleanupStaleScenes(db,c.bucketFor(admin,app,mode),{pageToken:saved?.nextPageToken});
      await cursor.set({nextPageToken:result.nextPageToken,checkedAt:Date.now()});removed+=result.removed;
    }catch{console.error('Clay scene cleanup could not complete.');}
  }
  return {statusCode:200,body:JSON.stringify({removed})};
};
