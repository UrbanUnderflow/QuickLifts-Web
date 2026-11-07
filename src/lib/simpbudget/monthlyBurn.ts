import { validateTransaction, type StatementImport } from './statements';
import type { DateView } from './dateViews';
export type MonthlyBurnInput={imports:StatementImport[];spaceId:string;view:DateView;year:number;month:number;range:{start:string;end:string};recurring:{label:string;amount:string|number}[];today?:string};
const moneyCents=(value:number)=>Math.round(value*100);
const monthKey=(date:Date)=>date.toISOString().slice(0,7);
const lastDay=(key:string)=>new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).toISOString().slice(0,10);
/** Monthly spending pace, not cash balance, income, or a tax classification. */
export function monthlyBurn(input:MonthlyBurnInput){
  const today=input.today||new Date().toISOString().slice(0,10);
  const selected=`${input.year}-${String(input.month).padStart(2,'0')}`;
  const start=input.view==='month'?`${monthKey(new Date(Date.UTC(input.year,input.month-12,1)))}-01`:input.range.start;
  const end=input.view==='month'?lastDay(selected):input.range.end;
  const totals=new Map<string,number>();
  let partialRows=0;
  for(const statement of input.imports){
    if(statement.status!=='committed')continue;
    for(const tx of statement.transactions){
      if(tx.date<start||tx.date>end||tx.excluded||tx.duplicate||!tx.reviewed||!['expense','refund'].includes(tx.kind)||validateTransaction(tx))continue;
      const allocations=tx.splits.length?tx.splits:[{spaceId:tx.spaceId,amount:tx.amount}];
      const matching=allocations.filter(a=>input.spaceId==='all'||a.spaceId===input.spaceId);
      if(!matching.length)continue;
      const key=tx.date.slice(0,7);
      if(`${key}-01`<start||lastDay(key)>end||key>=today.slice(0,7)){partialRows++;continue;}
      totals.set(key,(totals.get(key)||0)+matching.reduce((sum,a)=>sum+moneyCents(a.amount),0));
    }
  }
  const months=[...totals].sort(([a],[b])=>a.localeCompare(b)).map(([month,cents])=>({month,amount:cents/100}));
  const total=months.reduce((sum,item)=>sum+moneyCents(item.amount),0)/100;
  const planned=input.recurring.reduce((sum,row)=>{const amount=Number(row.amount);return sum+(row.label.trim()&&Number.isFinite(amount)&&amount>0?moneyCents(amount):0);},0)/100;
  return {planned,average:months.length?Math.round(total*100/months.length)/100:null,total,months,start,end,partialRows};
}
