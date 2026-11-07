import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, runTransaction, setDoc } from 'firebase/firestore';
import { simpBudgetDb } from '../../api/firebase/simpBudgetConfig';
import { Account, Rule, StatementImport, StatementTransaction, parseCsv, mapCsv, applySuggestions, markDuplicates, validateTransaction, actualTotals } from '../../lib/simpbudget/statements';

type Space = { id: string; name: string };
const field = 'rounded border border-stone-300 bg-white px-3 py-2 text-sm';
const button = 'rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-40 hover:bg-stone-100';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const uid = () => crypto.randomUUID();

export default function StatementWorkspace({ user, spaces, year, month }: { user: User; spaces: Space[]; year: number; month: number }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [imports, setImports] = useState<StatementImport[]>([]);
  const importsRef = useRef<StatementImport[]>([]);
  const [accountId, setAccountId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'bank'|'card'>('bank');
  const [defaultSpace, setDefaultSpace] = useState('');
  const [guidance, setGuidance] = useState('');
  const [ruleText, setRuleText] = useState('');
  const [ruleSpace, setRuleSpace] = useState('');
  const [active, setActive] = useState<StatementImport|null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkSpace, setBulkSpace] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ file: File; rows: string[][]; fingerprint: string }|null>(null);
  const [mapping, setMapping] = useState({ date: 0, description: 1, amount: 2, debit: -1, credit: -1 });
  const [positiveExpenses, setPositiveExpenses] = useState(true);
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
    await persist(value); setPending(null); setSelected([]); setMessage('Review saved. Check dates, amounts, duplicates and suggested buckets before committing. Use Save review to preserve later edits.');
  };
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
  const change = (id:string, patch:Partial<StatementTransaction>) => setActive(value=>value?{...value,transactions:value.transactions.map(t=>t.id===id?{...t,...patch}:t)}:value);
  const totals=actualTotals(imports.map(i=>({...i,transactions:i.transactions.filter(t=>t.date.startsWith(`${year}-${String(month).padStart(2,'0')}`))})));
  const options=<><option value="">Needs a bucket</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</>;
  const commit = () => run(async()=>{
    if(!active) return;
    for(const t of active.transactions) { const error=validateTransaction(t); if(error) throw new Error(`Row ${t.sourceRow}: ${error}`); }
    await persist({...active,status:'committed'},'review'); setMessage('Committed to actual spending. Planned budgets were not changed.');
  });
  return <section className="mb-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Statements & actual spending</h2><p className="text-sm text-stone-500">Import once. Review and split across your Budget Spaces.</p></div><button className={button} onClick={()=>setOpen(!open)}>{open?'Hide workspace':'Open statement workspace'}</button></div>
    <div className="mt-4 flex flex-wrap gap-4">{spaces.map(s=><div key={s.id} className="rounded-lg bg-stone-50 px-4 py-2"><span className="text-sm text-stone-500">{s.name} · actual {month}/{year}</span><p className="text-xl font-semibold">{money(totals[s.id]||0)}</p></div>)}</div>
    <p className="mt-3 text-xs text-stone-500">Actuals include only committed statement transactions. Transfers and card payments are excluded; refunds reduce spending. Existing monthly budgets remain separate planning figures.</p>
    {open&&<div className="mt-5 space-y-5">
      <fieldset disabled={busy||!ready} className="space-y-4"><legend className="font-semibold">1. Accounts & import</legend>
        <div className="flex flex-wrap gap-2"><input className={field} placeholder="Account nickname (no full number)" aria-label="Account nickname" value={name} onChange={e=>setName(e.target.value)}/><select className={field} aria-label="Account type" value={type} onChange={e=>setType(e.target.value as 'bank'|'card')}><option value="bank">Bank</option><option value="card">Credit card</option></select><select className={field} aria-label="Default bucket" value={defaultSpace} onChange={e=>setDefaultSpace(e.target.value)}>{options}</select><button className={button} onClick={()=>run(async()=>{if(!name.trim())throw new Error('Enter an account nickname.');const a:Account={id:uid(),name:name.trim(),type,defaultSpaceId:defaultSpace};await setDoc(doc(root('statementAccounts'),a.id),a);setAccounts(v=>[...v,a]);setAccountId(a.id);setName('');})}>Add account</button></div>
        <select className={field} aria-label="Statement account" value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Choose statement account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}</select>
        <textarea className={`${field} block w-full`} maxLength={2000} rows={2} aria-label="Upload guidance" placeholder="Optional: Home Depot transactions this month are likely for TresProperties. Suggestions only; this does not create a permanent rule." value={guidance} onChange={e=>setGuidance(e.target.value)}/>
        <p className="text-xs text-stone-500">CSV is parsed on your device. PDFs and images are sent securely to the statement parser and OpenAI for extraction. Original files are not stored by SimpBudget; extracted transactions are saved privately to your account. Limit: 4 MB and 500 rows per file. Always verify AI extraction.</p>
        <input type="file" accept=".csv,.pdf,image/png,image/jpeg,image/webp" multiple aria-label="Upload statements" disabled={!accountId||!!pending} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';void upload(files);}}/>
      </fieldset>
      {pending&&<fieldset disabled={busy} className="rounded-lg bg-sky-50 p-4 space-y-3"><legend className="font-semibold">Map columns · {pending.file.name}</legend><div className="flex flex-wrap gap-2">{(['date','description','amount','debit','credit'] as const).map(key=><label key={key} className="text-sm">{key}<select className={`${field} block`} value={mapping[key]} onChange={e=>setMapping({...mapping,[key]:Number(e.target.value)})}><option value={-1}>Not used</option>{pending.rows[0].map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>)}</div><p className="text-xs">Use amount OR separate debit/credit columns. Dates use YYYY-MM-DD or US MM/DD/YYYY. Review sign direction carefully.</p><label className="text-sm"><input type="checkbox" checked={positiveExpenses} onChange={e=>setPositiveExpenses(e.target.checked)}/> Positive amounts are spending (uncheck if spending is negative)</label><p className="text-xs">First row: {pending.rows[1]?.join(' · ')}</p><div className="flex gap-2"><button className={button} onClick={()=>run(()=>startReview(pending.file,pending.fingerprint,mapCsv(pending.rows.slice(1),{date:mapping.date,description:mapping.description,...(mapping.amount>=0?{amount:mapping.amount}:{...(mapping.debit>=0?{debit:mapping.debit}:{}),...(mapping.credit>=0?{credit:mapping.credit}:{})})},{positiveExpenses}))) }>Create review</button><button className={button} onClick={()=>setPending(null)}>Cancel</button></div></fieldset>}
      <details><summary className="cursor-pointer font-semibold">Account defaults & permanent merchant rules</summary><div className="mt-3 space-y-2">{accounts.map(a=><label key={a.id} className="flex flex-wrap items-center gap-2 text-sm">{a.name}<select className={field} disabled={busy} value={a.defaultSpaceId} onChange={e=>{const value={...a,defaultSpaceId:e.target.value};void run(async()=>{await setDoc(doc(root('statementAccounts'),a.id),value);setAccounts(all=>all.map(x=>x.id===a.id?value:x));});}}>{options}</select></label>)}<div className="flex flex-wrap gap-2"><input className={field} aria-label="Merchant contains" placeholder="Merchant contains" value={ruleText} onChange={e=>setRuleText(e.target.value)}/><select className={field} value={ruleSpace} aria-label="Rule bucket" onChange={e=>setRuleSpace(e.target.value)}>{options}</select><button className={button} disabled={busy} onClick={()=>run(async()=>{if(!ruleText.trim()||!ruleSpace)throw new Error('Choose a merchant and bucket.');const r:Rule={id:uid(),contains:ruleText.trim(),spaceId:ruleSpace};await setDoc(doc(root('statementRules'),r.id),r);setRules(all=>[...all,r]);setRuleText('');})}>Save permanent rule</button></div>{rules.map(r=><p key={r.id} className="text-sm">{r.contains} → {spaces.find(s=>s.id===r.spaceId)?.name||'Unavailable bucket'} <button className="ml-2 underline" disabled={busy} onClick={()=>run(async()=>{await deleteDoc(doc(root('statementRules'),r.id));setRules(all=>all.filter(x=>x.id!==r.id));})}>Remove rule</button></p>)}</div></details>
      <div><h3 className="font-semibold">2. Review inbox & import history</h3><div className="mt-2 flex flex-wrap gap-2">{[...imports].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(i=><button className={`${button} ${active?.id===i.id?'bg-sky-50':''}`} disabled={busy} key={i.id} onClick={()=>run(async()=>{if(active?.id===i.id)return;if(active?.status==='review')await persist(active,'review');setActive(i);setSelected([]);})}>{i.fileName} · {i.status} · {i.transactions.length} rows</button>)}</div></div>
      {active&&<div className="space-y-3"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{active.fileName}</h3><p className="text-xs text-stone-500">{accounts.find(a=>a.id===active.accountId)?.name} · {active.createdAt} · {active.status}</p>{active.guidance&&<p className="text-sm">Upload guidance: {active.guidance}</p>}</div>{active.status==='review'?<div className="flex gap-2"><button className={button} disabled={busy} onClick={()=>run(()=>persist(active,'review'))}>Save review</button><button className={`${button} bg-stone-900 text-white`} disabled={busy} onClick={commit}>Commit reviewed transactions</button></div>:active.status==='committed'?<button className={button} disabled={busy} onClick={()=>run(async()=>{await persist({...active,status:'undone'},'committed');setMessage('Import undone. Its actual spending is excluded; history is retained.');})}>Undo import</button>:<span>Undone · retained for audit</span>}</div>
        {active.warnings.map((w,i)=><p className="rounded bg-amber-50 p-2 text-sm" key={i}>{w}</p>)}
        <div className="rounded bg-stone-50 p-3 text-sm">Extracted net: {money(active.transactions.reduce((n,t)=>n+t.amount,0))}{active.statementTotal!=null&&<> · Statement net: {money(active.statementTotal)} · Difference: {money(active.transactions.reduce((n,t)=>n+t.amount,0)-active.statementTotal)}</>}{active.openingBalance!=null&&<> · Opening: {money(active.openingBalance)}</>}{active.closingBalance!=null&&<> · Closing: {money(active.closingBalance)}</>}<p className="text-xs text-stone-500">Compare against the original statement. Totals are shown only when extracted; balance conventions vary by account.</p></div>
        <fieldset disabled={busy||active.status!=='review'} className="space-y-3"><div className="flex flex-wrap gap-3">{(['openingBalance','closingBalance','statementTotal'] as const).map(key=><label className="text-xs" key={key}>{key==='openingBalance'?'Opening balance':key==='closingBalance'?'Closing balance':'Printed net transactions'}<input className={`${field} block w-40`} aria-label={key} type="number" step="0.01" value={active[key]??''} onChange={e=>setActive({...active,[key]:e.target.value===''?undefined:Number(e.target.value)})}/></label>)}</div><p className="text-xs text-stone-500">You can enter or correct printed totals for CSVs and scans. Positive net means charges exceed credits. A mismatch is a warning to compare every row, not a reason to silently drop transactions.</p><div className="flex flex-wrap items-center gap-2"><button className={button} onClick={()=>setSelected(active.transactions.map(t=>t.id))}>Select all</button><button className={button} onClick={()=>setSelected([])}>Clear selection</button><select className={field} aria-label="Bulk bucket" value={bulkSpace} onChange={e=>setBulkSpace(e.target.value)}>{options}</select><button className={button} onClick={()=>{if(!bulkSpace)return;setActive({...active,transactions:active.transactions.map(t=>selected.includes(t.id)?{...t,spaceId:bulkSpace,splits:[],reviewed:true}:t)});}}>Assign selected & review</button><button className={button} onClick={()=>setActive({...active,transactions:active.transactions.map(t=>selected.includes(t.id)?{...t,excluded:true,reviewed:true}:t)})}>Exclude selected</button></div>
          <div className="max-h-[600px] overflow-auto space-y-2">{active.transactions.map(t=><div key={t.id} className="rounded-lg border border-stone-200 p-3"><div className="flex flex-wrap items-center gap-2"><input aria-label={`Select row ${t.sourceRow}`} type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,t.id]:s.filter(id=>id!==t.id))}/><span className="text-xs text-stone-500">Row {t.sourceRow}</span><input className={field} type="date" aria-label={`Date row ${t.sourceRow}`} value={t.date} onChange={e=>change(t.id,{date:e.target.value,reviewed:false})}/><input className={`${field} flex-1`} aria-label={`Description row ${t.sourceRow}`} value={t.description} onChange={e=>change(t.id,{description:e.target.value,reviewed:false})}/><input className={`${field} w-28`} aria-label={`Amount row ${t.sourceRow}`} type="number" step="0.01" value={t.amount} onChange={e=>change(t.id,{amount:Number(e.target.value),reviewed:false})}/><select className={field} aria-label={`Kind row ${t.sourceRow}`} value={t.kind} onChange={e=>change(t.id,{kind:e.target.value as StatementTransaction['kind'],reviewed:false})}>{['expense','refund','transfer','card_payment','income'].map(k=><option key={k}>{k}</option>)}</select><select className={field} aria-label={`Bucket row ${t.sourceRow}`} value={t.spaceId} onChange={e=>change(t.id,{spaceId:e.target.value,splits:[],reviewed:false})}>{options}</select></div>
            <p className="mt-2 text-xs text-stone-500">{t.reason}{t.suggestedSpaceId&&<> · Suggested: {spaces.find(s=>s.id===t.suggestedSpaceId)?.name}<button className="ml-2 underline" onClick={()=>change(t.id,{spaceId:t.suggestedSpaceId,splits:[]})}>Use suggestion</button></>}</p>
            {t.duplicate&&<p className="text-sm text-amber-700">Possible duplicate. Compare date, merchant and amount with other imports; exclude it or explicitly keep and review it.</p>}
            <div className="mt-2 flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={t.excluded} onChange={e=>change(t.id,{excluded:e.target.checked,reviewed:false})}/> Exclude from spending</label><label><input type="checkbox" checked={t.reviewed} onChange={e=>change(t.id,{reviewed:e.target.checked})}/> Reviewed{t.duplicate?' (keep unless excluded)':''}</label><button className="underline" onClick={()=>change(t.id,{splits:t.splits.length?[]:[{spaceId:spaces[0]?.id||'',amount:t.amount},{spaceId:spaces[1]?.id||'',amount:0}],reviewed:false})}>{t.splits.length?'Remove split':'Split transaction'}</button></div>
            {t.splits.length>0&&<div className="mt-2 flex flex-wrap gap-2">{t.splits.map((split,index)=><div className="flex gap-1" key={index}><select className={field} aria-label={`Split ${index+1} bucket row ${t.sourceRow}`} value={split.spaceId} onChange={e=>change(t.id,{splits:t.splits.map((s,j)=>j===index?{...s,spaceId:e.target.value}:s),reviewed:false})}>{options}</select><input className={`${field} w-28`} aria-label={`Split ${index+1} amount row ${t.sourceRow}`} type="number" step="0.01" value={split.amount} onChange={e=>change(t.id,{splits:t.splits.map((s,j)=>j===index?{...s,amount:Number(e.target.value)}:s),reviewed:false})}/></div>)}<button className={button} onClick={()=>change(t.id,{splits:[...t.splits,{spaceId:'',amount:0}],reviewed:false})}>Add split</button><span className="text-xs">Must total {money(t.amount)}</span></div>}
          </div>)}</div>
        </fieldset>
      </div>}
    </div>}
    {(busy||message)&&<p role="status" className="mt-4 rounded bg-sky-50 p-3 text-sm">{busy?'Working securely. Keep this page open…':message}</p>}
  </section>;
}
