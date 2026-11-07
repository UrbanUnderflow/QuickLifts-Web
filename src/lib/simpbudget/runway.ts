import {monthlyBurn} from './monthlyBurn';
import {bankCashFlow} from './cashFlow';
import type {Account,StatementImport} from './statements';
export type RunwayEntity={id:string;name:string;cash:number|null;spending:number;income:number};
export type RunwayTransfer={from:string;to:string;amount:number};
export function simulateRunway(entities:RunwayEntity[],transfers:RunwayTransfer[],expenseCut=0,incomeLoss=0,horizon=36){
  if(!entities.length||new Set(entities.map(e=>e.id)).size!==entities.length||entities.some(e=>e.cash===null||!Number.isFinite(e.cash)||e.cash<0||e.cash>1e12||!Number.isFinite(e.spending)||e.spending<0||e.spending>1e12||!Number.isFinite(e.income)||e.income<0||e.income>1e12))throw Error('Enter nonnegative available cash, spending and income for every budget.');
  if(!Number.isFinite(expenseCut)||expenseCut<0||expenseCut>100||!Number.isFinite(incomeLoss)||incomeLoss<0||incomeLoss>100||!Number.isInteger(horizon)||horizon<1||horizon>36)throw Error('Choose valid scenario percentages and a horizon of 1–36 months.');
  const ids=new Set(entities.map(e=>e.id));
  if(transfers.some(t=>!ids.has(t.from)||!ids.has(t.to)||t.from===t.to||!Number.isFinite(t.amount)||t.amount<0||t.amount>1e12))throw Error('Transfers need different source and destination budgets and a nonnegative amount.');
  const cents=(n:number)=>Math.round(n*100);
  const balances=Object.fromEntries(entities.map(e=>[e.id,cents(e.cash!)]));
  const deltas=Object.fromEntries(entities.map(e=>[e.id,cents(e.income*(1-incomeLoss/100))-cents(e.spending*(1-expenseCut/100))]));
  const firstShortfall:Record<string,number|null>=Object.fromEntries(entities.map(e=>[e.id,null]));
  const fundingWarnings:Record<string,{firstMonth:number;unfunded:number}>={};
  let combinedShortfall:number|null=null;
  const rows=Array.from({length:horizon},(_,index)=>{
    for(const e of entities)balances[e.id]+=deltas[e.id];
    // Snapshot donor capacity before any incoming support: no same-month circular funding.
    const capacity=Object.fromEntries(entities.map(e=>[e.id,Math.max(0,balances[e.id])]));
    const paid=transfers.map(()=>0);
    for(const donor of entities){
      const outgoing=transfers.map((t,i)=>({t,i,requested:cents(t.amount)})).filter(v=>v.t.from===donor.id);
      const requested=outgoing.reduce((sum,v)=>sum+v.requested,0),available=Math.min(requested,capacity[donor.id]);
      if(!requested)continue;
      const shares=outgoing.map(v=>({...v,exact:available*v.requested/requested}));
      let remainder=available;
      for(const share of shares){paid[share.i]=Math.floor(share.exact);remainder-=paid[share.i];}
      shares.sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact))||a.i-b.i);
      for(let i=0;i<remainder;i++)paid[shares[i].i]++;
    }
    transfers.forEach((t,i)=>{balances[t.from]-=paid[i];balances[t.to]+=paid[i];const missing=cents(t.amount)-paid[i];if(missing>0){if(firstShortfall[t.from]===null)firstShortfall[t.from]=index+1;const warning=fundingWarnings[t.to]||{firstMonth:index+1,unfunded:0};warning.unfunded+=missing;fundingWarnings[t.to]=warning;}});
    for(const e of entities)if(balances[e.id]<0&&firstShortfall[e.id]===null)firstShortfall[e.id]=index+1;
    const total=Object.values(balances).reduce((a,b)=>a+b,0);if(total<0&&combinedShortfall===null)combinedShortfall=index+1;
    return {month:index+1,total:total/100,balances:Object.fromEntries(Object.entries(balances).map(([id,n])=>[id,n/100]))};
  });
  return {rows,firstShortfall,combinedShortfall,fundingWarnings:Object.fromEntries(Object.entries(fundingWarnings).map(([id,w])=>[id,{...w,unfunded:w.unfunded/100}])),monthlyNet:Object.values(deltas).reduce((a,b)=>a+b,0)/100};
}
export function runwayHistory(imports:StatementImport[],accounts:Account[],id:string,asOf:string,recurring:{label:string;amount:string|number}[]){
  const year=Number(asOf.slice(0,4)),month=Number(asOf.slice(5,7));
  const start=new Date(Date.UTC(year,month-13,1)).toISOString().slice(0,10),end=new Date(Date.UTC(year,month-1,0)).toISOString().slice(0,10);
  const burn=monthlyBurn({imports,spaceId:id,view:'this-year',year,month,range:{start,end},recurring,today:asOf});
  const earned=bankCashFlow(imports,accounts,{start,end},id).earnedRows;
  const groups=new Map<string,{months:Set<string>;total:number;latest:string}>();
  for(const row of earned){const label=row.description.toLowerCase().replace(/\d+/g,'').replace(/\s+/g,' ').trim();if(!/payroll|salary|stripe|shopify|square|customer/.test(label))continue;const item=groups.get(label)||{months:new Set<string>(),total:0,latest:''};item.months.add(row.date.slice(0,7));item.latest=row.date>item.latest?row.date:item.latest;item.total+=Math.round(row.allocatedAmount*100);groups.set(label,item);}
  const candidates=[...groups.values()].filter(g=>g.months.size>=3);
  return {spending:burn.average,planned:burn.planned,months:burn.months.length,incomeCandidate:Math.round(candidates.reduce((sum,g)=>sum+g.total/g.months.size,0))/100,candidateCount:candidates.length,latestCandidateDate:candidates.map(g=>g.latest).sort().at(-1)||'',start,end};
}
