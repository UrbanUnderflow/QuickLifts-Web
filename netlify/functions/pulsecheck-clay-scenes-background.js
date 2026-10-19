const {getFirebaseAdminApp,isDevMode,admin}=require('./config/firebase');
const c=require('./lib/pulsecheck-clay-self');
const scenes=require('./lib/pulsecheck-clay-scenes');
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return {statusCode:405};
  try{
    const app=getFirebaseAdminApp({headers:event.headers||{}}),{uid}=await c.authenticate(event,admin,app);
    const mode=isDevMode({headers:event.headers||{}})?'dev':'prod';
    await scenes.work(admin.firestore(app),c.bucketFor(admin,app,mode),uid,c.parseBody(event));
    return {statusCode:200};
  }catch(error){return {statusCode:error.statusCode||500};}
};
