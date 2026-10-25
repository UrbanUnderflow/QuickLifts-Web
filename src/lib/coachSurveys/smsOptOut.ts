import { validateRequest } from 'twilio';
import { COLLECTION, ROOT, tokenDigest } from './service';
export type SmsForm = Record<string, string | string[]>;
export function verifySmsWebhook(form: SmsForm, signature: string, settings: { authToken: string; url: string; accountSid: string; to: string }) {
  if (!settings.authToken || !/^https:\/\//.test(settings.url) || !settings.accountSid || !settings.to || !signature) return false;
  if (!form || Object.values(form).some(v => typeof v !== 'string' && !(Array.isArray(v) && v.every(s => typeof s === 'string')))) return false;
  if (form.AccountSid !== settings.accountSid || form.To !== settings.to || typeof form.From !== 'string' || !/^\+[1-9]\d{9,14}$/.test(form.From) || typeof form.MessageSid !== 'string' || !/^SM[a-fA-F0-9]{32}$/.test(form.MessageSid)) return false;
  // Official SDK validates every form parameter against the fixed configured URL,
  // not caller-controlled Host/X-Forwarded headers.
  return validateRequest(settings.authToken, signature, settings.url, form);
}
export function smsEventType(form: SmsForm): 'STOP' | 'START' | 'HELP' | null {
  if (['STOP','START','HELP'].includes(String(form.OptOutType))) return form.OptOutType as 'STOP'|'START'|'HELP';
  const body=typeof form.Body==='string'?form.Body.trim().toUpperCase():'';
  if (['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','REVOKE','OPTOUT'].includes(body))return 'STOP';
  if (['START','UNSTOP'].includes(body))return 'START';
  if (['HELP','INFO'].includes(body))return 'HELP';
  return null;
}
export async function recordSmsOptOut(db: FirebaseFirestore.Firestore, form: SmsForm, now=Date.now()) {
  const type=smsEventType(form);if(!type)return {handled:false};
  const root=db.collection(COLLECTION).doc(ROOT),phoneHash=tokenDigest(String(form.From));
  const event=root.collection('sms-events').doc(String(form.MessageSid)),suppression=root.collection('sms-suppressions').doc(phoneHash);
  return db.runTransaction(async tx=>{
    if((await tx.get(event)).exists)return {handled:true,duplicate:true};
    const prior=(await tx.get(suppression)).data();
    tx.create(event,{type,phoneHash,atMs:now}); // No incoming message text or raw number retained.
    if(type==='STOP')tx.set(suppression,{suppressed:true,stoppedAtMs:now,lastEventId:event.id},{merge:true});
    if(type==='START')tx.set(suppression,{suppressed:prior?.suppressed!==false,optInRequestedAtMs:now,lastEventId:event.id},{merge:true});
    // START records intent but never resumes a campaign or clears a previous STOP.
    // Renewed verified consent and an explicit reviewed restart are required.
    return {handled:true,duplicate:false};
  });
}
