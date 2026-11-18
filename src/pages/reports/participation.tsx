import React from 'react';
import Head from 'next/head';
import type { GetServerSideProps } from 'next';
export default function Participation({report}:{report:{subject:string;contentHtml:string}|null}){
 return <><Head><title>{report?.subject||'Team participation report'}</title><meta name="robots" content="noindex,nofollow"/><meta name="referrer" content="no-referrer"/></Head><main style={{minHeight:'100vh',background:'#f4f1eb',padding:'32px 16px',color:'#222',fontFamily:'Arial,sans-serif'}}><article style={{maxWidth:720,margin:'auto',background:'#fff',padding:32,borderRadius:16,lineHeight:1.7}}>{report?<div dangerouslySetInnerHTML={{__html:report.contentHtml}}/>:<><h1>This report link is unavailable</h1><p>The link may have expired or access may have changed. Ask your report sender for a new link.</p></>}</article></main></>;
}
export const getServerSideProps:GetServerSideProps=async context=>{
 context.res.setHeader('Cache-Control','private, no-store, max-age=0');context.res.setHeader('Referrer-Policy','no-referrer');context.res.setHeader('X-Robots-Tag','noindex, nofollow');
 try{const {getFirebaseAdminApp}=await import('../../lib/firebase-admin');const {readLinkedReport}=await import('../../lib/coach-dashboard/reportLinks');return {props:{report:await readLinkedReport(getFirebaseAdminApp(false).firestore(),String(context.query.token||''))}};}catch{context.res.statusCode=404;return {props:{report:null}};}
};
