import React from 'react';
import { CircleDollarSign } from 'lucide-react';
const money=(amount:number)=>amount.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function CashFlowSummary({received,earned,other,spent,net,onBreakdown}:{received:number;earned:number;other:number;spent:number;net:number;onBreakdown:(kind:'total'|'earned'|'other')=>void}) {
  return <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{[
    {label:'Total money received',value:received,color:'text-emerald-600'},
    {label:'Earned income',value:earned,color:'text-emerald-600'},
    {label:'Other money received',value:other,color:'text-sky-600'},
    {label:'Money spent',value:spent,color:'text-pink-600'},
    {label:'Net after spending',value:net,color:'text-amber-600'},
  ].map(metric=><div key={metric.label} className="rounded-lg border border-stone-200 bg-white p-4"><div className={`mb-3 ${metric.color}`}><CircleDollarSign className="h-5 w-5"/></div>{['Total money received','Earned income','Other money received'].includes(metric.label)?<button onClick={()=>onBreakdown(metric.label==='Total money received'?'total':metric.label==='Earned income'?'earned':'other')} className="w-full text-left"><span className="block min-h-10 text-sm text-stone-500 underline">{metric.label} · View breakdown</span><span className="mt-1 block text-2xl font-semibold text-stone-950">{money(metric.value)}</span></button>:<><div className="min-h-10 text-sm text-stone-500">{metric.label}</div><div className="mt-1 text-2xl font-semibold text-stone-950">{money(metric.value)}</div></>}</div>)}</section>;
}
