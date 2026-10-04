import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, RefreshCw, FileText } from 'lucide-react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import { buildInsightFacts, buildFallbackReport, consistencySpotlight, type InsightReport, type InsightRole, type InsightFact } from '../../lib/coach-dashboard/insights';
import { demoTeamParticipation, demoTeamWellbeing } from './clayDashboardDemoData';
import s from './TeamInsightReport.module.css';

function date(value:string) { return new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'}); }
function value(n:number|null,unit:string) { return n===null?'Unavailable':`${Number(n.toFixed(1))}${unit==='%'?'%':unit?` ${unit}`:''}`; }
function Evidence({fact}:{fact:InsightFact}) { return <article id={`report-fact-${fact.id}`} className={s.fact}><h3>{fact.label}</h3><div className={s.values}><div><span>This week</span><strong>{value(fact.current,fact.unit)}</strong></div><div><span>Previous week</span><strong>{value(fact.previous,fact.unit)}</strong></div></div><p>{fact.detail}</p></article>; }
export default function TeamInsightReport({teamId,isDemo=false,canViewTrainer}:{teamId:string;isDemo?:boolean;canViewTrainer:boolean}) {
 const [role,setRole]=useState<InsightRole>('coach');
 const [result,setResult]=useState<{key:string;report:InsightReport}|null>(null);
 const [pending,setPending]=useState(false);
 const [history,setHistory]=useState<{key:string;items:Pick<InsightReport,'from'|'to'|'generatedAt'|'mode'>[]}|null>(null);
 const [historyError,setHistoryError]=useState<string|null>(null);
 const [historyRevision,setHistoryRevision]=useState(0);
 const [error,setError]=useState<string|null>(null);
 const controller=useRef<AbortController|null>(null);
 const serial=useRef(0);
 const activeRole=canViewTrainer?role:'coach';
 const requestKey=`${teamId}:${activeRole}:${isDemo}`;
 const currentKey=useRef(requestKey);currentKey.current=requestKey;
 const report=result?.key===requestKey?result.report:null;
 const historyItems=isDemo?[{from:demoTeamParticipation.from,to:demoTeamParticipation.to,mode:'ai' as const}]:history?.key===requestKey?history.items:[];
 useEffect(()=>{serial.current++;controller.current?.abort();setPending(false);setError(null);setResult(null);},[requestKey]);
 useEffect(()=>()=>{serial.current++;controller.current?.abort();},[]);
 useEffect(()=>{
  const abort=new AbortController();const key=requestKey;setHistory(previous=>previous?.key===key?previous:null);setHistoryError(null);
  if(isDemo||!teamId)return ()=>abort.abort();
  async function loadHistory(){
   try {
    const token=await auth.currentUser?.getIdToken();
    if(!token)throw new Error('Sign in to view saved reports.');
    if(abort.signal.aborted)return;
    const response=await fetch(`/api/coach/team-insights?${new URLSearchParams({teamId,role:activeRole})}`,{headers:{Authorization:`Bearer ${token}`,...getFirebaseModeRequestHeaders()},signal:abort.signal,cache:'no-store'});
    if(!response.ok)throw new Error('Saved reports could not be loaded.');
    const data=await response.json();
    if(!Array.isArray(data.history))throw new Error('Saved reports could not be loaded.');
    if(!abort.signal.aborted&&currentKey.current===key)setHistory({key,items:data.history});
   }catch(e){if(!abort.signal.aborted&&currentKey.current===key)setHistoryError(e instanceof Error?e.message:'Saved reports could not be loaded.');}
  }
  void loadHistory();return ()=>abort.abort();
 },[requestKey,historyRevision,teamId,activeRole,isDemo]);
 async function generate(to?:string) {
  controller.current?.abort();const abort=new AbortController();controller.current=abort;
  const attempt=++serial.current;const key=requestKey;setPending(true);setError(null);
  try {
   let next:InsightReport;
   if(isDemo) {
    const facts=buildInsightFacts(activeRole,activeRole==='coach'?demoTeamParticipation:demoTeamWellbeing);
    next=buildFallbackReport(activeRole,facts,demoTeamParticipation.from,demoTeamParticipation.to);
    next.takeaway=activeRole==='coach'?'Use this week’s participation to choose one routine to reinforce with the team.':'Review reported recovery alongside wearable coverage before deciding what to follow up on.';
    next.insights=activeRole==='coach'?[{title:'Make the evening check-in easier to remember',meaning:'In this sample team, fewer scheduled evening check-ins were completed than morning check-ins.',action:'Try a consistent evening reminder next week, then compare completion across the two weeks.',evidenceIds:['morningCompleted','eveningCompleted']}]:[{title:'Start with the athletes’ reported recovery',meaning:'The sample recovery rating reflects the athletes who contributed. It may not describe every athlete on the team.',action:'Use the recovery summary as context for a team conversation and check the contributor count before comparing weeks.',evidenceIds:facts.filter(f=>f.id.startsWith('recovery')&&f.current!==null).map(f=>f.id)}];
    next.spotlight=activeRole==='coach'?consistencySpotlight(demoTeamParticipation):[];
    next.limitations=['Sample team data. The takeaway and next steps illustrate the report format.','A previous week is not provided in this demo.'];
   } else {
    const token=await auth.currentUser?.getIdToken();
    if(!token)throw new Error('Sign in again to generate your team report.');
    if(abort.signal.aborted)return;
    const response=await fetch('/api/coach/team-insights',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...getFirebaseModeRequestHeaders()},body:JSON.stringify({teamId,role:activeRole,...(to?{to}:{})}),signal:abort.signal,cache:'no-store'});
    if(!response.ok)throw new Error(response.status===403?'Your current permissions do not allow this report.':response.status===429?'Please wait a moment before generating another report.':'The report could not be generated. Please try again.');
    next=await response.json();
    if(next.role!==activeRole||!Array.isArray(next.facts)||!Array.isArray(next.insights))throw new Error('The report could not be loaded. Please try again.');
   }
   if(attempt===serial.current&&currentKey.current===key&&!abort.signal.aborted){setResult({key,report:next});if(!isDemo)setHistoryRevision(n=>n+1);}
  }catch(e){if(attempt===serial.current&&currentKey.current===key&&!abort.signal.aborted)setError(e instanceof Error?e.message:'The report could not be generated.');}
  finally{if(attempt===serial.current&&currentKey.current===key&&!abort.signal.aborted)setPending(false);}
 }
 return <section className={s.root} aria-label="Weekly team insights"><header className={s.header}><div><p className={s.eyebrow}>{isDemo?'Sample report':'Weekly report'}</p><h1>{activeRole==='coach'?'Coach reports':'Trainer reports'}</h1><p className={s.subtitle}>{activeRole==='coach'?'What changed, what your team is learning, and what to reinforce next.':'Reported mood, recovery, wearable trends, and journaling activity in context.'}</p></div>{canViewTrainer&&<div className={s.switch} aria-label="Report audience"><button type="button" aria-pressed={activeRole==='coach'} onClick={()=>setRole('coach')}>Coach report</button><button type="button" aria-pressed={activeRole==='trainer'} onClick={()=>setRole('trainer')}>Trainer report</button></div>}</header>
 <div className={s.toolbar}><p>{report?`${date(report.from)} – ${date(report.to)}`:'The latest completed Monday–Sunday week, compared with the week before.'}</p><button type="button" className={s.primary} disabled={pending||!teamId} onClick={()=>generate()}>{pending?<RefreshCw className={s.spin} size={17}/>:<FileText size={17}/>} {pending?'Preparing insights…':isDemo?'Preview sample report':'Generate latest weekly report'}</button></div>
 {error&&<p role="alert" className={s.error}>{error}</p>}
 <section className={s.history} aria-label="Weekly report history">
 <div className={s.historyHeading}><div><h2>Weekly report history</h2><p>Choose a week to explore its takeaway, next steps, and supporting evidence.</p></div>{history?.key===requestKey&&<span className={s.count}>{history.items.length} reports</span>}</div>
 {historyError?<p role="status" className={s.historyMessage}>{historyError}</p>:!isDemo&&history?.key!==requestKey?<p role="status" className={s.historyMessage}>Loading saved reports…</p>:historyItems.length?<div className={s.historyList}>{[...historyItems].sort((a,b)=>b.to.localeCompare(a.to)).map((item,index)=><button className={s.historyCard} type="button" key={item.to} disabled={pending} aria-pressed={report?.to===item.to} onClick={()=>generate(item.to)}>
 <span className={s.cardTop}><span className={s.eyebrow}>{activeRole==='coach'?'Coach report':'Trainer report'}</span>{index===0&&<span className={s.latest}>Latest week</span>}</span>
 <strong className={s.cardDate}>{date(item.from)} – {date(item.to)}</strong>
 <span className={s.cardYear}>{item.to.slice(0,4)} · {isDemo?'Sample weekly summary':'Weekly summary'}</span>
 <span className={s.cardBottom}><span>{item.mode==='ai'?'Insights & next steps':'Supporting evidence'}</span><span className={s.openAction}>{report?.to===item.to?'Viewing report':'Open report'}<ArrowRight size={17} aria-hidden="true"/></span></span>
 </button>)}</div>:<p className={s.historyMessage}>No weekly reports yet. Generate your first report above.</p>}
 </section>
 {pending&&<p className={s.loading} role="status">Preparing your team report…</p>}
 {report&&<div aria-busy={pending} className={s.report}><section className={s.takeaway}><p className={s.eyebrow}>{isDemo?'Sample weekly takeaway':report.mode==='ai'?'Weekly takeaway':'Weekly evidence'}</p><h2>{report.takeaway}</h2>{!isDemo&&report.mode==='ai'&&<p className={s.note}>AI-assisted interpretation. Review the supporting evidence when planning next steps.</p>}</section>
 <div className={s.insights}>{report.insights.map((insight,i)=><article className={s.insight} key={`${i}-${insight.title}`}><span className={s.number}>{String(i+1).padStart(2,'0')}</span><div><h2>{insight.title}</h2><p>{insight.meaning}</p><div className={s.action}><ArrowRight size={18} aria-hidden="true"/><p>{insight.action}</p></div><div className={s.links}>{insight.evidenceIds.map(id=>{const fact=report.facts.find(f=>f.id===id);return fact?<a href={`#report-fact-${id}`} key={id}>{fact.label}</a>:null;})}</div></div></article>)}</div>
 {activeRole==='coach'&&report.spotlight.length>0&&<section className={s.spotlight}><p className={s.eyebrow}>Consistency spotlight</p><h2>Showing up for the work.</h2><p>Recognizing athletes who showed up. Based on completion of scheduled check-ins and assigned skill training, not how they answered.</p><div className={s.leaders}>{report.spotlight.map((athlete,i)=><div key={`${athlete.name}-${i}`}><span className={s.medal}>{athlete.rank}</span><strong>{athlete.name}</strong><span>{value(athlete.rate,'%')} completion</span></div>)}</div></section>}
 <section className={s.evidence}><h2>The supporting evidence</h2><div className={s.factGrid}>{report.facts.map(f=><Evidence key={f.id} fact={f}/>)}</div></section>
 {report.limitations.length>0&&<details className={s.limitations}><summary>How to read this report</summary><ul>{report.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul></details>}
 </div>}

 </section>;
}
