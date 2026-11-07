import React from 'react';
import { CircleDollarSign } from 'lucide-react';
const money=(amount:number)=>amount.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function CashFlowSummary({received,earned,other,net,onOther}:{received:number;earned:number;other:number;net:number;onOther:()=>void}) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[
    {label:'Total money received',value:received,color:'text-emerald-600'},
    {label:'Earned income',value:earned,color:'text-emerald-600'},
    {label:'Other money received',value:other,color:'text-sky-600'},
    {label:'Net cash flow',value:net,color:'text-amber-600'},
  ].map(metric=><div key={metric.label} className="rounded-lg border border-stone-200 bg-white p-4"><div className={`mb-3 ${metric.color}`}><CircleDollarSign className="h-5 w-5"/></div>{metric.label==='Other money received'?<button onClick={onOther} className="w-full text-left"><span className="text-sm text-stone-500 underline">{metric.label} · View breakdown</span><span className="mt-1 block text-2xl font-semibold text-stone-950">{money(metric.value)}</span></button>:<><div className="text-sm text-stone-500">{metric.label}</div><div className="mt-1 text-2xl font-semibold text-stone-950">{money(metric.value)}</div></>}</div>)}</section>;
}
