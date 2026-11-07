import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import type { User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import { simpBudgetDb } from '../../api/firebase/simpBudgetConfig';
import { Account, Rule, StatementImport, StatementTransaction, parseCsv, mapCsv, applySuggestions, markDuplicates, validateTransaction, actualTotals } from '../../lib/simpbudget/statements';

type Space = { id: string; name: string };
const field = 'rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-sky-200';
const button = 'rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-stone-100';
const primary = 'rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-40';
const categories = ['Groceries', 'Dining', 'Shopping', 'Travel', 'Housing', 'Utilities', 'Health', 'Business services', 'Supplies & materials', 'Other'];
const kindLabels = { expense: 'Expense', refund: 'Refund', transfer: 'Transfer', card_payment: 'Card payment', income: 'Income' };
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const uid = () => crypto.randomUUID();

export default function StatementWorkspace({ user, spaces, year, month }: { user: User; spaces: Space[]; year: number; month: number }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'upload'|'review'|'history'>('upload');
  const [showSorted, setShowSorted] = useState(false);
  const [editing, setEditing] = useState<string|null>(null);
  const [undoStack, setUndoStack] = useState<StatementTransaction[][]>([]);
  const [dragOver, setDragOver] = useState('');
  const dragged = useRef<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [imports, setImports] = useState<StatementImport[]>([]);
  const importsRef = useRef<StatementImport[]>([]);
  const [accountId, setAccountId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'bank'|'card'>('bank');
  const defaultSpace = '';
  const [guidance, setGuidance] = useState('');
  const [ruleText, setRuleText] = useState('');
  const [ruleSpace, setRuleSpace] = useState('');
  const [active, setActive] = useState<StatementImport|null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ file: File; rows: string[][]; fingerprint: string }|null>(null);
  const [mapping, setMapping] = useState({ date: 0, description: 1, amount: 2, debit: -1, credit: -1 });
  const [positiveExpenses, setPositiveExpenses] = useState(true);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileDragOver, setFileDragOver] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const file=stagedFiles[previewIndex];
    if(!file || /\.csv$/i.test(file.name)) {setPreviewUrl('');return;}
    const url=URL.createObjectURL(file);setPreviewUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[stagedFiles,previewIndex]);
  const root = (key: string) => collection(simpBudgetDb, 'simpbudget-users', user.uid, key);
  useEffect(() => {
    let live = true;
    setReady(false);
    Promise.all(['statementAccounts','statementRules','statementImports'].map(key => getDocs(collection(simpBudgetDb,'simpbudget-users',user.uid,key)))).then(([a,r,i]) => {
      if (!live) return;
      setAccounts(a.docs.map(d=>d.data() as Account)); setRules(r.docs.map(d=>d.data() as Rule));
      importsRef.current=i.docs.map(d=>d.data() as StatementImport); setImports(importsRef.current); setReady(true);
    }).catch(()=> { if(live) setMessage('Unable to load statements. Reload before importing.'); });
    return ()=> { live=false; };
  }, [user.uid]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if(active?.status==='review') {event.preventDefault(); event.returnValue='';} };
    window.addEventListener('beforeunload',handler); return ()=>window.removeEventListener('beforeunload',handler);
  },[active]);
  const run = async (fn:()=>Promise<void>) => {
    if(lock.current) return; lock.current=true; setBusy(true); setMessage('');
    try { await fn(); } catch(error) { setMessage(error instanceof Error ? error.message : 'Unable to save. Your review remains open; retry when connected.'); }
    finally { lock.current=false; setBusy(false); }
  };
  const persist = async (value: StatementImport, expectedStatus?: StatementImport['status']) => {
    if(JSON.stringify(value).length>650000) throw new Error('This statement is too large. Split the file into smaller statements.');
    const ref = doc(root('statementImports'),value.id);
    const next = {...value,revision:(value.revision||0)+1};
    await runTransaction(simpBudgetDb, async tx=> {
      const current = await tx.get(ref);
      if(current.exists() && expectedStatus && current.data().status!==expectedStatus) throw new Error('This import changed in another tab. Reload to see its current status.');
      if(current.exists() && (current.data().revision||0)!==(value.revision||0)) throw new Error('This review changed in another tab. Reload before editing to avoid overwriting it.');
      tx.set(ref,clean(next));
    });
    importsRef.current=[...importsRef.current.filter(i=>i.id!==value.id),next]; setImports(importsRef.current); setActive(next);
  };
  const startReview = async (file:File, fingerprint:string, transactions:StatementTransaction[], extra:Partial<StatementImport>={}) => {
    const account=accounts.find(a=>a.id===accountId); if(!account) throw new Error('Choose an account first.');
    if(!transactions.length) throw new Error('No transactions were extracted. Check the file and try a CSV export.');
    if(transactions.length>500) throw new Error('Limit each statement to 500 transactions. Split this file and retry.');
    const suggested=applySuggestions(transactions,account,rules,spaces,guidance);
    const value=markDuplicates(importsRef.current,{...extra,id:uid(), accountId, fileName:file.name, fingerprint,guidance,createdAt:new Date().toISOString(),status:'review',transactions:suggested,warnings:extra.warnings||[]});
    if(importsRef.current.some(i=>i.fingerprint===fingerprint&&i.accountId===accountId&&i.status!=='undone')) value.warnings.push('This exact file was previously uploaded for this account. Check duplicates before committing.');
    await persist(value); setPending(null); setStagedFiles([]); setSelected([]); setView('review'); setShowSorted(false); setEditing(null); setUndoStack([]); setMessage('');
  };
  const stageFiles = (files:File[]) => run(async()=>{
    if(!files.length)return;
    if(files.some(f=>/\.csv$/i.test(f.name))&&files.length>1)throw new Error('Choose one CSV at a time.');
    for(const file of files){
      if(file.size>4*1024*1024)throw new Error(`${file.name}: maximum file size is 4 MB.`);
      if(!/\.csv$/i.test(file.name)&&!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose CSV, PDF, PNG, JPEG or WebP.');
    }
    const file=files[0];
    if(/\.csv$/i.test(file.name)){
      const rows=parseCsv(await file.text());if(rows.length<2)throw new Error('CSV needs a header and transaction rows.');
      const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
      setPending({file,rows,fingerprint});
    }else setPending(null);
    setStagedFiles(files);setPreviewIndex(0);
  });
  const upload = (files: File[]) => run(async()=> {
    if(files.filter(f=>/\.csv$/i.test(f.name)).length && files.length>1) throw new Error('Upload one CSV at a time so each file can be mapped. Multiple PDFs/images are supported.');
    if(!ready || !accountId) throw new Error('Choose an account before uploading.');
    if(active?.status==='review') await persist(active,'review');
    for(const file of files) {
      if(file.size>4*1024*1024) throw new Error(`${file.name}: maximum file size is 4 MB.`);
      const bytes=await file.arrayBuffer();
      const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      if(/\.csv$/i.test(file.name)) {
        const rows=parseCsv(await file.text()); if(rows.length<2) throw new Error('CSV needs a header and transaction rows.');
        setPending({file,rows,fingerprint}); setMessage('Map CSV columns below. Upload one CSV at a time; PDFs and images can be selected together.'); break;
      }
      if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Choose CSV, PDF, PNG, JPEG or WebP.');
      const dataBase64=await new Promise<string>((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]); reader.onerror=reject; reader.readAsDataURL(file); });
      const response=await fetch('/.netlify/functions/simpbudget-parse-statement',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`},body:JSON.stringify({fileName:file.name,mimeType:file.type,dataBase64,guidance,spaces})});
      const result=await response.json(); if(!response.ok) throw new Error(result.error||'Statement parsing failed. Try a CSV export.');
      if(!result.transactions?.length) throw new Error((result.warnings||[]).join(' ')||'No transactions were extracted. Try a clearer scan or CSV.');
      const rows=(result.transactions||[]).map((t:Partial<StatementTransaction>,index:number)=>({...t,id:uid(),spaceId:'',reviewed:false,excluded:false,duplicate:false,splits:[],sourceRow:t.sourceRow||index+1,reason:t.reason||'Review extracted transaction.'}));
      await startReview(file,fingerprint,rows,{openingBalance:result.openingBalance,closingBalance:result.closingBalance,statementTotal:result.statementTotal,warnings:result.warnings||[]});
    }
  });
  const updateRows = (rows: StatementTransaction[]) => {
    if (!active || active.status !== 'review') return;
    setUndoStack(stack=>[...stack.slice(-49),active.transactions]);
    setActive({...active,transactions:rows});
  };
  const change = (id:string, patch:Partial<StatementTransaction>) => {
    if(active) updateRows(active.transactions.map(t=>t.id===id?{...t,...patch}:t));
  };
  const assign = (spaceId:string, ids=selected) => {
    if(!active || !ids.length || busy) return;
    updateRows(active.transactions.map(t=>ids.includes(t.id)?{...t,spaceId,splits:[],excluded:false,reviewed:true}:t));
    setSelected([]); setEditing(null); setMessage(`${ids.length} transaction${ids.length===1?'':'s'} moved to ${spaces.find(s=>s.id===spaceId)?.name}.`);
  };
  const undoSort = () => {
    if(!active || !undoStack.length) return;
    setActive({...active,transactions:undoStack[undoStack.length-1]}); setUndoStack(stack=>stack.slice(0,-1));
    setSelected([]); setShowSorted(false); setMessage('Last change undone. The transaction is back in the list.');
  };
  const close = () => { if(!busy) void run(async()=>{ if(active?.status==='review') await persist(active,'review'); setOpen(false); }); };
  const totals=actualTotals(imports.map(i=>({...i,transactions:i.transactions.filter(t=>t.date.startsWith(`${year}-${String(month).padStart(2,'0')}`))})));
  const options=<><option value="">Needs a bucket</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</>;
  const commit = () => run(async()=>{
    if(!active) return;
    for(const t of active.transactions) { const error=validateTransaction(t); if(error) throw new Error(`Row ${t.sourceRow}: ${error}`); }
    await persist({...active,status:'committed'},'review'); setMessage('Committed to actual spending. Planned budgets were not changed.');
  });
  const remaining = active?.transactions.filter(t=>!!validateTransaction(t)) || [];
  const sorted = active?.transactions.filter(t=>!validateTransaction(t)) || [];
  const visibleRows = active?.status==='review' ? (showSorted ? sorted : remaining) : active?.transactions || [];
  const draftTotals = active ? actualTotals([{...active,status:'committed'}]) : {};
  const openUpload = () => {setView('upload');setMessage('');setOpen(true);};
  const categoryValue = (t:StatementTransaction) => ['transfer','card_payment','income'].includes(t.kind) ? t.kind : t.category || '';
  const selectCategory = (t:StatementTransaction, value:string) => {
    const special = ['transfer','card_payment','income'].includes(value);
    change(t.id,{category:special?undefined:value,kind:special?value as StatementTransaction['kind']:(t.amount<0?'refund':'expense'),reviewed:special || t.reviewed});
    if(special) setMessage(`${kindLabels[value as keyof typeof kindLabels]} set aside from spending. Use Undo last sort to bring it back.`);
  };
  const openImport = (item:StatementImport) => void run(async()=>{
    if(active?.id!==item.id) {
      if(active?.status==='review') await persist(active,'review');
      setActive(item);setUndoStack([]);
    }
    setView('review');setShowSorted(false);setSelected([]);setEditing(null);
  });
  return <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-xl font-semibold text-stone-950">Actual spending</h2><p className="mt-1 text-sm text-stone-600">Sort statement transactions into your budgets.</p></div>
      <div className="flex items-center gap-3"><button className="px-2 py-2 text-sm font-medium text-stone-600 hover:text-stone-950" onClick={()=>{setView('history');setOpen(true);setMessage('');}}>Import history</button><button className={primary} onClick={openUpload}>Import statement</button></div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{spaces.map(s=><div key={s.id} className="rounded-xl bg-stone-50 px-4 py-3"><span className="text-sm text-stone-600">{s.name}</span><p className="mt-1 text-2xl font-semibold text-stone-950">{money(totals[s.id]||0)}</p></div>)}</div>
    <p className="mt-3 text-xs text-stone-500">{new Date(year,month-1).toLocaleString('en-US',{month:'long',year:'numeric'})} · Imported spending. Your planned budgets stay separate.</p>
    <Dialog open={open} onClose={close} className="relative z-[70]">
      <div className="fixed inset-0 bg-stone-950/45 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-6">
        <DialogPanel className={`flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${view==='review'?'max-w-6xl':view==='upload'&&stagedFiles.length?'max-w-4xl':'max-w-xl'}`}>
          <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-5 sm:px-7">
            <div>
              <DialogTitle className="text-xl font-semibold text-stone-950">{view==='upload'?'Import a statement':view==='history'?'Import history':active?.status==='review'?'Sort your transactions':active?.status==='undone'?'Import undone':'Import complete'}</DialogTitle>
              <Description className="mt-1 text-sm text-stone-600">{view==='upload'?'Preview your document, add a prompt, then analyze.':view==='history'?'Continue a review or revisit a finished import.':active?.status==='review'?'Drag a row to a budget, or select rows and click a budget below.':active?.status==='undone'?'These transactions no longer count toward your spending.':'Your transactions have been added to actual spending.'}</Description>
            </div>
            <button aria-label="Close statement modal" disabled={busy} onClick={close} className="rounded-lg px-3 py-1 text-2xl text-stone-500 hover:bg-stone-100 disabled:opacity-40">×</button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {view==='upload'&&<div className="space-y-5 p-5 sm:p-7">
              <fieldset disabled={busy||!ready} className={stagedFiles.length?"grid gap-5 md:grid-cols-2":"space-y-5"}>
                <div onDragOver={e=>{e.preventDefault();if(!busy)setFileDragOver(true);}} onDragLeave={()=>setFileDragOver(false)} onDrop={e=>{e.preventDefault();setFileDragOver(false);if(!busy)void stageFiles(Array.from(e.dataTransfer.files));}} className={`md:col-span-2 rounded-xl border-2 border-dashed text-center ${stagedFiles.length?'flex items-center justify-between gap-3 px-4 py-3':'p-5'} ${fileDragOver?'border-sky-600 bg-sky-50':'border-stone-300 bg-stone-50'}`}>
                  <p className="text-base font-semibold text-stone-900">{stagedFiles.length?`${stagedFiles.length} statement${stagedFiles.length===1?'':'s'} ready to preview`:'Drag your statement here'}</p>{!stagedFiles.length&&<p className="mt-1 text-sm text-stone-500">PDF, screenshot or CSV · Up to 4 MB per file</p>}
                  <button type="button" className={`${button} ${stagedFiles.length?'':'mt-4'} bg-white`} onClick={()=>uploadInput.current?.click()}>Browse files</button><input ref={uploadInput} className="sr-only" type="file" accept=".csv,.pdf,image/png,image/jpeg,image/webp" multiple aria-label="Upload statements" onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';void stageFiles(files);}}/>
                </div>
                {stagedFiles.length>0&&<>
                  <div className="overflow-hidden rounded-xl border border-stone-200">
                    <div className="flex items-center justify-between gap-2 bg-stone-50 px-4 py-2"><span className="truncate text-sm font-medium">{stagedFiles[previewIndex]?.name}</span><span className="whitespace-nowrap text-xs text-stone-500">Local preview</span></div>
                    {stagedFiles.length>1&&<div className="flex flex-wrap gap-2 p-2">{stagedFiles.map((file,i)=><button type="button" key={i} className="rounded border px-2 py-1 text-xs" onClick={()=>setPreviewIndex(i)}>{file.name}</button>)}</div>}
                    {previewUrl&&(stagedFiles[previewIndex]?.type==='application/pdf'?<object data={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`} type="application/pdf" aria-label="Statement PDF preview" className="h-80 w-full"><p className="p-4 text-sm">Your browser cannot show this PDF inline. <a href={previewUrl} target="_blank" rel="noreferrer" className="underline">Open the local preview</a>.</p></object>:<img src={previewUrl} alt="Statement preview" className="max-h-80 w-full object-contain"/>)}
                    {pending&&<div className="overflow-x-auto p-3"><table className="w-full text-left text-xs"><tbody>{pending.rows.slice(0,5).map((r,i)=><tr key={i}>{r.map((cell,j)=><td className="border-b border-stone-100 px-2 py-2" key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}
                  </div>
                  <div className="space-y-4"><label className="block text-sm font-medium text-stone-800">What should we look out for?<textarea className={`${field} mt-2 w-full font-normal`} maxLength={2000} rows={3} aria-label="Upload guidance" placeholder="Home Depot purchases this month likely belong to TresProperties. Anything else to consider?" value={guidance} onChange={e=>setGuidance(e.target.value)}/><span className="mt-1 block text-xs font-normal text-stone-500">Optional. Your prompt helps suggest where transactions belong.</span></label>
                  <label className="block text-sm font-medium text-stone-800">Which account is this from?<select className={`${field} mt-2 w-full`} aria-label="Statement account" value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Choose an account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.type==='card'?'Credit card':'Bank'})</option>)}</select></label>
                  <details open={!accounts.length} className="rounded-xl border border-stone-200 p-3"><summary className="cursor-pointer text-sm font-medium">Add an account</summary><div className="mt-3 grid gap-3"><input className={field} placeholder="e.g. Chase checking" aria-label="Account nickname" value={name} onChange={e=>setName(e.target.value)}/><select className={field} aria-label="Account type" value={type} onChange={e=>setType(e.target.value as 'bank'|'card')}><option value="bank">Bank</option><option value="card">Credit card</option></select><button className={button} onClick={()=>run(async()=>{if(!name.trim())throw new Error('Enter an account nickname.');const a:Account={id:uid(),name:name.trim(),type,defaultSpaceId:defaultSpace};await setDoc(doc(root('statementAccounts'),a.id),a);setAccounts(v=>[...v,a]);setAccountId(a.id);setName('');})}>Add account</button></div></details>
                  {pending&&<details className="rounded-lg bg-stone-50 p-3" open><summary className="cursor-pointer text-sm font-medium">Match CSV columns</summary><div className="mt-3 grid grid-cols-2 gap-3">{(['date','description','amount','debit','credit'] as const).map(key=><label key={key} className="text-sm capitalize">{key}<select className={`${field} mt-1 block w-full`} value={mapping[key]} onChange={e=>setMapping({...mapping,[key]:Number(e.target.value)})}><option value={-1}>Not used</option>{pending.rows[0].map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>)}</div><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={positiveExpenses} onChange={e=>setPositiveExpenses(e.target.checked)}/> Positive amounts are spending</label><p className="mt-2 text-xs text-stone-500">Use amount or separate debit and credit columns. Dates: YYYY-MM-DD or MM/DD/YYYY.</p></details>}
                  <p className="text-xs leading-relaxed text-stone-500">{pending?'CSV analysis stays on your device.':'Analyze sends the document and your prompt to OpenAI. Original files are not stored by SimpBudget.'} You will review every transaction before finishing the import.</p></div>
                </>}
              </fieldset>
              <details className="text-sm"><summary className="cursor-pointer text-stone-500">Account defaults & merchant rules</summary><div className="mt-3 space-y-3">{accounts.map(a=><label key={a.id} className="block">{a.name}<select className={`${field} mt-1 w-full`} disabled={busy} value={a.defaultSpaceId} onChange={e=>{const value={...a,defaultSpaceId:e.target.value};void run(async()=>{await setDoc(doc(root('statementAccounts'),a.id),value);setAccounts(all=>all.map(x=>x.id===a.id?value:x));});}}>{options}</select></label>)}<input className={`${field} w-full`} aria-label="Merchant contains" placeholder="Merchant name" value={ruleText} onChange={e=>setRuleText(e.target.value)}/><select className={`${field} w-full`} value={ruleSpace} aria-label="Rule bucket" onChange={e=>setRuleSpace(e.target.value)}>{options}</select><button className={button} disabled={busy} onClick={()=>run(async()=>{if(!ruleText.trim()||!ruleSpace)throw new Error('Choose a merchant and budget.');const r:Rule={id:uid(),contains:ruleText.trim(),spaceId:ruleSpace};await setDoc(doc(root('statementRules'),r.id),r);setRules(all=>[...all,r]);setRuleText('');})}>Save permanent rule</button>{rules.map(r=><p key={r.id}>{r.contains} → {spaces.find(s=>s.id===r.spaceId)?.name||'Unavailable budget'} <button className="ml-2 underline" disabled={busy} onClick={()=>run(async()=>{await deleteDoc(doc(root('statementRules'),r.id));setRules(all=>all.filter(x=>x.id!==r.id));})}>Remove rule</button></p>)}</div></details>
            </div>}
            {view==='history'&&<div className="space-y-2 p-5 sm:p-7">{!imports.length?<p className="py-8 text-center text-stone-500">Your imported statements will appear here.</p>:[...imports].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(i=><button className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 p-4 text-left hover:bg-stone-50" disabled={busy} key={i.id} onClick={()=>openImport(i)}><span><span className="block font-medium">{i.fileName}</span><span className="mt-1 block text-xs text-stone-500">{accounts.find(a=>a.id===i.accountId)?.name} · {i.transactions.length} transactions</span></span><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium">{i.status==='review'?'Continue sorting':i.status==='undone'?'Undone':'Complete'}</span></button>)}</div>}
            {view==='review'&&active&&<>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-3 sm:px-7">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{active.fileName}</p><p className="text-xs text-stone-500">{accounts.find(a=>a.id===active.accountId)?.name} · {active.transactions.length} transactions</p></div>
                {active.status==='review'&&<div className="flex items-center gap-3"><span className="text-sm font-semibold">{remaining.length} left</span><button className="text-sm text-stone-600 underline underline-offset-4" onClick={()=>{setShowSorted(!showSorted);setSelected([]);setEditing(null);}}>{showSorted?'Back to unsorted':`View sorted (${sorted.length})`}</button><button className={button} disabled={busy||!undoStack.length} onClick={undoSort}>Undo last sort</button></div>}
              </div>
              {active.warnings.length>0&&<details className="mx-5 mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><summary className="cursor-pointer font-medium">Statement checks ({active.warnings.length})</summary>{active.warnings.map((w,i)=><p className="mt-2" key={i}>{w}</p>)}</details>}
              {active.status==='review'&&visibleRows.length>0&&<div className="flex items-center gap-3 px-5 py-3 sm:px-7"><button className="text-sm font-medium underline underline-offset-4" disabled={busy} onClick={()=>setSelected(visibleRows.map(t=>t.id))}>Select all</button>{selected.length>0&&<><span className="text-sm text-stone-500">{selected.length} selected</span><button className="text-sm underline underline-offset-4" onClick={()=>setSelected([])}>Clear selection</button><button className="ml-auto text-sm text-stone-600 underline underline-offset-4" disabled={busy} onClick={()=>{updateRows(active.transactions.map(t=>selected.includes(t.id)?{...t,excluded:true,reviewed:true}:t));setSelected([]);setMessage('Selected transactions set aside. Use Undo last sort to bring them back.');}}>Exclude selected</button></>}</div>}
              {!visibleRows.length?<div className="px-6 py-16 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-2xl">✓</div><h3 className="text-lg font-semibold">{showSorted?'Nothing sorted yet':'All transactions sorted'}</h3><p className="mt-2 text-sm text-stone-500">{showSorted?'Return to the list and choose a budget.':'Check your totals below, then finish the import.'}</p></div>:<div className="overflow-x-auto px-3 pb-4 sm:px-5"><table className="w-full min-w-[700px] border-collapse text-sm"><thead><tr className="border-b border-stone-200 text-left text-xs text-stone-500"><th className="w-9 p-2"><span className="sr-only">Select</span></th><th className="p-2 font-medium">Date</th><th className="p-2 font-medium">Transaction</th><th className="p-2 text-right font-medium">Amount</th><th className="p-2 font-medium">Category</th>{(showSorted||active.status!=='review')&&<th className="p-2 font-medium">Budget</th>}<th className="w-12 p-2"><span className="sr-only">Edit</span></th></tr></thead><tbody>{visibleRows.map(t=><React.Fragment key={t.id}>
                <tr draggable={!busy&&active.status==='review'} onDragStart={event=>{if(active.status!=='review')return;const ids=selected.includes(t.id)?selected:[t.id];dragged.current=ids;setSelected(ids);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',t.id);}} onDragEnd={()=>{dragged.current=[];setDragOver('');}} className={`border-b border-stone-100 ${active.status==='review'?'cursor-grab active:cursor-grabbing':''} ${selected.includes(t.id)?'bg-sky-50':'hover:bg-stone-50'}`}>
                  <td className="p-2">{active.status==='review'&&<input className="h-4 w-4 accent-stone-900" aria-label={`Select row ${t.sourceRow}`} type="checkbox" disabled={busy} checked={selected.includes(t.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,t.id]:s.filter(id=>id!==t.id))}/>}</td>
                  <td className="whitespace-nowrap p-2 text-stone-500">{t.date}</td><td className="max-w-xs p-2"><span className="block font-medium text-stone-900">{t.description}</span>{t.duplicate&&<span className="mt-1 block text-xs text-amber-800">Possible duplicate. Check before sorting.</span>}{t.suggestedSpaceId&&!t.reviewed&&<span className="mt-1 block text-xs text-stone-500">Suggested: {spaces.find(s=>s.id===t.suggestedSpaceId)?.name}</span>}</td>
                  <td className="whitespace-nowrap p-2 text-right font-medium tabular-nums">{money(t.amount)}</td><td className="p-2">{active.status==='review'?<select className={`${field} w-44`} aria-label={`Category row ${t.sourceRow}`} disabled={busy} value={categoryValue(t)} onChange={e=>selectCategory(t,e.target.value)}><option value="">Choose category</option>{categories.map(c=><option key={c}>{c}</option>)}<optgroup label="Outside spending"><option value="transfer">Transfer</option><option value="card_payment">Card payment</option><option value="income">Income</option></optgroup></select>:<span className="text-stone-600">{t.category||kindLabels[t.kind]}</span>}</td>
                  {(showSorted||active.status!=='review')&&<td className="p-2 text-stone-600">{t.excluded?'Excluded':t.splits.length?t.splits.map(s=>`${spaces.find(b=>b.id===s.spaceId)?.name}: ${money(s.amount)}`).join(' / '):spaces.find(s=>s.id===t.spaceId)?.name||kindLabels[t.kind]}</td>}
                  <td className="p-2">{active.status==='review'&&<button className="rounded-lg px-2 py-2 text-stone-500 hover:bg-stone-100" aria-label={`Edit row ${t.sourceRow}`} onClick={()=>setEditing(editing===t.id?null:t.id)}>{editing===t.id?'Close':'Edit'}</button>}</td>
                </tr>
                {editing===t.id&&active.status==='review'&&<tr><td colSpan={showSorted?7:6} className="bg-stone-50 p-4"><fieldset disabled={busy} className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-stone-600">Date<input className={`${field} mt-1 block w-full`} type="date" aria-label={`Date row ${t.sourceRow}`} value={t.date} onChange={e=>change(t.id,{date:e.target.value,reviewed:false})}/></label><label className="text-xs text-stone-600">Description<input className={`${field} mt-1 block w-full`} aria-label={`Description row ${t.sourceRow}`} value={t.description} onChange={e=>change(t.id,{description:e.target.value,reviewed:false})}/></label><label className="text-xs text-stone-600">Amount<input className={`${field} mt-1 block w-full`} aria-label={`Amount row ${t.sourceRow}`} type="number" step="0.01" value={t.amount} onChange={e=>change(t.id,{amount:Number(e.target.value),reviewed:false})}/></label></div><div className="flex flex-wrap items-center gap-3"><select className={field} aria-label={`Kind row ${t.sourceRow}`} value={t.kind} onChange={e=>change(t.id,{kind:e.target.value as StatementTransaction['kind'],reviewed:false})}>{Object.entries(kindLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select className={field} aria-label={`Bucket row ${t.sourceRow}`} value={t.spaceId} onChange={e=>assign(e.target.value,[t.id])}>{options}</select><button className={button} onClick={()=>change(t.id,{splits:t.splits.length?[]:[{spaceId:spaces[0]?.id||'',amount:t.amount},{spaceId:spaces[1]?.id||'',amount:0}],reviewed:false})}>{t.splits.length?'Remove split':'Split transaction'}</button><button className="text-sm underline" onClick={()=>{change(t.id,{excluded:true,reviewed:true});setEditing(null);}}>Exclude transaction</button></div>
                  {t.splits.length>0&&<><p className="text-xs text-stone-600">Split amounts must total {money(t.amount)}.</p><div className="flex flex-wrap gap-2">{t.splits.map((split,index)=><div className="flex gap-1" key={index}><select className={field} aria-label={`Split ${index+1} bucket row ${t.sourceRow}`} value={split.spaceId} onChange={e=>change(t.id,{splits:t.splits.map((s,j)=>j===index?{...s,spaceId:e.target.value}:s),reviewed:false})}>{options}</select><input className={`${field} w-28`} aria-label={`Split ${index+1} amount row ${t.sourceRow}`} type="number" step="0.01" value={split.amount} onChange={e=>change(t.id,{splits:t.splits.map((s,j)=>j===index?{...s,amount:Number(e.target.value)}:s),reviewed:false})}/></div>)}<button className={button} onClick={()=>change(t.id,{splits:[...t.splits,{spaceId:'',amount:0}],reviewed:false})}>Add split</button><button className={primary} onClick={()=>{const next={...t,reviewed:true};const error=validateTransaction(next);if(error){setMessage(error);return;}change(t.id,{reviewed:true});setEditing(null);}}>Confirm split</button></div></>}
                  <p className="text-xs text-stone-500">Source row {t.sourceRow} · {t.reason}</p>
                </fieldset></td></tr>}
              </React.Fragment>)}</tbody></table></div>}
              <details className="mx-5 mb-4 text-xs text-stone-500"><summary className="cursor-pointer">Statement details & totals</summary><p className="mt-2">Extracted net: {money(active.transactions.reduce((n,t)=>n+t.amount,0))}{active.statementTotal!=null&&<> · Printed net: {money(active.statementTotal)} · Difference: {money(active.transactions.reduce((n,t)=>n+t.amount,0)-active.statementTotal)}</>}</p>{active.guidance&&<p className="mt-2">Upload guidance: {active.guidance}</p>}{active.status==='review'&&<fieldset disabled={busy} className="mt-3 flex flex-wrap gap-3">{(['openingBalance','closingBalance','statementTotal'] as const).map(key=><label key={key}>{key==='openingBalance'?'Opening balance':key==='closingBalance'?'Closing balance':'Printed net transactions'}<input className={`${field} mt-1 block w-36`} aria-label={key} type="number" step="0.01" value={active[key]??''} onChange={e=>setActive({...active,[key]:e.target.value===''?undefined:Number(e.target.value)})}/></label>)}</fieldset>}</details>
            </>}
          </div>
          {(busy||message)&&<p role="status" className="border-t border-stone-100 bg-stone-50 px-5 py-3 text-sm text-stone-700">{busy?'Saving or reading your statement…':message}</p>}
          {view==='upload'&&stagedFiles.length>0&&<footer className="flex items-center justify-between gap-3 border-t border-stone-200 px-5 py-4"><span className="text-xs text-stone-500">Ready to analyze {stagedFiles.length} file{stagedFiles.length===1?'':'s'}.</span><button className={primary} disabled={busy||!ready||!accountId} onClick={()=>pending?void run(async()=>{if(active?.status==='review')await persist(active,'review');await startReview(pending.file,pending.fingerprint,mapCsv(pending.rows.slice(1),{date:mapping.date,description:mapping.description,...(mapping.amount>=0?{amount:mapping.amount}:{...(mapping.debit>=0?{debit:mapping.debit}:{}),...(mapping.credit>=0?{credit:mapping.credit}:{})})},{positiveExpenses}));}):void upload(stagedFiles)}>Analyze</button></footer>}
          {view==='review'&&active&&<footer className="border-t border-stone-200 bg-white px-5 py-4 sm:px-7">
            {active.status==='review'&&<><div className="mb-3 flex items-center justify-between text-xs text-stone-500"><span>{selected.length?`${selected.length} selected. Click a budget to move them.`:'Drop transactions into a budget below.'}</span><span>Sorted transactions leave the list.</span></div><div className="grid grid-cols-3 gap-2 sm:gap-3">{spaces.map(s=><button key={s.id} aria-label={`Assign to ${s.name}`} disabled={busy} onClick={()=>assign(s.id)} onDragOver={e=>{if(dragged.current.length){e.preventDefault();e.dataTransfer.dropEffect='move';setDragOver(s.id);}}} onDragLeave={()=>setDragOver('')} onDrop={e=>{e.preventDefault();assign(s.id,dragged.current);dragged.current=[];setDragOver('');}} className={`flex min-h-24 flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition-colors ${dragOver===s.id?'border-sky-700 bg-sky-100':selected.length?'border-stone-400 bg-stone-50 hover:border-stone-900 hover:bg-stone-100':'border-stone-200 bg-stone-50'}`}><span className="text-sm font-semibold text-stone-900">{s.name}</span><span className="mt-1 text-lg font-semibold tabular-nums text-stone-900">{money(draftTotals[s.id]||0)}</span><span className="mt-1 text-xs text-stone-500">{selected.length?'Move here':'This statement'}</span></button>)}</div></>}
            <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-stone-500">{active.status==='review'?'Spending updates when you finish.':'Your planned budgets are unchanged.'}</span><div className="flex gap-2">{active.status==='review'?<><button className={button} disabled={busy} onClick={()=>run(async()=>{await persist(active,'review');setMessage('Review saved. You can return to it from Import history.');})}>Save for later</button><button className={primary} disabled={busy||remaining.length>0} onClick={commit}>Finish import</button></>:<>{active.status==='committed'&&<button className={button} disabled={busy} onClick={()=>run(async()=>{await persist({...active,status:'undone'},'committed');setMessage('Import undone. Its actual spending is excluded; history is retained.');})}>Undo import</button>}<button className={primary} onClick={close}>Done</button></>}</div></div>
          </footer>}
        </DialogPanel>
      </div>
    </Dialog>
  </section>;
}
