const {getFirebaseAdminApp,isDevMode,admin,headers}=require('./config/firebase');
const c=require('./lib/pulsecheck-clay-self');
const scenes=require('./lib/pulsecheck-clay-scenes');
const windowScenes=require('./lib/pulsecheck-clay-window');
const reply=(statusCode,body)=>({statusCode,headers:{...headers,'Cache-Control':'private, no-store','Access-Control-Allow-Methods':'GET, POST, OPTIONS'},body:JSON.stringify(body)});
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS')return reply(200,{});
  try{
    const app=getFirebaseAdminApp({headers:event.headers||{}}),{uid}=await c.authenticate(event,admin,app);
    const mode=isDevMode({headers:event.headers||{}})?'dev':'prod',db=admin.firestore(app),bucket=c.bucketFor(admin,app,mode);
    if(event.httpMethod==='GET')return reply(200,await windowScenes.status(db,bucket,uid,event.queryStringParameters?.skillId));
    if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed.'});
    const body=c.parseBody(event);
    if(body.action!=='prepare_current_pair')throw c.fail(400,'Choose an available scene action.');
    const result=await windowScenes.prepare(db,bucket,uid,async payload=>{
      const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://fitwithpulse.ai');
      if(origin.protocol!=='https:')throw Error('dispatch');
      const response=await fetch(new URL('/.netlify/functions/pulsecheck-clay-scenes-background',origin),{method:'POST',headers:{'Content-Type':'application/json',Authorization:event.headers?.authorization||event.headers?.Authorization,'x-pulsecheck-firebase-mode':mode},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('dispatch');
    });
    return reply(result.status==='processing'?202:200,result);
  }catch(error){return reply(error.statusCode||500,{error:error.statusCode?error.message:'Skill scenes are temporarily unavailable.'});}
};
