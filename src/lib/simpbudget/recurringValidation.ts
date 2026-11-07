import { actualTransactions, type StatementImport } from './statements';
import { recurringMatch } from './merchantMatching';
type Recurring = {id:string;label:string;amount:string};
export function validateRecurringMonth(imports:StatementImport[],spaceId:string,year:number,month:number,recurring:Recurring[]) {
  const rows=actualTransactions(imports,year,month,spaceId);
  return recurring.map(item=>{
    const matches=rows.filter(row=>recurringMatch(row.description,item.label).matched);
    const ambiguous=matches.some(row=>recurring.filter(other=>recurringMatch(row.description,other.label).matched).length>1);
    const proposed=matches.some(row=>recurringMatch(row.description,item.label).proposed);
    const explanation=matches.map(row=>recurringMatch(row.description,item.label).explanation).find(Boolean)||'';
    const cutoff=`${year}-${String(month).padStart(2,'0')}-01`;
    const historical=imports.filter(item=>item.status==='committed').flatMap(item=>item.transactions).filter(tx=>tx.date<cutoff&&!tx.excluded&&tx.reviewed&&tx.kind==='expense'&&(tx.spaceId===spaceId||tx.splits.some(split=>split.spaceId===spaceId))&&recurringMatch(tx.description,item.label).matched&&!/dispute|reversal/i.test(tx.description)).sort((a,b)=>b.date.localeCompare(a.date));
    const lastSeen=historical[0]?.date;
    const amount=matches.reduce((sum,row)=>sum+Math.round(row.allocatedAmount*100),0)/100;
    const multipleCharges=matches.filter(row=>row.kind==='expense').length>1;
    const status=!matches.length?(lastSeen?'No charge matched this month':'No matching imported charge'):ambiguous||multipleCharges||proposed?'Needs review':Math.round(amount*100)===Math.round(Number(item.amount.replace(/,/g,''))*100)?'Matched':'Amount changed';
    return {id:item.id,matches,amount,status,ambiguous,proposed,explanation,lastSeen};
  });
}
