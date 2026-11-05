import React, { useEffect, useRef, useState } from 'react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
type Pending = { id: string; displayName: string; status: string };
export default function PendingAthleteRoster({teamId}:{teamId:string}) {
 const request=useRef(0);
 const [claimsEnabled,setClaimsEnabled]=useState(false);
 const [athletes,setAthletes]=useState<Pending[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function load(){const current=++request.current;setAthletes([]);setClaimsEnabled(false);setLoading(true);setError('');try{
  const token=await auth.currentUser?.getIdToken();if(!token)throw Error('Sign in to view pending athletes.');
  const response=await fetch(`/api/coach/pending-athletes?teamId=${encodeURIComponent(teamId)}`,{cache:'no-store',headers:{Authorization:`Bearer ${token}`,...getFirebaseModeRequestHeaders()}});
  const body=await response.json();if(!response.ok)throw Error(body.error||'Pending athletes are unavailable.');if(current===request.current){setAthletes(body.athletes);setClaimsEnabled(body.claimsEnabled===true);}
 }catch(e){if(current===request.current){setAthletes([]);setError((e as Error).message);}}finally{if(current===request.current)setLoading(false);}}
 useEffect(()=>{void load();return()=>{request.current++;};},[teamId]);
 return <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3" aria-label="Pending athletes"><h2 className="text-lg font-semibold">Pending athletes</h2><p className="text-sm text-stone-600">{claimsEnabled?'These roster entries are waiting for account ownership and enrollment checks. They do not count toward participation or receive messages.':'These roster entries are prepared. Athlete sign-in claims are not open yet. They do not count toward participation or receive messages.'}</p>{loading?<p role="status">Loading pending athletes…</p>:error?<p role="alert">{error}</p>:!athletes.length?<p>No pending athletes for this team.</p>:<ul className="divide-y divide-stone-100">{athletes.map(a=><li key={a.id} className="flex justify-between gap-3 py-3"><span>{a.displayName}</span><span className="text-sm text-stone-600">{a.status==='review-required'?'Identity review required':a.status==='claimed'?(claimsEnabled?'Ownership confirmed; enrollment pending':'Ownership confirmed; enrollment paused'):(claimsEnabled?'Account claim pending':'Prepared; sign-in not open')}</span></li>)}</ul>}<button type="button" disabled={loading} onClick={()=>void load()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Refresh pending athletes</button></section>;
}
