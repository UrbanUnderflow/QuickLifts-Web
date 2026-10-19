import React,{useEffect,useState} from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {auth,getFirebaseModeRequestHeaders} from '../../api/firebase/config';
import {useUser,useUserLoading} from '../../hooks/useUser';
export default function ParticipationReport(){
 const router=useRouter(),user=useUser(),loading=useUserLoading();const [report,setReport]=useState<{subject:string;contentHtml:string;teamId:string}|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(!router.isReady||loading||!user?.id)return;const abort=new AbortController();
  void(async()=>{try{setReport(null);setError('');const token=await auth.currentUser?.getIdToken();const r=await fetch(`/api/coach/participation-report?id=${encodeURIComponent(String(router.query.id||''))}`,{headers:{Authorization:`Bearer ${token}`,...getFirebaseModeRequestHeaders()},signal:abort.signal});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to open report.');setReport(data);}catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Unable to open report.');}})();return()=>abort.abort();
 },[router.isReady,router.query.id,user?.id,loading]);
 return <><Head><title>{report?.subject||'Team participation report'}</title><meta name="robots" content="noindex,nofollow"/></Head><main style={{minHeight:'100vh',background:'#f4f1eb',padding:'32px 16px',color:'#222',fontFamily:'Arial,sans-serif'}}><article style={{maxWidth:720,margin:'auto',background:'#fff',padding:32,borderRadius:16,lineHeight:1.7}}>{!loading&&!user?.id?<><h1>Sign in to open your report</h1><p>Use the team account that received this email.</p><Link href={`/coach/login?redirect=${encodeURIComponent(router.asPath)}`}>Sign in</Link></>:error?<p role="alert">{error}</p>:report?<div className="participation-report-content" dangerouslySetInnerHTML={{__html:report.contentHtml}}/>:<p>Loading your report…</p>}<p><Link href={report?`/coach/dashboard?teamId=${report.teamId}&view=home`:'/coach/dashboard'}>Open team dashboard</Link></p></article></main><style jsx global>{`.participation-report-content h1 {font-size:28px;font-weight:700;line-height:1.25;margin:16px 0}.participation-report-content h2 {font-size:23px;font-weight:700;line-height:1.35;margin:24px 0 12px}.participation-report-content h3 {font-size:19px;font-weight:700;margin:24px 0 10px}.participation-report-content p {margin:12px 0}.participation-report-content table {font-size:15px}`}</style></>;
}
