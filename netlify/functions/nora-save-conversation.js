const { getFirebaseAdminApp, headers } = require('./config/firebase');
const {runtimeHelpers:{verifyPulseCheckCaller}} = require('./pulsecheck-chat');
const {assessNoraStorage,safeTranscript} = require('./utils/noraStoragePolicy');
exports.handler = async event => {
  if(event.httpMethod==='OPTIONS') return {statusCode:200,headers,body:''};
  if(event.httpMethod!=='POST') return {statusCode:405,headers,body:'{}'};
  try {
    const app=getFirebaseAdminApp({headers:event.headers||{}});
    const caller=await verifyPulseCheckCaller(app,event);
    const input=JSON.parse(event.body||'{}');
    const messages=input.messages;
    if(!Array.isArray(messages)||messages.length>300||messages.some(m=>typeof m.content!=='string'||m.content.length>20000)||String(event.body).length>200000) return {statusCode:400,headers,body:JSON.stringify({error:'Conversation is too large or invalid.'})};
    const db=app.firestore();
    const id=typeof input.id==='string'&&/^[\w-]{1,128}$/.test(input.id)?input.id:null;
    const ref=id?db.collection('conversations').doc(id):db.collection('conversations').doc();
    const previous=await ref.get();
    if(previous.exists&&previous.data().userId!==caller.userId) return {statusCode:403,headers,body:'{}'};
    const prior=previous.exists?previous.data():{};
    const storagePolicy=await assessNoraStorage({previous:prior,input});
    const normalized=messages.map(m=>({id:typeof m.id==='string'&&/^[\w-]{1,128}$/.test(m.id)?m.id:ref.id,content:m.content,isFromUser:m.isFromUser===true,timestamp:Number.isFinite(m.timestamp)?m.timestamp:Date.now()/1000,chatActions:(prior.messages||[]).find(saved=>saved.id===m.id)?.chatActions||[]}));
    const safeState={};
    if([0,1,2,3].includes(prior.escalationTier)) safeState.escalationTier=prior.escalationTier;
    if(typeof prior.isInSafetyMode==='boolean') safeState.isInSafetyMode=prior.isInSafetyMode;
    if(['active','resolved','pending'].includes(prior.escalationStatus)) safeState.escalationStatus=prior.escalationStatus;
    if(typeof prior.escalationRecordId==='string'&&/^[\w-]{1,128}$/.test(prior.escalationRecordId)) safeState.escalationRecordId=prior.escalationRecordId;
    if(Number.isFinite(prior.lastEscalationAt)) safeState.lastEscalationAt=prior.lastEscalationAt;
    for(const key of ['sessionDuration','assessmentQuestionCount','assessmentQuestionLimit']) if(Number.isFinite(input[key])) safeState[key]=input[key];
    if(['open_chat','assignment_assessment'].includes(input.conversationMode)) safeState.conversationMode=input.conversationMode;
    if(typeof input.assessmentDecisionCompleted==='boolean') safeState.assessmentDecisionCompleted=input.assessmentDecisionCompleted;
    await ref.set({...safeState,id:ref.id,userId:caller.userId,title:'Nora',messages:safeTranscript(normalized,storagePolicy),tags:[],storagePolicy,updatedAt:Date.now()/1000,createdAt:Number.isFinite(prior.createdAt)?prior.createdAt:Date.now()/1000});
    return {statusCode:200,headers,body:JSON.stringify({id:ref.id,storagePolicy})};
  } catch(error) {
    return {statusCode:error.statusCode||500,headers,body:JSON.stringify({error:'The conversation could not be saved safely.'})};
  }
};
