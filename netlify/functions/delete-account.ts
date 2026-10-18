import type { Handler } from '@netlify/functions';
const { getFirebaseAdminApp, headers } = require('./config/firebase');
const { requestClosure } = require('./lib/account-closure');
export const handler: Handler = async event => {
  if(event.httpMethod==='OPTIONS')return {statusCode:200,headers,body:''};
  if(event.httpMethod!=='POST')return {statusCode:405,headers,body:JSON.stringify({error:'POST only'})};
  const app=getFirebaseAdminApp(event);
  try {
    const token=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
    const identity=await app.auth().verifyIdToken(token,true);
    if(Date.now()/1000-Number(identity.auth_time)>300)return {statusCode:401,headers,body:JSON.stringify({error:'Sign in again to request account deletion.'})};
    const result=await requestClosure({db:app.firestore(),auth:app.auth(),uid:identity.uid,now:new Date()});
    return {statusCode:202,headers,body:JSON.stringify({...result,message:'Your account closure request is saved. Access is disabled. Personal-data cleanup continues in the background; consent, clinical and provider records require retention review.'})};
  }catch(error:any){
    const unauthorized=String(error?.code||'').startsWith('auth/');
    return {statusCode:unauthorized?401:503,headers,body:JSON.stringify({error:unauthorized?'Sign in again to request account deletion.':'Account closure could not be confirmed. Retry or contact support.'})};
  }
};
