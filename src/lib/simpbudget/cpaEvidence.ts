import { actualTransactions, type Account, type StatementImport } from './statements';
import { bankCashFlow } from './cashFlow';
const topicIds=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,19];
export interface CPAEvidenceRow {id:string;statementId:string;date:string;description:string;notes:string;category:string;budgetId:string;budgetName:string;amount:number;sourceFileName:string;evidenceType:'expense'|'receipt';receiptType?:string}
export interface CPATopicEvidence {topicId:number;suggestedAnswer:string;expenseTotal:number;receiptTotal:number;count:number;sourceIds:string[];rows:CPAEvidenceRow[];stillNeeded:string}
const sum=(rows:CPAEvidenceRow[])=>rows.reduce((n,row)=>n+Math.round(row.amount*100),0)/100;
const money=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
/** Recorded evidence only: no deduction, ownership, household or filing conclusions. */
export function buildCPAEvidence(imports:StatementImport[],accounts:Account[],spaces:{id:string;name:string}[],year:number){
 const range={start:`${year}-01-01`,end:`${year}-12-31`};
 const names=new Map(spaces.map(s=>[s.id,s.name]));
 // Preserve allocations to retired/unknown budgets rather than dropping their spending.
 for(const item of imports)for(const tx of item.transactions)for(const a of tx.splits.length?tx.splits:[{spaceId:tx.spaceId}])if(a.spaceId&&!names.has(a.spaceId))names.set(a.spaceId,'Unknown budget');
 const expenseRows:CPAEvidenceRow[]=[...names].flatMap(([id,name])=>actualTransactions(imports,year,1,id,range).filter(tx=>!tx.duplicate).map(tx=>({id:tx.id,statementId:tx.statementId,date:tx.date,description:tx.description,notes:tx.notes||'',category:tx.category||'Uncategorized',budgetId:id,budgetName:name,amount:tx.allocatedAmount,sourceFileName:tx.sourceFileName,evidenceType:'expense' as const})));
 const receipts:CPAEvidenceRow[]=[...names].flatMap(([id,name])=>bankCashFlow(imports,accounts,range,id).receiptRows.map(tx=>({id:tx.id,statementId:tx.statementId,date:tx.date,description:tx.description,notes:tx.notes||'',category:tx.category||'Uncategorized',budgetId:id,budgetName:name,amount:tx.allocatedAmount,sourceFileName:tx.sourceFileName,evidenceType:'receipt' as const,receiptType:tx.receiptType})));
 const text=(r:CPAEvidenceRow)=>`${r.description} ${r.category} ${r.notes}`.toLowerCase();
 const property=(r:CPAEvidenceRow)=>/tres\s*prop/i.test(r.budgetName);
 const byTopic:Record<number,CPAEvidenceRow[]>={
  1:receipts.filter(r=>['earned','tax_refund','insurance','investment','retirement','prize','bonus','financing'].includes(r.receiptType||'')),
  4:expenseRows.filter(r=>/\bmortgage\b|\bpnc\b.*\bmtg\b/.test(text(r))&&!/overdraft|late fee|returned payment/.test(text(r))),
  5:expenseRows.filter(r=>/\bproperty tax(?:es)?\b|\breal estate tax(?:es)?\b/.test(text(r))),
  6:expenseRows.filter(r=>property(r)&&/utilit|georgia power|scana|dte energy|repair|resurfac|home depot|lowe'?s|cabinet|floor.*decor|maintenance|cleaning|cleaners|greenpal|taskrabbit/.test(text(r))),
  7:expenseRows.filter(r=>/\bvehicle\b|\bauto insurance\b|\bkia\b|\balm roswell\b|\bcar purchase\b|\bregistration\b/.test(text(r))),
  8:expenseRows.filter(r=>/\bumes\b|\bmileage\b|\btesla\b.*\bsupercharger\b|\bbusiness trip\b/.test(text(r))),
  9:expenseRows.filter(r=>/\bcharit|\bdonation\b|\bchurch\b|\bunion dues\b|\bfraternity\b/.test(text(r))),
  10:expenseRows.filter(r=>/\bunreimbursed\b|\bwork attire\b|\bemployment training\b/.test(text(r))),
  11:expenseRows.filter(r=>/\bjob relocation\b|\bmoving expense\b/.test(text(r))),
  12:expenseRows.filter(r=>/\bcar purchase\b|\balm roswell\b|\bhome improvement\b|\bresurfac|\bcabinet|\bboat purchase\b|\brv purchase\b/.test(text(r))).concat(receipts.filter(r=>r.receiptType==='investment')),
  13:receipts.filter(r=>r.receiptType==='retirement').concat(expenseRows.filter(r=>/\b(?:ira|401k|401\(k\)) contribution\b/.test(text(r)))),
  14:expenseRows.filter(r=>/\btuition\b|\bstudent loan interest\b|\b1098[ -]?[et]\b/.test(text(r))),
  15:expenseRows.filter(r=>/\blegal (?:fee|expense|service)|\battorney\b|\blaw firm\b/.test(text(r))),
  16:expenseRows.filter(r=>/\bchildcare\b|\bchild care\b|\bdaycare\b|\bdependent care\b/.test(text(r))),
  18:expenseRows.filter(r=>/\bmedical\b|\bdental\b|\bpharmacy\b|\bhospital\b/.test(text(r))),
 };
 const caveats:Record<number,string>={1:'Obtain W-2 gross wages/withholding and applicable 1099s; bank receipts are not taxable-income determinations.',4:'Obtain Form 1098 and principal/interest/escrow breakdown; payments do not establish deductible interest.',5:'Confirm taxing authority, property, paid date and actual tax versus escrow.',6:'Confirm property use and separate utilities, repairs and capital improvements; merchant names alone do not establish purpose.',7:'Confirm vehicle ownership, purchase records, registration and personal/business use.',8:'Provide mileage, total annual miles, trip purpose and reimbursements; charging/travel records are not a mileage log.',12:'Confirm purchase/use, basis, sale proceeds and whether repairs must be capitalized.',13:'Obtain Form 1099-R/5498, gross distribution, withholding and rollover details; deposits may be net.'};
 const topics:Record<number,CPATopicEvidence>={};
 for(const topicId of topicIds){const rows=byTopic[topicId]||[],expenseTotal=sum(rows.filter(r=>r.evidenceType==='expense')),receiptTotal=sum(rows.filter(r=>r.evidenceType==='receipt')),stillNeeded=caveats[topicId]||'Review the topic checklist and confirm supporting records and personal circumstances with your CPA.';topics[topicId]={topicId,rows,count:rows.length,sourceIds:[...new Set(rows.map(r=>r.statementId))],expenseTotal,receiptTotal,stillNeeded,suggestedAnswer:rows.length?`Recorded ${year} evidence: ${rows.length} allocation${rows.length===1?'':'s'}${expenseTotal!==0?`; net expenses ${money(expenseTotal)}`:''}${receiptTotal!==0?`; receipts ${money(receiptTotal)}`:''}. These are review candidates, not confirmed deductions. ${stillNeeded}`:`No matching evidence identified in the imported ${year} records. This does not mean none exists. ${stillNeeded}`};}
 const categoryNames=[...new Set(expenseRows.map(r=>r.category))].sort();
 return {year,expenseRows,expenseTotal:sum(expenseRows),expenseCount:expenseRows.length,byBudget:[...names].map(([id,name])=>{const rows=expenseRows.filter(r=>r.budgetId===id);return{id,name,total:sum(rows),count:rows.length};}),byBudgetCategory:[...names].flatMap(([budgetId,budgetName])=>categoryNames.map(category=>{const rows=expenseRows.filter(r=>r.budgetId===budgetId&&r.category===category);return{budgetId,budgetName,category,total:sum(rows),count:rows.length};}).filter(r=>r.count>0)),byCategory:categoryNames.map(category=>{const rows=expenseRows.filter(r=>r.category===category);return{category,total:sum(rows),count:rows.length};}),byMonth:Array.from({length:12},(_,i)=>{const month=`${year}-${String(i+1).padStart(2,'0')}`,rows=expenseRows.filter(r=>r.date.startsWith(month));return{month,total:sum(rows),count:rows.length};}),topics,scopeNote:'Imported recorded spending only; manual entries are not included. Refunds reduce expenses. Topic evidence can overlap and must not be added together. Zero recorded amounts do not establish complete coverage.'};
}

export type CPAEvidence=ReturnType<typeof buildCPAEvidence>;
