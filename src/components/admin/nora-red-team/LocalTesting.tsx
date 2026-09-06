import React, { useEffect, useState } from 'react';
import ChatSimulation from './ChatSimulation';
import styles from './NoraTesting.module.css';
import local from './LocalTesting.module.css';
export default function LocalTesting() {
 const [tab,setTab]=useState<'chat'|'storage'>('chat');
 const [ready,setReady]=useState(false), [error,setError]=useState(''), [report,setReport]=useState<any>(null), [checking,setChecking]=useState(false);

 async function request(path:string, body:unknown) {

   const response=await fetch(`/api/admin/pulsecheck/nora-red-team/${path}`,{method:'POST',headers:{'Content-Type':'application/json','x-pulsecheck-firebase-mode':'dev'},body:JSON.stringify(body)});
   const data=await response.json(); if(!response.ok)throw new Error(data.error || 'Request failed');return data;
 }
 useEffect(()=>{ let active=true; void (async()=>{
   const response=await fetch('/api/admin/pulsecheck/nora-red-team/local-session',{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error);
   if(data.projectId!=='quicklifts-dev-01')throw new Error('Development project required.');
   if(active)setReady(true);
 })().catch(e=>{if(active)setError(e.message)});return()=>{active=false};},[]);
 return <div className={styles.root}>
 <header className={styles.top}><a className={styles.brand} href="/admin/noraRedTeam">pulse <span>/ Nora Testing</span></a><nav aria-label="Local Nora testing"><button className={tab==='chat'?styles.active:''} aria-current={tab==='chat'?'page':undefined} onClick={()=>setTab('chat')}>Chat Simulation</button><button className={tab==='storage'?styles.active:''} aria-current={tab==='storage'?'page':undefined} onClick={()=>setTab('storage')}>Firebase Checks</button></nav><span className={styles.environment}>Local development</span></header>
 <main className={styles.main}>
 <div className={styles.heading}><div><span className={styles.eyebrow}>Nora testing workspace</span><h1>{tab==='chat'?'Try a conversation':'Check saved data'}</h1><p>{tab==='chat'?'Talk naturally. See what helps, and what needs work.':'Verify storage and access in development Firebase.'}</p></div><span className={local.status}>{ready?'● Test account connected':'Connecting test account…'}</span></div>
 {error&&<p role="alert" className={local.error}>{error}</p>}
 {!ready?<div className={local.card}><p>Preparing your testing workspace…</p></div>:<>
 <div hidden={tab!=='chat'}><ChatSimulation enableActions retryReview={(messages,reply)=>request('chat-simulation',{messages,reply,syntheticOnly:true,reviewOnly:true})} send={messages=>request('chat-simulation',{messages,syntheticOnly:true})}/></div>
 {tab==='storage'&&<section className={local.card}><div className={local.cardHeader}><div><h2>Firebase integration</h2><p>Check a synthetic record from save through cleanup.</p></div><button disabled={checking} onClick={async()=>{setChecking(true);setError('');try{setReport(await request('local-storage-check',{}))}catch(e){setError((e as Error).message)}finally{setChecking(false)}}}>{checking?'Checking…':'Run Firebase check'}</button></div>{report?<><p className={local.status}>{report.verdict}</p><div className={local.checks}>{report.checks.map((c:any)=><div key={c.name}><span>{c.name}</span><strong>{c.passed?'Pass':'Needs attention'}</strong></div>)}</div><p className={local.note}>{report.scope}</p></>:<div className={local.empty}>Run a check to see saving, reading, permissions, and cleanup results here.</div>}</section>}
 </>}
 </main></div>;
}
