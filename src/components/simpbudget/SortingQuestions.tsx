import React,{useState} from 'react';
import type {StatementTransaction} from '../../lib/simpbudget/statements';
import {sortingQuestions, type SortingDecision} from '../../lib/simpbudget/sortingQuestions';
type Space={id:string;name:string};
const button='rounded-lg border border-stone-300 px-4 py-2 text-sm disabled:opacity-40 hover:bg-stone-100';
const money=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function SortingQuestions({rows,spaces,busy,interpret,onApply}:{rows:StatementTransaction[];spaces:Space[];busy:boolean;interpret:(rows:StatementTransaction[],answer:string,suggestedSpaceId:string)=>Promise<{decisions:SortingDecision[];clarification:string}>;onApply:(decisions:SortingDecision[],answer:string)=>void}){
 const [skipped,setSkipped]=useState<string[]>([]),[answer,setAnswer]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false),[alternative,setAlternative]=useState(false),[proposal,setProposal]=useState<SortingDecision[]|null>(null);
 const questions=sortingQuestions(rows),question=questions.find(q=>!skipped.includes(q.key));
 const reset=()=>{setAnswer('');setError('');setAlternative(false);setProposal(null);};
 const apply=(decisions:SortingDecision[],text:string)=>{onApply(decisions,text);reset();};
 const ask=async()=>{if(!question)return;setWorking(true);setError('');try{const result=await interpret(question.rows,answer,question.suggestedSpaceId);setProposal(result.decisions);setError(result.clarification);}catch(e){setError(e instanceof Error?e.message:'Unable to interpret your answer. Choose a budget below.');}finally{setWorking(false);}};
 if(!questions.length)return null;
 if(!question)return <section className="mx-5 my-4 rounded-xl bg-stone-50 p-4"><p>Questions paused. You can sort the remaining transactions below.</p><button className={`${button} mt-2`} onClick={()=>setSkipped([])}>Resume sorting questions</button></section>;
 const suggested=spaces.find(s=>s.id===question.suggestedSpaceId);
 return <section aria-label="Sorting questions" className="mx-5 my-4 rounded-xl border border-sky-100 bg-sky-50/50 p-5"><fieldset disabled={busy||working}>
 <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Let’s sort these together</h3><span className="text-xs text-stone-500">{questions.length} groups left</span></div>
 <p className="mt-2 text-sm">{suggested?`Should these ${question.rows.length} transactions go to ${suggested.name}?`:'Which budget should these transactions go to?'} <strong>{money(question.rows.reduce((sum,r)=>sum+r.amount,0))}</strong></p>
 <details className="mt-2 text-sm"><summary className="cursor-pointer">{Array.from(new Set(question.rows.map(r=>r.description))).slice(0,3).join(' · ')}{question.rows.length>3?' …':''}</summary><ul className="mt-2 max-h-48 overflow-auto space-y-2">{question.rows.map(r=><li key={r.id}>{r.date} · {r.description} · {money(r.amount)} · {r.sourceAccountName}</li>)}</ul></details>
 <div className="mt-4 flex flex-wrap gap-2">{suggested&&!alternative&&<><button className={button} onClick={()=>apply(question.rows.map(r=>({id:r.id,spaceId:suggested.id,exclude:false})),`Yes, these belong to ${suggested.name}.`)}>Yes</button><button className={button} onClick={()=>{setAlternative(true);setProposal(null);}}>No</button></>}{(!suggested||alternative)&&spaces.map(s=><button key={s.id} className={button} onClick={()=>apply(question.rows.map(r=>({id:r.id,spaceId:s.id,exclude:false})),`Assign this group to ${s.name}.`)}>{s.name}</button>)}<button className={button} onClick={()=>{setSkipped([...skipped,question.key]);reset();}}>Skip for now</button></div>
 <label className="mt-4 block text-sm">Any exceptions or specifics?<textarea aria-label="Sorting answer" className="mt-2 block w-full rounded-lg border border-stone-300 bg-white p-3" rows={2} maxLength={2000} value={answer} onChange={e=>{setAnswer(e.target.value);setProposal(null);}} placeholder={suggested?`Yes, except the hotel should go to another budget…`:'Tell us which merchants belong to which budget…'}/></label>
 <p className="mt-1 text-xs text-stone-500">Send response shares this group and your answer with AI to propose a sort. You review the changes before applying. Answers apply to this import only.</p>
 <button className={`${button} mt-3`} disabled={!answer.trim()||busy||working} onClick={()=>void ask()}>{working?'Reading your answer…':'Send response'}</button>
 {error&&<p role="status" className="mt-3 text-sm">{error}</p>}
 {proposal&&proposal.length>0&&<div className="mt-4 rounded-lg bg-white p-4"><h4 className="font-medium">Check the proposed changes</h4><ul className="mt-2 max-h-48 overflow-auto text-sm">{proposal.map(d=><li className="py-1" key={d.id}>{question.rows.find(r=>r.id===d.id)?.description} → {d.exclude?'Excluded from spending':spaces.find(s=>s.id===d.spaceId)?.name}</li>)}</ul><button className={`${button} mt-3`} onClick={()=>apply(proposal,answer)}>Apply these changes</button></div>}
 <p className="mt-3 text-xs text-stone-500">Undo last sort can reverse an answer. Finish import saves the reviewed transactions to spending.</p>
 </fieldset></section>;
}
