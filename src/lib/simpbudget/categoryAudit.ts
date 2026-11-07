import type { StatementImport, StatementTransaction } from './statements';

export interface CategorySuggestion {
  id: string; statementId: string; transactionId: string; description: string;
  date: string; amount: number; current: string; proposed: string; explanation: string;
  source: string; signature: string;
}
const rules: { pattern: RegExp; category: string; explanation: string }[] = [
  { pattern: /\buber[\s*.-]*eats\b|\bubereats\b|\bdoordash\b|\bgrubhub\b/i, category: 'Food delivery', explanation: 'This is a food-delivery platform. The statement does not establish that the meal was fast food.' },
  { pattern: /\buber\b|\blyft\b/i, category: 'Rideshare', explanation: 'The merchant appears to be a rideshare service. Check the receipt if this was another service.' },
  { pattern: /\btesla\b.*\bsupercharger\b/i, category: 'Vehicle charging', explanation: 'Tesla Supercharger identifies vehicle charging rather than general travel.' },
  { pattern: /\binterest charge\b|\bcard interest\b/i, category: 'Interest', explanation: 'The description identifies interest. Keeping it separate makes financing costs easier to review.' },
  { pattern: /\bannual (?:membership )?fee\b|\blate fee\b|\boverdraft fee\b/i, category: 'Fees', explanation: 'The description identifies a fee rather than a purchase.' },
];
export function categoryAudit(imports: StatementImport[]): CategorySuggestion[] {
  return imports.filter(item => item.status === 'committed').flatMap(item => item.transactions.flatMap(tx => {
    if (!tx.reviewed || tx.excluded || tx.duplicate || !['expense', 'refund'].includes(tx.kind)) return [];
    if (/\buber[\s*.-]*(?:one|pass)\b/i.test(tx.description)) return [];
    const rule = rules.find(rule => rule.pattern.test(tx.description));
    if (!rule || (tx.category || '').trim().toLowerCase() === rule.category.toLowerCase()) return [];
    const signature = JSON.stringify([tx.description, tx.category || '', rule.category]);
    if (tx.categoryAuditDismissed === signature) return [];
    return [{ id: `${item.id}:${tx.id}`, statementId: item.id, transactionId: tx.id, description: tx.description,
      date: tx.date, amount: tx.amount, current: tx.category || 'Uncategorized', proposed: rule.category,
      explanation: rule.explanation, source: tx.sourceAccountName || item.fileName, signature }];
  })).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
export function applyCategorySuggestion(tx: StatementTransaction, suggestion: CategorySuggestion, action: 'accept'|'dismiss'): StatementTransaction {
  if (JSON.stringify([tx.description, tx.category || '', suggestion.proposed]) !== suggestion.signature) throw new Error('This transaction changed. Review the refreshed suggestion.');
  return action === 'accept' ? { ...tx, category: suggestion.proposed } : { ...tx, categoryAuditDismissed: suggestion.signature };
}

/** Prepare an all-or-nothing category change from fresh statement snapshots. */
export function applyCategoryAuditBatch(imports:StatementImport[], suggestions:CategorySuggestion[], action:'accept'|'dismiss') {
  const requested=new Map(suggestions.map(suggestion=>[suggestion.id,suggestion]));
  const currentSuggestions=new Map(categoryAudit(imports).map(suggestion=>[suggestion.id,suggestion]));
  for(const suggestion of requested.values()) {
    if(currentSuggestions.get(suggestion.id)?.signature!==suggestion.signature) throw new Error('A suggestion changed since this list loaded. Nothing was changed. Review the refreshed list and try again.');
  }
  return imports.filter(item=>[...requested.values()].some(suggestion=>suggestion.statementId===item.id)).map(item=>({...item,revision:(item.revision||0)+1,transactions:item.transactions.map(tx=>{
    const suggestion=requested.get(`${item.id}:${tx.id}`);
    return suggestion?applyCategorySuggestion(tx,suggestion,action):tx;
  })}));
}
