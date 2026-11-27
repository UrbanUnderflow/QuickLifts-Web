/** Shared web/iOS/Android reflection. Transient conversation; no transcript or journal persistence here. */
const { initializeFirebaseAdmin, getFirebaseAdminApp, headers, admin } = require('./config/firebase');
const { runtimeHelpers: runtime } = require('./pulsecheck-chat');
const { resolvePulseCheckYouthTrack, allowsDirectNoraChat } = require('./utils/pulsecheck-youth-track');
const { classifyNoraConversationLane, buildNoraBoundaryResponse, evaluateNoraEngagementResponse, hasHardNoraEngagementFailure } = require('./utils/noraEngagementPolicy');
const { assessNoraStorage } = require('./utils/noraStoragePolicy');
const { escalateJournalClassification } = require('./journal-safety-screen');
const contract = require('./lib/skill-reflection/v1');
const privateHeaders = { ...headers, 'Cache-Control': 'private, no-store' };
const reply = (statusCode, body) => ({ statusCode, headers: privateHeaders, body: JSON.stringify(body) });
async function authorize(app, event, preview) {
  const token = String(event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error(), {statusCode:401});
  const staff = event.headers?.['x-athleticmind-internal'] === 'skill-curriculum';
  if (staff && !preview) throw Object.assign(new Error(), { statusCode:403 });
  let user;
  if (staff) {
    const verifier = admin.apps.find(a => a.name === 'reflection-staff') || admin.initializeApp({ projectId:'theathleticmind-77954' }, 'reflection-staff');
    const decoded = await verifier.auth().verifyIdToken(token);
    if (decoded.firebase?.sign_in_provider !== 'google.com' || !decoded.email_verified) throw Object.assign(new Error(),{statusCode:403});
    user = {userId:`athleticmind:${decoded.uid}`, email:decoded.email};
  } else {
    user = await runtime.verifyPulseCheckCaller(app,event);
    if (preview) { const decoded = await app.auth().verifyIdToken(token,true); user.email=decoded.email_verified ? decoded.email : ''; }
  }
  if (preview) {
    if (!user.email || user.email.includes('/')) throw Object.assign(new Error(),{statusCode:403});
    const registry=await app.firestore().collection('admin').doc(user.email.toLowerCase()).get();
    if (!registry.exists || registry.data()?.disabled === true || registry.data()?.isActive === false) throw Object.assign(new Error(),{statusCode:403});
  } else if (!allowsDirectNoraChat((await resolvePulseCheckYouthTrack(app.firestore(),user.userId)).track)) throw Object.assign(new Error(),{statusCode:403});
  return user;
}
async function ask(input) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPEN_AI_SECRET_KEY}`},signal:AbortSignal.timeout(20000),
    body:JSON.stringify({model:'gpt-4o-mini',store:false,temperature:0.4,max_tokens:180,messages:[{role:'system',content:contract.PROMPT},{role:'user',content:JSON.stringify({practice:input.context,conversation:input.messages,task:'Ask the next reflection question.'})}]}),
  });
  if (!response.ok) throw new Error('model unavailable');
  return (await response.json()).choices?.[0]?.message?.content?.trim();
}
exports.handler = async event => {
  if(event.httpMethod==='OPTIONS') return reply(204,{});
  if(event.httpMethod!=='POST') return reply(405,{error:'Method not allowed.'});
  if(!event.body || Buffer.byteLength(event.body)>24000) return reply(413,{error:'This reflection is too long.'});
  let input;try{input=contract.validate(JSON.parse(event.body));}catch{return reply(400,{error:'Open the reflection again and try again.'});}
  try {
    initializeFirebaseAdmin({headers:event.headers||{}});const app=getFirebaseAdminApp({headers:event.headers||{}});
    const caller=await authorize(app,event,input.preview);const db=app.firestore();
    const latest=input.messages.at(-1)?.content || '';
    if(latest) {
      const history=input.messages.slice(0,-1).map(m=>({content:m.content,isFromUser:m.role==='user'}));
      const classification=await runtime.classifyEscalation(db,caller.userId,latest,history,`skill-reflection-${input.sessionId}`);
      if(!classification) return reply(503,{error:'Nora could not answer right now. Your words are still here. Try again.'});
      const lane=classifyNoraConversationLane(latest);
      if(Number(classification.tier)>=2 || ['clinical_care','critical_safety'].includes(lane)) {
        const safetyLane=Number(classification.tier)>=3 ? 'critical_safety' : 'clinical_care';
        let safety={status:safetyLane==='critical_safety'?'critical':'checkIn'};
        if(!input.preview) {
          const result=await escalateJournalClassification({db,userId:caller.userId,messaging:app.messaging(),message:latest,classification,sourceType:'journal_draft',sourceRef:input.sessionId,excerpt:latest.slice(0,280)});
          safety={status:result.outcome,escalationId:result.escalationId,handoff:result.handoff};
        }
        return reply(200,{reply:buildNoraBoundaryResponse(safetyLane,{athleteMessage:latest,category:classification.category}),safety,stopped:true,preview:input.preview});
      }
      if (input.action === 'question' && lane === 'closure') return reply(200,{reply:'You’re welcome. You can finish here or review your words.',ready:true,preview:input.preview});
      if (['coach_handoff','health_data','app_support'].includes(lane)) return reply(200,{reply:'This practice reflection can help you look back on what you tried. Open your main Nora conversation for that request.',stopped:true,preview:input.preview});
      const storage=await assessNoraStorage(input.messages.map(m=>({content:m.content,isFromUser:m.role==='user'})));
      if(storage.restricted) return reply(200,{reply:'Let’s leave this out of a practice journal. You can keep the practice completion without saving these words.',stopped:true,preview:input.preview});
    }
    if(input.action==='draft') return reply(200,{draft:contract.makeDraft(input.messages),preview:input.preview,version:contract.VERSION});
    if(input.messages.length>=8) return reply(200,{reply:'You can review your words now and choose what to keep.',ready:true,preview:input.preview});
    for(let attempt=0;attempt<2;attempt++) {
      const text=await ask(input);
      const check=evaluateNoraEngagementResponse({athleteMessage:latest||'I just finished practicing this mental skill.',response:text,lane:'performance',groundingMessages:input.messages.filter(m=>m.role==='user').map(m=>m.content),previousAssistantMessages:input.messages.filter(m=>m.role==='assistant').map(m=>m.content)});
      if(contract.validReply(text)&&!hasHardNoraEngagementFailure(check)) return reply(200,{reply:text,preview:input.preview,version:contract.VERSION});
    }
    return reply(503,{error:'Nora could not answer right now. Your words are still here. Try again.'});
  }catch(error){return reply([401,403].includes(error.statusCode)?error.statusCode:503,{error:[401,403].includes(error.statusCode)?'Sign in with an account that can use this reflection.':'Nora could not answer right now. Your words are still here. Try again.'});}
};
exports._private={authorize,ask};
