import { createHash } from 'node:crypto';
import type { firestore } from 'firebase-admin';
import { loadTeamAccess, validTeamId, visibleAthlete, activeRecord } from './access';
import { loadDashboard } from './data';
import type { TeamParticipation } from './types';
export type ReportCcRecipient={email:string;name?:string};
export type DeliveryConfig={teamId:string;dailyEnabled:boolean;weeklyEnabled:boolean;timeZone:string;sendHour:number;startDate:string;recipientUids:string[];recipientCc?:Record<string,ReportCcRecipient[]>};
export type ReportKind='daily'|'weekly';
const DAY=86400000;
export function validateDeliveryConfig(v:any):DeliveryConfig{
 if(!v||!validTeamId(v.teamId)||typeof v.dailyEnabled!=='boolean'||typeof v.weeklyEnabled!=='boolean'||!Number.isInteger(v.sendHour)||v.sendHour<0||v.sendHour>23)throw new Error('Choose a team, report types, and valid delivery hour.');
 if(typeof v.timeZone!=='string')throw new Error('Choose a time zone.');
 try{new Intl.DateTimeFormat('en-US',{timeZone:v.timeZone}).format();}catch{throw new Error('Choose a valid time zone.');}
 if(typeof v.startDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.startDate)||!Number.isFinite(Date.parse(v.startDate))||new Date(v.startDate).toISOString().slice(0,10)!==v.startDate)throw new Error('Choose a valid start date.');
 if(!Array.isArray(v.recipientUids)||v.recipientUids.length>30||v.recipientUids.some((id:unknown)=>!validTeamId(id)))throw new Error('Choose valid team recipients.');
 const recipientUids=[...new Set<string>(v.recipientUids)];
 if((v.dailyEnabled||v.weeklyEnabled)&&!recipientUids.length)throw new Error('Choose at least one authorized recipient.');
 const recipientCc:Record<string,ReportCcRecipient[]>={};
 if(v.recipientCc!==undefined){
  if(!v.recipientCc||typeof v.recipientCc!=='object'||Array.isArray(v.recipientCc))throw new Error('Choose valid CC recipients.');
  for(const [uid,entries] of Object.entries(v.recipientCc)){
   if(!recipientUids.includes(uid)||!Array.isArray(entries)||entries.length>20)throw new Error('CC recipients must belong to a selected report recipient, with at most 20 addresses.');
   const seen=new Set<string>();const normalized:ReportCcRecipient[]=[];
   for(const entry of entries){
    if(!entry||typeof entry!=='object'||Object.keys(entry).some(key=>!['email','name'].includes(key))||typeof entry.email!=='string'||entry.email.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(entry.email.trim()))throw new Error('Enter valid CC email addresses.');
    if(entry.name!==undefined&&(typeof entry.name!=='string'||entry.name.length>120||/[<>\x00-\x1f\x7f]/.test(entry.name)))throw new Error('Enter a valid CC display name.');
    const email=entry.email.trim().toLowerCase(),name=entry.name?.trim();
    if(!seen.has(email)){normalized.push({email,...(name?{name}:{})});seen.add(email);}
   }
   if(normalized.length)recipientCc[uid]=normalized;
  }
 }
 return {teamId:v.teamId,dailyEnabled:v.dailyEnabled,weeklyEnabled:v.weeklyEnabled,timeZone:v.timeZone,sendHour:v.sendHour,startDate:v.startDate,recipientUids,recipientCc};
}
export async function resolveReportRecipients(db:firestore.Firestore,teamId:string,uids:string[]){
 const results=[];
 for(const uid of [...new Set(uids)]){
  if((await db.collection('account-closure-jobs').doc(uid).get()).exists)throw new Error('Recipient account is unavailable.');
  const {access}=await loadTeamAccess(db,uid,teamId);
  if(!access.participation)throw new Error('A selected recipient no longer has team participation access.');
  const user=(await db.collection('users').doc(uid).get()).data();const email=String(user?.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('A selected recipient has no valid account email.');
  results.push({uid,email,name:String(user?.displayName||user?.username||email)});
 }
 return results;
}
export function dueReports(config:DeliveryConfig,now=new Date()):Array<{kind:ReportKind;reportDate:string}>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:config.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));const today=`${p.year}-${p.month}-${p.day}`;
 if(today<config.startDate||Number(p.hour)<config.sendHour)return [];
 const midnight=Date.parse(today+'T00:00:00Z'),reportDate=new Date(midnight-DAY).toISOString().slice(0,10);
 return [...(config.dailyEnabled?[{kind:'daily' as const,reportDate}]:[]),...(config.weeklyEnabled&&new Date(midnight).getUTCDay()===1?[{kind:'weekly' as const,reportDate}]:[])];
}
export const deliveryId=(teamId:string,uid:string,kind:ReportKind,date:string)=>createHash('sha256').update(JSON.stringify([teamId,uid,kind,date])).digest('hex');
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function summarizeParticipation(data:TeamParticipation,from:string,to:string){
 return data.athletes.map(a=>{const days=(a.dailyParticipation||[]).filter(d=>d.date>=from&&d.date<=to&&d.scheduled);return {id:a.id,name:a.displayName,days:days.filter(d=>d.checkIn).length,expected:days.length,practices:days.reduce((n,d)=>n+d.skillCompleted,0),evening:days.filter(d=>d.eveningCompleted).length};}).filter(a=>a.expected>0);
}
export function renderParticipationReport(input:{teamName:string;brand:string;kind:ReportKind;to:string;current:TeamParticipation;previous?:TeamParticipation;url:string}){
 const {teamName,brand,kind,to,current,previous,url}=input;
 const from=kind==='daily'?to:new Date(Date.parse(to)-6*DAY).toISOString().slice(0,10);
 const rows=summarizeParticipation(current,from,to).sort((a,b)=>b.days-a.days||a.name.localeCompare(b.name));
 const active=rows.filter(a=>a.days),missing=rows.filter(a=>!a.days),practices=rows.reduce((n,a)=>n+a.practices,0);
 const names=(list:typeof rows)=>list.map(a=>esc(a.name)).join(', ');const dateLabel=(v:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z'));const period=kind==='daily'?dateLabel(to):`${dateLabel(from)} to ${dateLabel(to)}`;
 let body=`<h2>${active.length} of ${rows.length} athletes checked in ${kind==='daily'?'yesterday':'last week'}.</h2>`;
 if(kind==='daily')body+=`<p><strong>Checked in:</strong> ${active.length?names(active):'No recorded check-ins.'}</p><p><strong>${missing.length} athletes</strong> had no recorded check-in.</p><p><strong>Yesterday’s assigned practices:</strong> ${practices?`${practices} recorded as complete.`:'None recorded as complete.'}</p>`;
 else{
  body+=`<h3>Who is showing up</h3>${active.length?`<table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left;padding:10px">Athlete</th><th style="text-align:left;padding:10px">Check-in routine</th></tr>${active.map(a=>`<tr><td style="padding:10px;border-bottom:1px solid #ddd">${esc(a.name)}</td><td style="padding:10px;border-bottom:1px solid #ddd">Checked in on ${a.days} of ${a.expected} days</td></tr>`).join('')}</table>`:'<p>No check-ins were recorded this week.</p>'}`;
  body+=`<h3>Who to reconnect with</h3><p>${missing.length?`${names(missing)} had no recorded check-ins during the week.`:'Every eligible athlete recorded at least one check-in.'}</p>`;
  if(previous){const old=summarizeParticipation(previous,previous.from,previous.to);body+=`<h3>What changed</h3><p>${active.length} of ${rows.length} athletes checked in this week, compared with ${old.filter(a=>a.days).length} of ${old.length} last week. ${rows.filter(a=>a.days>=3).length} checked in on at least three days, compared with ${old.filter(a=>a.days>=3).length} last week.</p><p>Evening check-ins: ${rows.reduce((n,a)=>n+a.evening,0)} recorded this week, compared with ${old.reduce((n,a)=>n+a.evening,0)} last week.</p>`;}
  body+=`<h3>Skill practice</h3><p>${practices?`${practices} practices assigned for this week are recorded as complete. ${rows.filter(a=>a.practices).map(a=>`${esc(a.name)}: ${a.practices}`).join('; ')}.`:'No practices assigned for this week are recorded as complete.'}</p><h3>One focus for this week</h3><p>${missing.length?'Agree on one check-in time tied to practice. Privately ask athletes with no recorded activity whether timing or access is getting in the way.':'Keep the agreed check-in time consistent and ask the team what is helping them participate.'}</p><p><strong>Next week, review:</strong> How many athletes checked in, and how many checked in on at least three days?</p>`;
 }
 const subject=`${teamName} | ${kind==='daily'?'Daily participation':'Weekly coach report'} | ${period}`;
 const content=`<p style="font-size:12px;letter-spacing:2px">${esc(brand.toUpperCase())} · ${kind==='daily'?'DAILY PARTICIPATION':'WEEKLY COACH REPORT'}</p><h1>${esc(teamName)}</h1><p>${esc(period)}</p>${body}`;
 const foot='<p style="font-size:12px;color:#555">Recorded participation uses UTC dates. Practice counts follow the assignment date. Historical summaries reflect current team access. Names are dashboard display names. A check-in day means at least one recorded check-in. Missing activity alone does not establish how an athlete is feeling. Private responses and conversations stay private.</p>';
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f1eb;color:#222;font:16px/1.6 Arial,sans-serif"><main style="max-width:640px;margin:28px auto;background:white;padding:32px;border-radius:16px">${content}<p><a href="${esc(url)}" style="display:inline-block;background:#222;color:white;padding:12px 20px;text-decoration:none;border-radius:8px">View ${kind==='daily'?'daily':'weekly'} report</a></p>${foot}</main></body></html>`;
 return {subject,html,contentHtml:content+foot,from,to,athleteIds:rows.map(a=>a.id),senderName:brand==='AthleticMind'?'AthleticMind':undefined};
}
export async function prepareParticipationReport(db:firestore.Firestore,uid:string,teamId:string,kind:ReportKind,to:string,id:string){
 const asOf=Date.parse(to+'T00:00:00Z')+DAY;
 if(!Number.isFinite(asOf)||new Date(asOf-DAY).toISOString().slice(0,10)!==to||asOf>Date.now())throw new Error('Choose a completed reporting date.');
 if(kind==='weekly'&&new Date(asOf-DAY).getUTCDay()!==0)throw new Error('Weekly reports end on Sunday.');
 const {team}=await loadTeamAccess(db,uid,teamId);const org=(await db.collection('pulsecheck-organizations').doc(team.organizationId).get()).data()||{};
 const brand=org.productBrand==='athleticmind'?'AthleticMind':'PulseCheck';
 const current=await loadDashboard(db,uid,teamId,'participation',asOf,true) as TeamParticipation;
 const previous=kind==='weekly'?await loadDashboard(db,uid,teamId,'participation',asOf-7*DAY,true) as TeamParticipation:undefined;
 return renderParticipationReport({teamName:[org.displayName,team.displayName].filter(Boolean).join(' · ')||'Your team',brand,kind,to,current,previous,url:`https://fitwithpulse.ai/coach/participation-report?id=${encodeURIComponent(id)}`});
}

export async function assertReportAudience(db:firestore.Firestore,uid:string,teamId:string,athleteIds:string[]){
 const {access,membership,team}=await loadTeamAccess(db,uid,teamId);
 if(!access.participation)throw new Error('Report access changed.');
 const roster=await db.collection('pulsecheck-team-memberships').where('teamId','==',teamId).get();
 const permitted=new Set(roster.docs.map(d=>d.data()).filter(d=>d.role==='athlete'&&d.organizationId===team.organizationId&&activeRecord(d)&&visibleAthlete(membership,d.userId)).map(d=>d.userId));
 if(athleteIds.some(id=>!permitted.has(id)))throw new Error('Report audience changed during preparation.');
}
