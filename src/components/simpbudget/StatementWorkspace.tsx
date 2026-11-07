import SortingQuestions from './SortingQuestions';
import {applySortingDecisions} from '../../lib/simpbudget/sortingQuestions';
import TransactionDetails, { type TransactionDetail } from './TransactionDetails';
import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';
import type { User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import { simpBudgetDb } from '../../api/firebase/simpBudgetConfig';
import { Account, Rule, StatementImport, StatementTransaction, parseCsv, mapCsv, applySuggestions, markDuplicates, validateTransaction, actualTotals, withStatementSource, combineStatementImports, splitStatementBatch, parseChaseCsv, isChaseCsv, parseStatementAmount } from '../../lib/simpbudget/statements';

type StatementDocument = { statementId: string; role: 'original'|'import'; fileName: string; mimeType: string; size: number; sha256: string };
type Space = { id: string; name: string };
const field = 'rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 focus:ring-2 focus:ring-sky-200';
const button = 'rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-stone-100';
const primary = 'rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-40';
const categories = ['Groceries', 'Dining', 'Shopping', 'Travel', 'Housing', 'Utilities', 'Health', 'Business services', 'Supplies & materials', 'Other'];
const kindLabels = { expense: 'Expense', refund: 'Refund', transfer: 'Transfer', card_payment: 'Card payment', income: 'Income' };
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const uid = () => crypto.randomUUID();

export default function StatementWorkspace({ user, spaces, year, month, dateRange, onImportsChange, statementRequest }: { user: User; spaces: Space[]; year: number; month: number; dateRange?: {start:string;end:string;label:string}; onImportsChange?: (imports:StatementImport[])=>void; statementRequest?: {id:string;sequence:number}|null }) {
  const [transactionDetail,setTransactionDetail]=useState<TransactionDetail|null>(null);
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
  useEffect(()=>{onImportsChange?.(imports);},[imports,onImportsChange]);
  const handledStatementRequest=useRef<number|null>(null);
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
  const [fileAccounts, setFileAccounts] = useState<Record<number,string>>({});
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [suggestionFilter,setSuggestionFilter]=useState('');
  const [sourceFilter,setSourceFilter]=useState('');
  const [kindFilter,setKindFilter]=useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [csvPreview,setCsvPreview]=useState<string[][]>([]);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [documents,setDocuments]=useState<Record<string,StatementDocument>>({});
  const [attachments,setAttachments]=useState<{file:File;statementId:string}[]>([]);
  const [documentPreview,setDocumentPreview]=useState<{url:string;name:string;mime:string}|null>(null);
  const attachmentInput=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{if(documentPreview)URL.revokeObjectURL(documentPreview.url);},[documentPreview]);
  const documentRequest=async(body:unknown)=>{
    const response=await fetch('/.netlify/functions/simpbudget-statement-document',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`},body:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to access statement document.');return result;
  };
  const rememberDocuments=(items:StatementDocument[])=>setDocuments(current=>{const next={...current};for(const item of items){if(item.role==='original'||next[item.statementId]?.role!=='original')next[item.statementId]=item;}return next;});
  const archiveFile=async(statementId:string,file:File,role:'original'|'import'='original')=>{
    const dataBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
    const result=await documentRequest({action:'attach',statementId,role,fileName:file.name,mimeType:/\.csv$/i.test(file.name)?'text/csv':file.type,dataBase64});rememberDocuments([result.document]);
  };
  const loadDocument=async(item:StatementDocument)=>{
    const result=await documentRequest({action:'read',statementId:item.statementId,role:item.role});
    const bytes=Uint8Array.from(atob(result.dataBase64),(c:string)=>c.charCodeAt(0));
    setDocumentPreview({url:URL.createObjectURL(new Blob([bytes],{type:result.document.mimeType})),name:result.document.fileName,mime:result.document.mimeType});
  };
  const viewDocument=(item:StatementDocument)=>void run(()=>loadDocument(item));
  const uploadInput = useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const file=stagedFiles[previewIndex];
    setCsvPreview([]);
    if(!file){setPreviewUrl('');return;}
    if(/\.csv$/i.test(file.name)) {
      setPreviewUrl('');let live=true;
      void file.text().then(text=>{if(live){try{setCsvPreview(parseCsv(text).slice(0,5));}catch{setCsvPreview([]);}}});
      return ()=>{live=false;};
    }
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
    const members=splitStatementBatch(value);
    if(members.some(m=>new TextEncoder().encode(JSON.stringify(m)).length>650000)) throw new Error('A statement is too large. Split it into smaller files.');
    const next=members.map(m=>({...m,revision:(m.revision||0)+1}));
    await runTransaction(simpBudgetDb, async tx=> {
      const refs=members.map(m=>doc(root('statementImports'),m.id));
      const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
      snapshots.forEach((current,index)=>{
        if(current.exists() && expectedStatus && current.data().status!==expectedStatus) throw new Error('This import changed in another tab. Reload to see its current status.');
        if(current.exists() && (current.data().revision||0)!==(members[index].revision||0)) throw new Error('This review changed in another tab. Reload before editing to avoid overwriting it.');
      });
      next.forEach((m,index)=>tx.set(refs[index],clean(m)));
    });
    const ids=new Set(next.map(m=>m.id));
    importsRef.current=[...importsRef.current.filter(i=>!ids.has(i.id)),...next]; setImports(importsRef.current); setActive(combineStatementImports(next));
  };
  const stageFiles = (files:File[]) => run(async()=>{
    if(!files.length)return;
    if(files.length>40)throw new Error('Choose up to 40 statements per batch.');
    for(const file of files){
      if(file.size>4*1024*1024)throw new Error(`${file.name}: maximum file size is 4 MB.`);
      if(!/\.csv$/i.test(file.name)&&!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose CSV, PDF, PNG, JPEG or WebP.');
    }
    const file=files[0];
    if(/\.csv$/i.test(file.name)){
      const rows=parseCsv(await file.text());if(rows.length<2)throw new Error('CSV needs a header and transaction rows.');
      setPending({file,rows,fingerprint:''});
    }else setPending(null);
    setStagedFiles(files);setPreviewIndex(0);
    const inferred:Record<number,string>={};
    files.forEach((f,index)=>{const matches=accounts.filter(a=>{const last4=a.type==='card'?a.name.match(/(?:[•*]\s*|ending\s+)(\d{4})\b/i)?.[1]:undefined;return last4&&f.name.includes(last4);});if(matches.length===1)inferred[index]=matches[0].id;});
    setFileAccounts(inferred);
  });
  const upload = (files: File[]) => run(async()=> {
    if(!ready || files.some((_,index)=>!accounts.some(a=>a.id===(fileAccounts[index]||accountId)))) throw new Error('Choose a source account for every file.');
    if(active?.status==='review') await persist(active,'review');
    const batchId=uid(); const batch:StatementImport[]=[];
    try {
      for(const [index,file] of files.entries()) {
        setAnalysisProgress(`Analyzing ${index+1} of ${files.length}: ${file.name}`);
        const account=accounts.find(a=>a.id===(fileAccounts[index]||accountId))!;
        const bytes=await file.arrayBuffer();
        const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
        let transactions:StatementTransaction[]; let extra:Partial<StatementImport>={};
        if(/\.csv$/i.test(file.name)) {
          const rows=parseCsv(await file.text());
          const chase=parseChaseCsv(rows,spaces);
          if(chase) {
            transactions=chase;
            const netColumn=rows[0].findIndex(h=>h.trim().toLowerCase()==='statement net');
            if(netColumn>=0&&rows[1]?.[netColumn])extra.statementTotal=parseStatementAmount(rows[1][netColumn]);
          }
          else {
            if(files.length>1 && (!pending || JSON.stringify(rows[0])!==JSON.stringify(pending.rows[0]))) throw new Error(`${file.name}: CSV headers differ. Use matching columns or upload this CSV separately.`);
            transactions=mapCsv(rows.slice(1),{date:mapping.date,description:mapping.description,...(mapping.amount>=0?{amount:mapping.amount}:{...(mapping.debit>=0?{debit:mapping.debit}:{}),...(mapping.credit>=0?{credit:mapping.credit}:{})})},{positiveExpenses});
          }
        } else {
          const dataBase64=await new Promise<string>((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]); reader.onerror=reject; reader.readAsDataURL(file); });
          const response=await fetch('/.netlify/functions/simpbudget-parse-statement',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`},body:JSON.stringify({fileName:file.name,mimeType:file.type,dataBase64,guidance,spaces})});
          const result=await response.json(); if(!response.ok) throw new Error(`${file.name}: ${result.error||'Statement parsing failed. Try a CSV export.'}`);
          transactions=(result.transactions||[]).map((t:Partial<StatementTransaction>,i:number)=>({...t,id:uid(),spaceId:'',reviewed:false,excluded:false,duplicate:false,splits:[],sourceRow:t.sourceRow||i+1,reason:t.reason||'Review extracted transaction.'}));
          extra={openingBalance:result.openingBalance,closingBalance:result.closingBalance,statementTotal:result.statementTotal,warnings:result.warnings||[]};
        }
        if(!transactions.length)throw new Error(`${file.name}: No transactions found. Nothing in this batch was imported.`);
        if(transactions.length>2000)throw new Error(`${file.name}: Limit each file to 2,000 transactions.`);
        const value=withStatementSource({...extra,id:uid(),batchId,accountId:account.id,fileName:file.name,fingerprint,guidance,createdAt:new Date().toISOString(),status:'review',warnings:extra.warnings||[],transactions:applySuggestions(transactions.map(t=>({...t,id:uid()})),account,rules,spaces,guidance)},account.name);
        const checked=markDuplicates([...importsRef.current,...batch],value);
        if([...importsRef.current,...batch].some(i=>i.accountId===account.id&&i.fingerprint===fingerprint&&i.status!=='undone')) checked.warnings.push('This exact file was previously uploaded for this account. Check duplicates before committing.');
        batch.push(checked);
      }
      await persist(combineStatementImports(batch));
      // The review is durable before archival; a failed archive remains retryable without importing again.
      setView('review');setAttachments([]);
      for(const [index,item] of batch.entries()){setAnalysisProgress(`Saving document ${index+1} of ${batch.length}`);await archiveFile(item.id,files[index],/\.csv$/i.test(files[index].name)?'import':'original');}
      setPending(null);setStagedFiles([]);setSelected([]);setSuggestionFilter('');setSourceFilter('');setKindFilter('');setView('review');setShowSorted(false);setEditing(null);setUndoStack([]);setMessage('');
    } finally {setAnalysisProgress('');}
  });
  const updateRows = (rows: StatementTransaction[]) => {
    if (!active || active.status !== 'review') return;
    setUndoStack(stack=>[...stack.slice(-49),active.transactions]);
    setActive({...active,transactions:rows});
  };
  const change = (id:string, patch:Partial<StatementTransaction>) => {
    if(active) updateRows(active.transactions.map(t=>t.id===id?{...t,...patch}:t));
    if(patch.reviewed===false) setShowSorted(false);
  };
  const assign = (spaceId:string, ids=selected) => {
    if(!active || !ids.length || busy) return;
    updateRows(active.transactions.map(t=>ids.includes(t.id)?{...t,spaceId,splits:[],excluded:false,reviewed:true}:t));
    setSelected([]); setEditing(null); setMessage(`${ids.length} transaction${ids.length===1?'':'s'} moved to ${spaces.find(s=>s.id===spaceId)?.name}.`);
  };
  const undoSort = () => {
    if(!active || !undoStack.length) return;
    setActive({...active,transactions:undoStack[undoStack.length-1]}); setUndoStack(stack=>stack.slice(0,-1));
    setSelected([]); setShowSorted(false); setSuggestionFilter('');setSourceFilter('');setKindFilter(''); setMessage('Last change undone. The transaction is back in the list.');
  };
  const close = () => { if(!busy) void run(async()=>{ if(active?.status==='review') await persist(active,'review'); setOpen(false); }); };
  const totals=actualTotals(imports.map(i=>({...i,transactions:i.transactions.filter(t=>dateRange ? t.date>=dateRange.start&&t.date<=dateRange.end : t.date.startsWith(`${year}-${String(month).padStart(2,'0')}`))})));
  const options=<><option value="">Needs a bucket</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</>;
  const commit = () => run(async()=>{
    if(!active) return;
    for(const t of active.transactions) { const error=validateTransaction(t); if(error) throw new Error(`Row ${t.sourceRow}: ${error}`); }
    await persist({...active,status:'committed'},'review'); setMessage('Committed to actual spending. Planned budgets were not changed.');
  });
  const remaining = active?.transactions.filter(t=>!!validateTransaction(t)) || [];
  const sorted = active?.transactions.filter(t=>!validateTransaction(t)) || [];
  const visibleRows = (active?.status==='review' ? (showSorted ? sorted : remaining) : active?.transactions || []).filter(t=>(!suggestionFilter || (suggestionFilter==='none'?!t.suggestedSpaceId:t.suggestedSpaceId===suggestionFilter))&&(!sourceFilter || (t.sourceAccountId||active?.accountId)===sourceFilter)&&(!kindFilter||t.kind===kindFilter));
  const draftTotals = active ? actualTotals([{...active,status:'committed'}]) : {};
  const historyItems=imports.filter((item,index,all)=>!item.batchId || all.findIndex(i=>i.batchId===item.batchId)===index).map(item=>item.batchId?combineStatementImports(imports.filter(i=>i.batchId===item.batchId)):item);
  const openUpload = () => {setDocumentPreview(null);setView('upload');setMessage('');setOpen(true);};
  const rowLabel=(t:StatementTransaction)=>active?.members?`${t.sourceAccountName}, ${t.sourceFileName}, ${t.sourceRow}`:String(t.sourceRow);
  const categoryValue = (t:StatementTransaction) => ['transfer','card_payment','income'].includes(t.kind) ? t.kind : t.category || '';
  const selectCategory = (t:StatementTransaction, value:string) => {
    const special = ['transfer','card_payment','income'].includes(value);
    change(t.id,{category:special?undefined:value,kind:special?value as StatementTransaction['kind']:(t.amount<0?'refund':'expense'),reviewed:special || t.reviewed});
    if(special) setMessage(`${kindLabels[value as keyof typeof kindLabels]} set aside from spending. Use Undo last sort to bring it back.`);
  };
  const openImport = (item:StatementImport, previewId?:string) => void run(async()=>{
    if(active?.id!==item.id) {
      if(active?.status==='review') await persist(active,'review');
      setActive(item);setUndoStack([]);
    }
    setOpen(true);setView('review');setShowSorted(false);setSelected([]);setEditing(null);setSuggestionFilter('');setSourceFilter('');setKindFilter('');setAttachments([]);setDocumentPreview(null);
    const result=await documentRequest({action:'list',ids:(item.members||[item]).map(m=>m.id)});rememberDocuments(result.documents);
    if(previewId){const attached=result.documents.find((d:StatementDocument)=>d.statementId===previewId&&d.role==='original')||result.documents.find((d:StatementDocument)=>d.statementId===previewId);if(attached)await loadDocument(attached);else setMessage('Original not attached yet. Use Statement documents to attach it to these existing transactions.');}
  });
  useEffect(()=>{
    if(!ready||!statementRequest||handledStatementRequest.current===statementRequest.sequence)return;
    const member=imports.find(i=>i.id===statementRequest.id);if(!member)return;
    handledStatementRequest.current=statementRequest.sequence;
    openImport(member.batchId?combineStatementImports(imports.filter(i=>i.batchId===member.batchId)):member,member.id);
    // A request is handled once; import changes alone must not reopen the modal.
  },[ready,statementRequest,imports]);
  return <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-xl font-semibold text-stone-950">Actual spending</h2><p className="mt-1 text-sm text-stone-600">Sort statement transactions into your budgets.</p></div>
      <div className="flex items-center gap-3"><button className="px-2 py-2 text-sm font-medium text-stone-600 hover:text-stone-950" onClick={()=>{setView('history');setOpen(true);setMessage('');}}>Import history</button><button className={primary} onClick={openUpload}>Import statement</button></div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{spaces.map(s=><div key={s.id} className="rounded-xl bg-stone-50 px-4 py-3"><span className="text-sm text-stone-600">{s.name}</span><p className="mt-1 text-2xl font-semibold text-stone-950">{money(totals[s.id]||0)}</p></div>)}</div>
    <p className="mt-3 text-xs text-stone-500">{dateRange?.label||new Date(year,month-1).toLocaleString('en-US',{month:'long',year:'numeric'})} · Imported spending. Your planned budgets stay separate.</p>
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
                    {csvPreview.length>0&&<div className="overflow-x-auto p-3"><table className="w-full text-left text-xs"><tbody>{csvPreview.map((r,i)=><tr key={i}>{r.map((cell,j)=><td className="border-b border-stone-100 px-2 py-2" key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}
                  </div>
                  <div className="space-y-4">{stagedFiles.length>1&&<div className="space-y-2"><p className="text-sm font-medium">Source card for each statement</p>{stagedFiles.map((file,index)=><label key={index} className="block text-xs text-stone-600">{file.name}<select className={`${field} mt-1 block w-full`} aria-label={`Source account for ${file.name}`} value={fileAccounts[index]||accountId} onChange={e=>setFileAccounts(current=>({...current,[index]:e.target.value}))}><option value="">Choose source account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>)}</div>}<label className="block text-sm font-medium text-stone-800">What should we look out for?<textarea className={`${field} mt-2 w-full font-normal`} maxLength={2000} rows={3} aria-label="Upload guidance" placeholder="Home Depot purchases this month likely belong to TresProperties. Anything else to consider?" value={guidance} onChange={e=>setGuidance(e.target.value)}/><span className="mt-1 block text-xs font-normal text-stone-500">Optional. Your prompt helps suggest where transactions belong.</span></label>
                  <label className="block text-sm font-medium text-stone-800">Which account is this from?<select className={`${field} mt-2 w-full`} aria-label="Statement account" value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Choose an account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.type==='card'?'Credit card':'Bank'})</option>)}</select></label>
                  <details open={!accounts.length} className="rounded-xl border border-stone-200 p-3"><summary className="cursor-pointer text-sm font-medium">Add an account</summary><div className="mt-3 grid gap-3"><input className={field} placeholder="e.g. Chase checking" aria-label="Account nickname" value={name} onChange={e=>setName(e.target.value)}/><select className={field} aria-label="Account type" value={type} onChange={e=>setType(e.target.value as 'bank'|'card')}><option value="bank">Bank</option><option value="card">Credit card</option></select><button className={button} onClick={()=>run(async()=>{if(!name.trim())throw new Error('Enter an account nickname.');const a:Account={id:uid(),name:name.trim(),type,defaultSpaceId:defaultSpace};await setDoc(doc(root('statementAccounts'),a.id),a);setAccounts(v=>[...v,a]);setAccountId(a.id);setName('');})}>Add account</button></div></details>
                  {pending&&!isChaseCsv(pending.rows)&&<details className="rounded-lg bg-stone-50 p-3" open><summary className="cursor-pointer text-sm font-medium">Match CSV columns</summary><div className="mt-3 grid grid-cols-2 gap-3">{(['date','description','amount','debit','credit'] as const).map(key=><label key={key} className="text-sm capitalize">{key}<select className={`${field} mt-1 block w-full`} value={mapping[key]} onChange={e=>setMapping({...mapping,[key]:Number(e.target.value)})}><option value={-1}>Not used</option>{pending.rows[0].map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>)}</div><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={positiveExpenses} onChange={e=>setPositiveExpenses(e.target.checked)}/> Positive amounts are spending</label><p className="mt-2 text-xs text-stone-500">Use amount or separate debit and credit columns. Dates: YYYY-MM-DD or MM/DD/YYYY.</p></details>}
                  <p className="text-xs leading-relaxed text-stone-500">{stagedFiles.every(f=>/\.csv$/i.test(f.name))?'CSV analysis stays on your device. Chase exports are recognized automatically, including payment types and spending signs.':'Analyze sends PDFs/images and your prompt to OpenAI. CSV files stay on your device. Original files are saved privately with your imported transactions.'} Uploaded CSVs are also saved for reference. You will review every transaction before finishing the import.</p></div>
                </>}
              </fieldset>
              <details className="text-sm"><summary className="cursor-pointer text-stone-500">Account defaults & merchant rules</summary><div className="mt-3 space-y-3">{accounts.map(a=><label key={a.id} className="block">{a.name}<select className={`${field} mt-1 w-full`} disabled={busy} value={a.defaultSpaceId} onChange={e=>{const value={...a,defaultSpaceId:e.target.value};void run(async()=>{await setDoc(doc(root('statementAccounts'),a.id),value);setAccounts(all=>all.map(x=>x.id===a.id?value:x));});}}>{options}</select></label>)}<input className={`${field} w-full`} aria-label="Merchant contains" placeholder="Merchant name" value={ruleText} onChange={e=>setRuleText(e.target.value)}/><select className={`${field} w-full`} value={ruleSpace} aria-label="Rule bucket" onChange={e=>setRuleSpace(e.target.value)}>{options}</select><button className={button} disabled={busy} onClick={()=>run(async()=>{if(!ruleText.trim()||!ruleSpace)throw new Error('Choose a merchant and budget.');const r:Rule={id:uid(),contains:ruleText.trim(),spaceId:ruleSpace};await setDoc(doc(root('statementRules'),r.id),r);setRules(all=>[...all,r]);setRuleText('');})}>Save permanent rule</button>{rules.map(r=><p key={r.id}>{r.contains} → {spaces.find(s=>s.id===r.spaceId)?.name||'Unavailable budget'} <button className="ml-2 underline" disabled={busy} onClick={()=>run(async()=>{await deleteDoc(doc(root('statementRules'),r.id));setRules(all=>all.filter(x=>x.id!==r.id));})}>Remove rule</button></p>)}</div></details>
            </div>}
            {view==='history'&&<div className="space-y-2 p-5 sm:p-7">{!imports.length?<p className="py-8 text-center text-stone-500">Your imported statements will appear here.</p>:[...historyItems].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(i=><button className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 p-4 text-left hover:bg-stone-50" disabled={busy} key={i.id} onClick={()=>openImport(i)}><span><span className="block font-medium">{i.fileName}</span><span className="mt-1 block text-xs text-stone-500">{accounts.find(a=>a.id===i.accountId)?.name} · {i.transactions.length} transactions</span></span><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium">{i.status==='review'?'Continue sorting':i.status==='undone'?'Undone':'Complete'}</span></button>)}</div>}
            {view==='review'&&active&&<>
              <details className="mx-5 my-3 rounded-xl border border-stone-200 p-3"><summary className="cursor-pointer text-sm font-medium">Statement documents · {(active.members||[active]).filter(m=>documents[m.id]?.role==='original').length}/{(active.members||[active]).length} originals attached</summary>
                <p className="my-3 text-xs text-stone-500">Attach originals to existing transactions. Budgets, categories, splits and totals stay unchanged. Confirm each file matches its statement before attaching.</p>
                <button className={button} disabled={busy} onClick={()=>attachmentInput.current?.click()}>Attach original statements</button>
                <input ref={attachmentInput} type="file" multiple accept=".pdf,image/png,image/jpeg,image/webp,.csv" className="sr-only" aria-label="Attach original statements" onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(files.length>40||files.some(f=>f.size>4*1024*1024)){setMessage('Choose up to 40 files, each up to 4 MB.');return;}const stem=(name:string)=>name.toLowerCase().replace(/\.(pdf|csv|png|jpe?g|webp)$/,'');setAttachments(files.map(file=>{const matches=(active.members||[active]).filter(m=>[m.fileName,...m.transactions.map(t=>t.sourceFileName||'')].some(n=>stem(n)===stem(file.name)));return {file,statementId:matches.length===1?matches[0].id:''};}));}}/>
                {attachments.map((a,index)=><label key={index} className="my-3 block text-xs">{a.file.name}<select aria-label={`Statement for ${a.file.name}`} className={`${field} mt-1 w-full`} disabled={busy} value={a.statementId} onChange={e=>setAttachments(items=>items.map((v,i)=>i===index?{...v,statementId:e.target.value}:v))}><option value="">Choose matching statement</option>{(active.members||[active]).map(m=><option key={m.id} value={m.id}>{accounts.find(x=>x.id===m.accountId)?.name} · {m.fileName}</option>)}</select></label>)}
                {attachments.length>0&&<button className={`${primary} mt-2`} disabled={busy||attachments.some(a=>!a.statementId)||new Set(attachments.map(a=>a.statementId)).size!==attachments.length} onClick={()=>void run(async()=>{for(const a of attachments){setAnalysisProgress(`Attaching ${a.file.name}`);try{await archiveFile(a.statementId,a.file);}finally{setAnalysisProgress('');}}setAttachments([]);setMessage('Original statements attached. Existing transactions and sorting were not changed.');})}>Attach selected documents</button>}
                <ul className="mt-3 space-y-2">{(active.members||[active]).map(m=><li key={m.id} className="text-xs">{m.fileName} · {documents[m.id]?<button className="underline" disabled={busy} onClick={()=>viewDocument(documents[m.id])}>{documents[m.id].role==='original'?'View statement':'View imported CSV'}</button>:'Original not attached'}</li>)}</ul>
              </details>
              {documentPreview&&<div className="mx-5 mb-4 rounded-xl border border-stone-200 p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-medium">{documentPreview.name}</span><a className="text-sm underline" href={documentPreview.url} download={documentPreview.name}>Download</a><button className={button} onClick={()=>setDocumentPreview(null)}>Close document</button></div>{documentPreview.mime==='application/pdf'?<iframe title="Original statement preview" src={documentPreview.url} className="h-[60vh] w-full"/>:documentPreview.mime.startsWith('image/')?<img alt="Original statement" src={documentPreview.url} className="max-h-[60vh] w-full object-contain"/>:<p className="text-sm">CSV document saved. Use Download to open it.</p>}</div>}

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-3 sm:px-7">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{active.fileName}</p><p className="text-xs text-stone-500">{active.members?'Multiple source accounts':accounts.find(a=>a.id===active.accountId)?.name} · {active.transactions.length} transactions</p></div>
                {active.status==='review'&&<div className="flex items-center gap-3"><span className="text-sm font-semibold">{remaining.length} left</span><button className="text-sm text-stone-600 underline underline-offset-4" onClick={()=>{setShowSorted(!showSorted);setSelected([]);setEditing(null);}}>{showSorted?'Back to unsorted':`View sorted (${sorted.length})`}</button><button className={button} disabled={busy||!undoStack.length} onClick={undoSort}>Undo last sort</button></div>}
              </div>
              {active.status==='review'&&<details className="mx-5 mt-3 text-xs text-stone-500"><summary className="cursor-pointer">Correct source account</summary><label className="mt-2 block">Correct source for all statements in this review<select aria-label="Correct review source account" className={`${field} ml-2`} disabled={busy} value="" onChange={e=>{
                const account=accounts.find(a=>a.id===e.target.value);if(!account)return;
                const members=splitStatementBatch(active),ids=new Set(members.map(m=>m.id));const existing=imports.filter(i=>!ids.has(i.id));
                const corrected:StatementImport[]=[];
                for(const member of members){const value={...member,accountId:account.id,transactions:member.transactions.map(t=>({...t,sourceAccountId:account.id,sourceAccountName:account.name}))};const checked=markDuplicates([...existing,...corrected],value);checked.transactions=checked.transactions.map((t,index)=>t.duplicate&&!member.transactions[index].duplicate?{...t,reviewed:false}:t);corrected.push(checked);}
                setActive(combineStatementImports(corrected));setUndoStack([]);setSelected([]);setSourceFilter('');setMessage(`Source corrected to ${account.name}. Save review to keep this change.`);
              }}><option value="">Choose only if the source is incorrect</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></details>}
              {active.status==='review'&&<SortingQuestions key={active.id} rows={active.transactions} spaces={spaces} busy={busy} interpret={async(rows,answer,suggestedSpaceId)=>{
                if(lock.current)throw new Error('Wait for the current change to finish.');lock.current=true;setBusy(true);
                try{const response=await fetch('/.netlify/functions/simpbudget-sort-answer',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`},body:JSON.stringify({rows:rows.map(({id,description,date,amount,kind})=>({id,description,date,amount,kind})),answer,suggestedSpaceId,spaceIds:spaces.map(s=>s.id)})});
                const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to interpret your answer.');
                applySortingDecisions(rows,result.decisions,spaces,answer);return result;}finally{lock.current=false;setBusy(false);}
              }} onApply={(decisions,answer)=>{try{updateRows(applySortingDecisions(active.transactions,decisions,spaces,answer));setSelected([]);setMessage(`${decisions.length} transactions sorted from your answer. Use Undo last sort to reverse.`);}catch(error){setMessage(error instanceof Error?error.message:'Please review this group again.');}}}/>}
              <div className="flex flex-wrap gap-3 px-5 py-3"><label className="text-xs text-stone-500">Source<select aria-label="Filter source" className={`${field} ml-2`} value={sourceFilter} onChange={e=>{setSourceFilter(e.target.value);setSelected([]);}}><option value="">All cards</option>{accounts.filter(a=>active.transactions.some(t=>(t.sourceAccountId||active.accountId)===a.id)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="text-xs text-stone-500">Suggested budget<select aria-label="Filter suggested budget" className={`${field} ml-2`} value={suggestionFilter} onChange={e=>{setSuggestionFilter(e.target.value);setSelected([]);}}><option value="">All suggestions</option><option value="none">Needs a decision</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="text-xs text-stone-500">Type<select aria-label="Filter transaction type" className={`${field} ml-2`} value={kindFilter} onChange={e=>{setKindFilter(e.target.value);setSelected([]);}}><option value="">All types</option>{Object.entries(kindLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><span className="self-center text-xs text-stone-500">{visibleRows.length} shown</span></div>
              {active.warnings.length>0&&<details className="mx-5 mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><summary className="cursor-pointer font-medium">Statement checks ({active.warnings.length})</summary>{active.warnings.map((w,i)=><p className="mt-2" key={i}>{w}</p>)}</details>}
              {active.status==='review'&&visibleRows.length>0&&<div className="flex items-center gap-3 px-5 py-3 sm:px-7"><button className="text-sm font-medium underline underline-offset-4" disabled={busy} onClick={()=>setSelected(visibleRows.map(t=>t.id))}>Select all</button>{selected.length>0&&<><span className="text-sm text-stone-500">{selected.length} selected</span><button className="text-sm underline underline-offset-4" onClick={()=>setSelected([])}>Clear selection</button><button className="ml-auto text-sm text-stone-600 underline underline-offset-4" disabled={busy} onClick={()=>{updateRows(active.transactions.map(t=>selected.includes(t.id)?{...t,excluded:true,reviewed:true}:t));setSelected([]);setMessage('Selected transactions set aside. Use Undo last sort to bring them back.');}}>Exclude selected</button></>}</div>}
              {!visibleRows.length?<div className="px-6 py-16 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-2xl">✓</div><h3 className="text-lg font-semibold">{suggestionFilter||sourceFilter||kindFilter?'No transactions match these filters':showSorted?'Nothing sorted yet':'All transactions sorted'}</h3><p className="mt-2 text-sm text-stone-500">{suggestionFilter||sourceFilter||kindFilter?'Clear the filters to see the rest.':showSorted?'Return to the list and choose a budget.':'Check your totals below, then finish the import.'}</p></div>:<div className="overflow-x-auto px-3 pb-4 sm:px-5"><table className="w-full min-w-[700px] border-collapse text-sm"><thead><tr className="border-b border-stone-200 text-left text-xs text-stone-500"><th className="w-9 p-2"><span className="sr-only">Select</span></th><th className="p-2 font-medium">Date</th><th className="p-2 font-medium">Source</th><th className="p-2 font-medium">Transaction</th><th className="p-2 text-right font-medium">Amount</th><th className="p-2 font-medium">Category</th>{(showSorted||active.status!=='review')&&<th className="p-2 font-medium">Budget</th>}<th className="w-12 p-2"><span className="sr-only">Edit</span></th></tr></thead><tbody>{visibleRows.map(t=><React.Fragment key={t.id}>
                <tr draggable={!busy&&active.status==='review'} onDragStart={event=>{if(active.status!=='review')return;const ids=selected.includes(t.id)?selected:[t.id];dragged.current=ids;setSelected(ids);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',t.id);}} onDragEnd={()=>{dragged.current=[];setDragOver('');}} className={`border-b border-stone-100 ${active.status==='review'?'cursor-grab active:cursor-grabbing':''} ${selected.includes(t.id)?'bg-sky-50':'hover:bg-stone-50'}`}>
                  <td className="p-2">{active.status==='review'&&<input className="h-4 w-4 accent-stone-900" aria-label={`Select row ${rowLabel(t)}`} type="checkbox" disabled={busy} checked={selected.includes(t.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,t.id]:s.filter(id=>id!==t.id))}/>}</td>
                  <td className="whitespace-nowrap p-2 text-stone-500">{t.date}</td><td className="max-w-40 p-2 text-xs text-stone-500"><span className="block font-medium">{t.sourceAccountName||accounts.find(a=>a.id===active.accountId)?.name||'Unknown account'}</span><span className="mt-1 block truncate" title={t.sourceFileName||active.fileName}>{t.sourceFileName||active.fileName}</span>{documents[t.sourceImportId||active.id]&&<button className="mt-1 text-xs underline" disabled={busy} onClick={()=>viewDocument(documents[t.sourceImportId||active.id])}>{documents[t.sourceImportId||active.id].role==='original'?'View statement':'View imported CSV'}</button>}</td><td className="max-w-xs p-2"><span className="block font-medium text-stone-900">{t.description}</span>{t.duplicate&&<span className="mt-1 block text-xs text-amber-800">Possible duplicate. Check before sorting.</span>}{t.suggestedSpaceId&&!t.reviewed&&<span className="mt-1 block text-xs text-stone-500">Suggested: {spaces.find(s=>s.id===t.suggestedSpaceId)?.name}</span>}</td>
                  <td className="whitespace-nowrap p-2 text-right font-medium tabular-nums">{money(t.amount)}</td><td className="p-2">{active.status==='review'?<select className={`${field} w-44`} aria-label={`Category row ${rowLabel(t)}`} disabled={busy} value={categoryValue(t)} onChange={e=>selectCategory(t,e.target.value)}><option value="">Choose category</option>{t.category&&!categories.includes(t.category)&&<option>{t.category}</option>}{categories.map(c=><option key={c}>{c}</option>)}<optgroup label="Outside spending"><option value="transfer">Transfer</option><option value="card_payment">Card payment</option><option value="income">Income</option></optgroup></select>:<span className="text-stone-600">{t.category||kindLabels[t.kind]}</span>}</td>
                  {(showSorted||active.status!=='review')&&<td className="p-2 text-stone-600">{t.excluded?'Excluded':t.splits.length?t.splits.map(s=>`${spaces.find(b=>b.id===s.spaceId)?.name}: ${money(s.amount)}`).join(' / '):spaces.find(s=>s.id===t.spaceId)?.name||kindLabels[t.kind]}</td>}
                  <td className="p-2"><button className="text-xs underline" onClick={()=>setTransactionDetail({...t,sourceType:t.sourceType||(/\.(pdf|png|jpe?g|webp)$/i.test(t.sourceFileName||active.fileName)?'document':'csv'),budget:spaces.find(s=>s.id===t.spaceId)?.name,account:t.sourceAccountName||accounts.find(a=>a.id===active.accountId)?.name,statementId:t.sourceImportId||active.id,sourceFileName:t.sourceFileName||active.fileName,splits:t.splits.map(a=>({name:spaces.find(s=>s.id===a.spaceId)?.name||'Unknown budget',amount:a.amount})),notes:t.reason})}>Details</button>{active.status==='review'&&<button className="rounded-lg px-2 py-2 text-stone-500 hover:bg-stone-100" aria-label={`Edit row ${rowLabel(t)}`} onClick={()=>setEditing(editing===t.id?null:t.id)}>{editing===t.id?'Close':'Edit'}</button>}</td>
                </tr>
                {editing===t.id&&active.status==='review'&&<tr><td colSpan={showSorted?8:7} className="bg-stone-50 p-4"><fieldset disabled={busy} className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-stone-600">Date<input className={`${field} mt-1 block w-full`} type="date" aria-label={`Date row ${rowLabel(t)}`} value={t.date} onChange={e=>change(t.id,{date:e.target.value,reviewed:false})}/></label><label className="text-xs text-stone-600">Description<input className={`${field} mt-1 block w-full`} aria-label={`Description row ${rowLabel(t)}`} value={t.description} onChange={e=>change(t.id,{description:e.target.value,reviewed:false})}/></label><label className="text-xs text-stone-600">Amount<input className={`${field} mt-1 block w-full`} aria-label={`Amount row ${rowLabel(t)}`} type="number" step="0.01" value={t.amount} onChange={e=>change(t.id,{amount:Number(e.target.value),reviewed:false})}/></label></div><div className="flex flex-wrap items-center gap-3"><select className={field} aria-label={`Kind row ${rowLabel(t)}`} value={t.kind} onChange={e=>change(t.id,{kind:e.target.value as StatementTransaction['kind'],reviewed:false})}>{Object.entries(kindLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select className={field} aria-label={`Bucket row ${rowLabel(t)}`} value={t.spaceId} onChange={e=>assign(e.target.value,[t.id])}>{options}</select><button className={button} onClick={()=>change(t.id,{splits:t.splits.length?[]:[{spaceId:spaces[0]?.id||'',amount:t.amount},{spaceId:spaces[1]?.id||'',amount:0}],reviewed:false})}>{t.splits.length?'Remove split':'Split transaction'}</button><button className="text-sm underline" onClick={()=>{change(t.id,{excluded:true,reviewed:true});setEditing(null);}}>Exclude transaction</button></div>
                  {t.splits.length>0&&<><p className="text-xs text-stone-600">Split amounts must total {money(t.amount)}.</p><div className="flex flex-wrap gap-2">{t.splits.map((split,index)=><div className="flex gap-1" key={index}><select className={field} aria-label={`Split ${index+1} bucket row ${rowLabel(t)}`} value={split.spaceId} onChange={e=>change(t.id,{splits:t.splits.map((s,j)=>j===index?{...s,spaceId:e.target.value}:s),reviewed:false})}>{options}</select><input className={`${field} w-28`} aria-label={`Split ${index+1} amount row ${rowLabel(t)}`} type="number" step="0.01" value={split.amount} onChange={e=>change(t.id,{splits:t.splits.map((s,j)=>j===index?{...s,amount:Number(e.target.value)}:s),reviewed:false})}/></div>)}<button className={button} onClick={()=>change(t.id,{splits:[...t.splits,{spaceId:'',amount:0}],reviewed:false})}>Add split</button><button className={primary} onClick={()=>{const next={...t,reviewed:true};const error=validateTransaction(next);if(error){setMessage(error);return;}change(t.id,{reviewed:true});setEditing(null);}}>Confirm split</button></div></>}
                  <p className="text-xs text-stone-500">Source row {t.sourceRow} · {t.reason}</p>
                </fieldset></td></tr>}
              </React.Fragment>)}</tbody></table></div>}
              <details className="mx-5 mb-4 text-xs text-stone-500"><summary className="cursor-pointer">Statement details & totals</summary><p className="mt-2">Extracted net: {money(active.transactions.reduce((n,t)=>n+t.amount,0))}{active.statementTotal!=null&&<> · Printed net: {money(active.statementTotal)} · Difference: {money(active.transactions.reduce((n,t)=>n+t.amount,0)-active.statementTotal)}</>}</p>{active.members&&active.members.map(member=><p key={member.id} className="mt-2">{member.fileName}: {member.transactions.length} rows · Extracted net {money(active.transactions.filter(t=>t.sourceImportId===member.id).reduce((sum,t)=>sum+t.amount,0))}{member.statementTotal!=null&&<> · Source net {money(member.statementTotal)}</>}</p>)}{active.guidance&&<p className="mt-2">Upload guidance: {active.guidance}</p>}{active.status==='review'&&!active.members&&<fieldset disabled={busy} className="mt-3 flex flex-wrap gap-3">{(['openingBalance','closingBalance','statementTotal'] as const).map(key=><label key={key}>{key==='openingBalance'?'Opening balance':key==='closingBalance'?'Closing balance':'Printed net transactions'}<input className={`${field} mt-1 block w-36`} aria-label={key} type="number" step="0.01" value={active[key]??''} onChange={e=>setActive({...active,[key]:e.target.value===''?undefined:Number(e.target.value)})}/></label>)}</fieldset>}</details>
            </>}
          </div>
          {(busy||message)&&<p role="status" className="border-t border-stone-100 bg-stone-50 px-5 py-3 text-sm text-stone-700">{busy?(analysisProgress||'Saving or reading your statement…'):message}</p>}
          {view==='upload'&&stagedFiles.length>0&&<footer className="flex items-center justify-between gap-3 border-t border-stone-200 px-5 py-4"><span className="text-xs text-stone-500">Ready to analyze {stagedFiles.length} file{stagedFiles.length===1?'':'s'}.</span><button className={primary} disabled={busy||!ready||stagedFiles.some((_,index)=>!(fileAccounts[index]||accountId))} onClick={()=>void upload(stagedFiles)}>Analyze</button></footer>}
          {view==='review'&&active&&<footer className="border-t border-stone-200 bg-white px-5 py-4 sm:px-7">
            {active.status==='review'&&<><div className="mb-3 flex items-center justify-between text-xs text-stone-500"><span>{selected.length?`${selected.length} selected. Click a budget to move them.`:'Drop transactions into a budget below.'}</span><span>Sorted transactions leave the list.</span></div><div className="grid grid-cols-3 gap-2 sm:gap-3">{spaces.map(s=><button key={s.id} aria-label={`Assign to ${s.name}`} disabled={busy} onClick={()=>assign(s.id)} onDragOver={e=>{if(dragged.current.length){e.preventDefault();e.dataTransfer.dropEffect='move';setDragOver(s.id);}}} onDragLeave={()=>setDragOver('')} onDrop={e=>{e.preventDefault();assign(s.id,dragged.current);dragged.current=[];setDragOver('');}} className={`flex min-h-24 flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition-colors ${dragOver===s.id?'border-sky-700 bg-sky-100':selected.length?'border-stone-400 bg-stone-50 hover:border-stone-900 hover:bg-stone-100':'border-stone-200 bg-stone-50'}`}><span className="text-sm font-semibold text-stone-900">{s.name}</span><span className="mt-1 text-lg font-semibold tabular-nums text-stone-900">{money(draftTotals[s.id]||0)}</span><span className="mt-1 text-xs text-stone-500">{selected.length?'Move here':'This statement'}</span></button>)}</div></>}
            <div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-stone-500">{active.status==='review'?'Spending updates when you finish.':'Your planned budgets are unchanged.'}</span><div className="flex gap-2">{active.status==='review'?<><button className={button} disabled={busy} onClick={()=>run(async()=>{await persist(active,'review');setMessage('Review saved. You can return to it from Import history.');})}>Save for later</button><button className={primary} disabled={busy||remaining.length>0} onClick={commit}>Finish import</button></>:<>{active.status==='committed'&&<button className={button} disabled={busy} onClick={()=>run(async()=>{await persist({...active,status:'undone'},'committed');setMessage('Import undone. Its actual spending is excluded; history is retained.');})}>Undo import</button>}<button className={primary} onClick={close}>Done</button></>}</div></div>
          </footer>}
        </DialogPanel>
      </div>
    </Dialog>
    <TransactionDetails detail={transactionDetail} onClose={()=>setTransactionDetail(null)} onOpenSource={id=>{setTransactionDetail(null);if(documents[id])viewDocument(documents[id]);else setMessage('Original not attached yet. Use Statement documents to attach it.');}}/>
  </section>;
}
