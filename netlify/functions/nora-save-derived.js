const {getFirebaseAdminApp,headers}=require('./config/firebase');
const {runtimeHelpers:{verifyPulseCheckCaller}}=require('./pulsecheck-chat');
const {assessNoraStorage}=require('./utils/noraStoragePolicy');
exports.handler=async event=>{
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers,body:''};
  if(event.httpMethod!=='POST') return {statusCode:405,headers,body:'{}'};
  try {
    const app=getFirebaseAdminApp({headers:event.headers||{}}), caller=await verifyPulseCheckCaller(app,event);
    const {kind,id,data}=JSON.parse(event.body||'{}');
    if(!['note','summary'].includes(kind)||typeof id!=='string'||!/^[\w-]{1,128}$/.test(id)||!data||typeof data!=='object'||String(event.body).length>100000) return {statusCode:400,headers,body:'{}'};
    const db=app.firestore();
    const ref=kind==='note'?db.collection('user-mental-notes').doc(caller.userId).collection('notes').doc(id):db.collection('conversationSummaries').doc(id);
    const prior=await ref.get();
    if(kind==='summary') {
      const conversation=await db.collection('conversations').doc(id).get();
      if(!conversation.exists||conversation.data().userId!==caller.userId) return {statusCode:403,headers,body:'{}'};
      if(conversation.data().storagePolicy?.restricted) return {statusCode:409,headers,body:JSON.stringify({error:'Protected conversations cannot create ordinary summaries.'})};
    }
    const merged={...(prior.exists?prior.data():{}),...data,userId:caller.userId};
    const policy=await assessNoraStorage(merged);
    if(policy.restricted) return {statusCode:409,headers,body:JSON.stringify({error:'This content cannot be saved as an ordinary note or summary.',storagePolicy:policy})};
    await ref.set(merged);
    return {statusCode:200,headers,body:JSON.stringify({id})};
  } catch(error) { return {statusCode:error.statusCode||500,headers,body:JSON.stringify({error:'This record could not be saved safely.'})}; }
};
