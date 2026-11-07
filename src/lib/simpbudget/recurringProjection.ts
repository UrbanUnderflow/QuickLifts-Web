import {actualTransactions,type StatementImport} from './statements';
import {recurringMatch,recurringMerchantKey} from './merchantMatching';
type Row={id:string;label:string;amount:string};
type Month={budgetSpaceId:string;year:number;month:number;recurringExpenses:Row[]};
/** Read-only accepted identities. Never persist these derived lines into monthly documents. */
export function projectedRecurring(imports:StatementImport[],records:Month[],spaceId:string,year:number,month:number,explicit:Row[]){
 const accepted=new Map<string,{row:Row;year:number;month:number}>();
 for(const record of [...records].sort((a,b)=>b.year-a.year||b.month-a.month)){
  if(record.budgetSpaceId!==spaceId||record.year===year&&record.month===month)continue;
  for(const row of record.recurringExpenses){if(!row.label.trim())continue;const key=recurringMerchantKey(row.label);if(!accepted.has(key))accepted.set(key,{row,year:record.year,month:record.month});}
 }
 const candidates=[...accepted].filter(([,value])=>!explicit.some(row=>recurringMatch(value.row.label,row.label).matched||recurringMatch(row.label,value.row.label).matched));
 const transactions=actualTransactions(imports,year,month,spaceId).filter(row=>!row.duplicate&&['expense','refund'].includes(row.kind)&&!/dispute|chargeback|late fee|overdraft|returned payment|\bnsf\b/i.test(row.description));
 return candidates.flatMap(([key,source])=>{
  const matches=transactions.filter(tx=>{const match=recurringMatch(tx.description,source.row.label);return match.matched&&!match.proposed;});
  if(!matches.some(row=>row.kind==='expense'))return [];
  if(matches.some(tx=>candidates.filter(([,other])=>{const m=recurringMatch(tx.description,other.row.label);return m.matched&&!m.proposed;}).length>1||explicit.some(row=>recurringMatch(tx.description,row.label).matched)))return [];
  const amount=matches.reduce((sum,row)=>sum+Math.round(row.allocatedAmount*100),0)/100;
  if(amount<0)return [];
  return [{id:`inherited:${key}`,label:source.row.label,amount:amount.toFixed(2),sourceYear:source.year,sourceMonth:source.month,sourceId:source.row.id,matches}];
 });
}
