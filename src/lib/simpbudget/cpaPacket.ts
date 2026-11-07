import { bankCashFlow,receiptLabels } from './cashFlow';
import {buildCPAEvidence} from './cpaEvidence';
import { type Account, type StatementImport } from './statements';
export type IntakeAnswer = {status:'missing'|'provided'|'not_applicable';answer:string};
export type CPADraft = {states:string[];answers:Record<string,IntakeAnswer>;revision:number};
export const cpaChecklist = [
 [1,'Income forms and identity','W-2s and every applicable 1099. Provide SSN and date of birth directly to your CPA through their secure channel; do not enter them here.'],
 [2,'Spouse and dependents','Record household relationships and relevant changes. Names, SSNs and dates of birth belong in the CPA’s secure intake.'],
 [3,'Contact information','Confirm that your CPA has your current phone number and contact information.'],
 [4,'Housing','Rent or ownership, address, landlord, monthly rent and deposit records; mortgage Form 1098, principal, interest, escrow, insurance and closing statement. These amounts have different tax treatment.'],
 [5,'Property taxes','Property tax bills and amounts paid, with property and payment dates.'],
 [6,'Other property','For rental or other non-primary property: income, improvements, utilities, maintenance and replacements. Identify repairs separately from improvements for CPA review.'],
 [7,'Vehicles','Make/model, purchase documents and registration or renewal statements.'],
 [8,'Business vehicle use','Mileage log with dates, destinations and business purpose, total annual mileage and related receipts.'],
 [9,'Dues, gifts and loans','Union/fraternity dues, charitable or church gifts and acknowledgments, and unpaid personal loan documents. Do not assume these all qualify for a deduction.'],
 [10,'Employment expenses','Unreimbursed work clothing, training and supplies; identify employment versus self-employment and any reimbursements.'],
 [11,'Moving','Moving dates, reason, employment details and receipts for eligibility review.'],
 [12,'Large purchases and investments','Boat, RV, car, property and major improvement purchase/sale documents, dates, use and cost basis.'],
 [13,'Retirement','IRA/401(k) contributions, distributions, rollovers and Forms 1099-R/5498. Bank deposits do not establish taxable distributions.'],
 [14,'Education','School/provider, tuition and other payments, loans and interest, Forms 1098-T/1098-E for the selected year.'],
 [15,'Legal expenses','Invoices and purpose of legal services; separate personal and business matters.'],
 [16,'Dependent care','Provider details, amounts and care dates; send sensitive provider tax IDs securely to your CPA.'],
 [18,'Medical expenses','Unreimbursed medical expenses, insurance reimbursements and records for eligibility review.'],
 [19,'Identity verification','Provide photo ID and any e-file identity verification directly through your CPA’s secure process. Do not upload ID or full tax identifiers here.'],
] as const;
export const emptyCPADraft=():CPADraft=>({states:[],answers:{},revision:0});
export const cpaReferences=[
 ['IRS tax preparation checklist','https://www.irs.gov/individuals/checklist-for-free-tax-return-preparation'],
 ['IRS homeowner records and expenses','https://www.irs.gov/publications/p530'],
 ['IRS travel and vehicle records','https://www.irs.gov/publications/p463'],
 ['IRS medical expenses','https://www.irs.gov/publications/p502'],
];
export function csvCell(value:unknown):string {
 if(typeof value==='number')return Number.isFinite(value)?String(value):'';
 let text=String(value??'');
 if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
export const csv=(rows:unknown[][])=>'\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
export interface OriginalDocument {statementId:string;role:string;fileName:string;mimeType:string;size:number;sha256:string;attachedAt?:string}
export function buildCPAPacket(imports:StatementImport[],accounts:Account[],spaces:{id:string;name:string}[],year:number,now=new Date()) {
 const range={start:`${year}-01-01`,end:`${year}-12-31`};
 const today=now.toISOString().slice(0,10);
 const rows=imports.flatMap(item=>item.transactions.filter(tx=>tx.date>=range.start&&tx.date<=range.end).map(tx=>({item,tx})));
 const sources=imports.filter(item=>rows.some(row=>row.item.id===item.id)||item.fileName.includes(String(year)));
 const evidence=buildCPAEvidence(imports,accounts,spaces,year);
 const budgets=evidence.byBudget.map(space=>{const cash=bankCashFlow(imports,accounts,range,space.id);const spent=space.total;return {id:space.id,name:space.name,received:cash.totalReceived,earned:cash.earned,other:cash.other,spent,net:Math.round((cash.totalReceived-spent)*100)/100,bankOutgoing:cash.outgoing,bankNet:cash.net};});
 const cash=bankCashFlow(imports,accounts,range,'all');
 const receiptSummary=Object.entries(receiptLabels).map(([type,label])=>({type,label,count:cash.receiptRows.filter(row=>row.receiptType===type).length,total:cash.receiptRows.filter(row=>row.receiptType===type).reduce((sum,row)=>sum+Math.round(row.allocatedAmount*100),0)/100})).filter(row=>row.count);
 const expenseCategories=csv([['Budget','Budget ID','Category','Net expense amount','Allocations'],...evidence.byBudgetCategory.map(row=>[row.budgetName,row.budgetId,row.category,row.total,row.count])]);
 const monthlyExpenses=csv([['Month','Net expense amount','Allocations'],...evidence.byMonth.map(row=>[row.month,row.total,row.count])]);
 const receipts=csv([['Receipt type','Recorded amount','Transactions'],...receiptSummary.map(row=>[row.label,row.total,row.count])]);
 const topicEvidence=csv([['Checklist topic ID','Statement ID','Transaction ID','Date','Description','Budget','Category','Evidence type','Amount','Source file','Notes'],...Object.values(evidence.topics).flatMap(topic=>topic.rows.map(row=>[topic.topicId,row.statementId,row.id,row.date,row.description,row.budgetName,row.category,row.evidenceType,row.amount,row.sourceFileName,row.notes]))]);
 const ledger=csv([['Statement ID','Transaction ID','Date','Description','Signed amount (expense positive)','Kind','Receipt type','Budget ID','Splits (signed amounts)','Category','Notes','Account ID','Account name','Account type','Source file','Source row','Import status','Reviewed','Excluded from spending','Duplicate','Excluded from cash flow','Review reason'],...rows.map(({item,tx})=>[item.id,tx.id,tx.date,tx.description,tx.amount,tx.kind,tx.receiptType||'',tx.spaceId,JSON.stringify(tx.splits),tx.category||'',tx.notes||'',tx.sourceAccountId||item.accountId,tx.sourceAccountName||accounts.find(a=>a.id===item.accountId)?.name||'',tx.sourceAccountType||accounts.find(a=>a.id===item.accountId)?.type||'',tx.sourceFileName||item.fileName,tx.sourceRow,item.status,tx.reviewed,tx.excluded,tx.duplicate,tx.cashFlowExcluded??'',tx.reason])]);
 const flags=[
 'Preparation packet only; taxability and deductibility have not been determined. Manual monthly budget entries and plans are not included in this imported-transaction export.',
 'Earned receipts may include net payroll deposits. Obtain W-2 gross wages and withholding; do not treat bank deposits as W-2 wages.',
 'Obtain 1099-R and rollover details for retirement withdrawals; obtain 1099-B and cost basis for investments. Insurance payouts require settlement and loss documentation.',
 'Obtain mortgage 1098 and property records. Principal, personal home insurance and personal utilities are not generally deductible; repairs and improvements need separate review.',
 'Statement coverage below reflects available imports and observed transaction dates, not verified account opening dates or complete annual coverage.',
 ...(year>=now.getUTCFullYear()?['The selected tax year is still in progress or in the future. This is not a filing-ready annual packet.']:[]),
 ...(rows.some(({tx})=>tx.date>today)?['Future-dated transactions are included and require review.']:[]),
 ...(rows.some(({item})=>item.status!=='committed')?['Review or undone imports appear in the ledger for audit, but are excluded from summary totals.']:[]),
 ...(cash.unassigned?[`${cash.unassigned} bank transactions have no budget assignment. All-account cash totals may exceed budget totals.`]:[]),
 ];
 return {year,today,range,rows,sources,budgets,cash,ledger,flags,evidence,expenseCategories,monthlyExpenses,receipts,receiptSummary,topicEvidence};
}
export type CPAPacket=ReturnType<typeof buildCPAPacket>;
export function sourceManifest(packet:CPAPacket,documents:OriginalDocument[],includedIds:string[]=[]) {
 return csv([['Statement ID','Account ID','Import file','Status','Observed first date','Observed last date','All statement rows','Selected-year rows','Opening balance','Closing balance','Signed transaction sum (all dates)','Original file','Original bytes','Original SHA256','Original included in ZIP'],...packet.sources.map(item=>{const dates=item.transactions.map(tx=>tx.date).filter(Boolean).sort();const original=documents.find(d=>d.statementId===item.id&&d.role==='original');return [item.id,item.accountId,item.fileName,item.status,dates[0]||'',dates.at(-1)||'',item.transactions.length,packet.rows.filter(r=>r.item.id===item.id).length,item.openingBalance??'',item.closingBalance??'',item.transactions.reduce((s,t)=>s+Math.round(t.amount*100),0)/100,original?.fileName||'Not attached',original?.size||'',original?.sha256||'',includedIds.includes(item.id)];})]);
}
