import type { Account, StatementImport, StatementTransaction } from './statements';
export const receiptLabels = { earned:'Earned income', tax_refund:'Tax refund', insurance:'Insurance payout', investment:'Investment withdrawal', retirement:'Retirement withdrawal', reimbursement:'Reimbursement', prize:'Prize', bonus:'Bonus', financing:'Financing', other:'Other receipts' } as const;
export type ReceiptType = keyof typeof receiptLabels;
export type ReceiptRow = StatementTransaction & { statementId:string; allocatedAmount:number; receiptType:ReceiptType; sourceFileName:string };
/** Bank cash movements only. Card purchases belong in spending, not cash flow. */
export function bankCashFlow(imports:StatementImport[],accounts:Account[],range:{start:string;end:string},spaceId:string) {
  let earned=0,other=0,outgoing=0,unassigned=0; const receiptRows:ReceiptRow[]=[];
  const accountTypes=new Map(accounts.map(account=>[account.id,account.type]));
  for(const item of imports) {
    if(item.status!=='committed')continue;
    for(const tx of item.transactions) {
      if(tx.date<range.start||tx.date>range.end||!tx.reviewed||tx.duplicate||tx.cashFlowExcluded||!Number.isFinite(tx.amount))continue;
      if((tx.sourceAccountType||accountTypes.get(tx.sourceAccountId||item.accountId))!=='bank')continue;
      // Explicit receipt metadata can explain transfers excluded from spending.
      if(!tx.receiptType&&tx.cashFlowExcluded!==false&&(tx.kind==='transfer'||(tx.excluded&&tx.kind!=='card_payment')))continue;
      const allocations=tx.splits.length?tx.splits:[{spaceId:tx.spaceId,amount:tx.amount}];
      if(!tx.splits.length&&!tx.spaceId)unassigned++;
      const amount=allocations.filter(a=>spaceId==='all'||a.spaceId===spaceId).reduce((sum,a)=>sum+Math.round(a.amount*100),0);
      if(amount<0) {
        const type=tx.receiptType||(tx.kind==='income'?'earned':'other');
        if(type==='earned')earned-=amount; else other-=amount;
        receiptRows.push({...tx,receiptType:type,statementId:item.id,allocatedAmount:-amount/100,sourceFileName:tx.sourceFileName||item.fileName});
      } else outgoing+=amount;
    }
  }
  receiptRows.sort((a,b)=>b.date.localeCompare(a.date));
  return {earned:earned/100,other:other/100,totalReceived:(earned+other)/100,outgoing:outgoing/100,net:(earned+other-outgoing)/100,receiptRows,earnedRows:receiptRows.filter(row=>row.receiptType==='earned'),otherRows:receiptRows.filter(row=>row.receiptType!=='earned'),unassigned};
}

/** Displayed receipts and spending use the same budget/date scope; manual entries are monthly only. */
export function spendingSummary(bank:{totalReceived:number;earned:number;other:number}, spending:number, manual:{income:number;spending:number}, includeManual:boolean) {
  const cents=(value:number)=>Math.round(value*100);
  const received=cents(bank.totalReceived)+(includeManual?cents(manual.income):0);
  const spent=cents(spending)+(includeManual?cents(manual.spending):0);
  return {received:received/100,earned:(cents(bank.earned)+(includeManual?cents(manual.income):0))/100,other:bank.other,spent:spent/100,net:(received-spent)/100};
}
