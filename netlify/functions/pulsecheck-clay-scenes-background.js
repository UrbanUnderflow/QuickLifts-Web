const {getFirebaseAdminApp,isDevMode,admin}=require('./config/firebase');
const c=require('./lib/pulsecheck-clay-self');
const windowScenes=require('./lib/pulsecheck-clay-window');
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return {statusCode:405};
  try{
    const app=getFirebaseAdminApp({headers:event.headers||{}}),{uid}=await c.authenticate(event,admin,app);
    const mode=isDevMode({headers:event.headers||{}})?'dev':'prod';
    const body=c.parseBody(event);
    if(body.rollingWindow!==true)return {statusCode:400};
    await windowScenes.workPair(admin.firestore(app),c.bucketFor(admin,app,mode),uid,body);
    return {statusCode:200};
  }catch(error){return {statusCode:error.statusCode||500};}
};
