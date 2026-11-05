import React, { useEffect, useRef, useState } from 'react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';

import { parsePreparationFile, type Entry } from '../../lib/pending-athletes/import';
export default function PendingRosterPreparation({teamId,onPrepared}:{teamId:string;onPrepared:()=>void}) {
 const [entries,setEntries]=useState<Entry[]>([]),[error,setError]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const currentTeam=useRef(teamId); currentTeam.current=teamId;
 useEffect(()=>{setEntries([]);setError('');setStatus('');},[teamId]);
 async function prepare(){
  const selectedTeam=teamId, selected=entries.slice(); if(busy||!selected.length)return;
  if(selected.some(row=>row.teamId!==selectedTeam)){setError('Choose the reviewed file again for this team.');return;}
  setBusy(true);setError('');setStatus('Checking team access…');
  try {
   const user=auth.currentUser;if(!user)throw Error('Sign in to prepare roster entries.');
   const headers={Authorization:`Bearer ${await user.getIdToken()}`,...getFirebaseModeRequestHeaders()};
   const endpoint=`/api/coach/pending-athletes?teamId=${encodeURIComponent(selectedTeam)}`;
   const before=await fetch(endpoint,{headers,cache:'no-store'});const access=await before.json();
   if(!before.ok||!access.canPrepare)throw Error(access.error||'Your team role cannot prepare roster entries.');
   if(access.claimsEnabled)throw Error('Sign-in claims are open. Review the roster workflow before preparing this file.');
   let count=0;
   for(const row of selected){
    if(currentTeam.current!==selectedTeam||auth.currentUser?.uid!==user.uid)throw Error('Team or signed-in account changed. Preparation stopped.');
    const response=await fetch(endpoint,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(row.input)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Preparation stopped. Review this roster entry.');
    count++;setStatus(`Prepared ${count} of ${selected.length} entries.`);
   }
   const check=await fetch(endpoint,{headers,cache:'no-store'});const result=await check.json();
   if(!check.ok||result.claimsEnabled)throw Error('Preparation finished. Review the roster status before continuing.');
   setStatus(`${selected.length} roster entries prepared. Account sign-in remains closed.`);setEntries([]);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);onPrepared();}
 }
 return <details className="border-t border-stone-200 pt-3"><summary className="cursor-pointer text-sm font-medium">Prepare reviewed roster entries</summary><div className="mt-3 space-y-3 text-sm">
  <p>Import a reviewed identity file for this team. Preparation adds pending roster entries. Account creation, personal agreements and messages are separate steps.</p>
  <label className="block">Reviewed roster file<input className="mt-2 block max-w-full" type="file" accept="application/json,.json" disabled={busy} onChange={async e=>{const selectedTeam=teamId;const file=e.target.files?.[0];setEntries([]);setError('');setStatus('');if(!file)return;try{if(file.size>50000)throw Error('Choose a roster file smaller than 50 KB.');const parsed=parsePreparationFile(await file.text(),selectedTeam);if(currentTeam.current===selectedTeam)setEntries(parsed);}catch(err){setError((err as Error).message);}e.target.value='';}} /></label>
  {!!entries.length&&<><p>{entries.length} entries for the selected team:</p><ul className="list-disc pl-5">{entries.map(row=><li key={row.input.sourceReference}>{row.input.displayName}</li>)}</ul><button className="rounded-lg border px-3 py-2 font-medium disabled:opacity-50" type="button" disabled={busy} onClick={()=>void prepare()}>{busy?'Preparing…':`Prepare ${entries.length} roster entries`}</button></>}
  {!!status&&<p role="status">{status}</p>}{!!error&&<p role="alert" className="text-red-800">{error}</p>}
 </div></details>;
}
