import { actualTransactions, type StatementImport } from './statements';
import { recurringMerchantKey } from './recurringSuggestions';
type Recurring = {id:string;label:string;amount:string};
const contains = (description:string,label:string) => {const key=recurringMerchantKey(label);return key.length>=4&&` ${recurringMerchantKey(description)} `.includes(` ${key} `);};
export function validateRecurringMonth(imports:StatementImport[],spaceId:string,year:number,month:number,recurring:Recurring[]) {
  const rows=actualTransactions(imports,year,month,spaceId);
  return recurring.map(item=>{
    const matches=rows.filter(row=>contains(row.description,item.label));
    const ambiguous=matches.some(row=>recurring.filter(other=>contains(row.description,other.label)).length>1);
    const amount=matches.reduce((sum,row)=>sum+Math.round(row.allocatedAmount*100),0)/100;
    const multipleCharges=matches.filter(row=>row.kind==='expense').length>1;
    const status=!matches.length?'No charge found':ambiguous||multipleCharges?'Needs review':Math.round(amount*100)===Math.round(Number(item.amount.replace(/,/g,''))*100)?'Matched':'Amount changed';
    return {id:item.id,matches,amount,status,ambiguous};
  });
}
