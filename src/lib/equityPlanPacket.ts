import {isEffectiveEip, resolveEquityPlan, type PlanDocument} from './equityPlanState';
import {isOutgoingEquityWorkspaceDocument} from './equityDocumentScope';

type PacketPlan = PlanDocument & {isAmendment?: boolean; exhibits?: string[]; archivedFromEquity?: boolean; equityDirection?: string};

// A reserve amendment does not contain the full plan. Preserve its approved
// source chain, and flag conflicting draft text without changing legal records.
export function resolveEquityPlanPacket<T extends PacketPlan>(documents: T[], now = Date.now()): {documents: T[]; issues: string[]} {
  const available = documents.filter(isOutgoingEquityWorkspaceDocument);
  const active = resolveEquityPlan(available, now).active;
  if (!active) return {documents: [], issues: ['An effective Equity Incentive Plan is required.']};
  const selected = new Map<string, T>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const issues: string[] = [];
  const visit = (id: string) => {
    if (visiting.has(id)) {issues.push('The EIP source links contain a cycle. Review the plan records.'); return;}
    if (visited.has(id)) return;
    const plan = available.find(item => item.id === id && item.documentType === 'eip');
    if (!plan) {issues.push('A linked EIP source document is missing. Restore the full plan before sending.'); return;}
    visiting.add(id);
    const parents = [...new Set([plan.originalDocumentId, plan.sourceDocumentId, ...(plan.exhibits || []).filter(exhibit => available.some(item => item.id === exhibit && item.documentType === 'eip'))].filter((parent): parent is string => Boolean(parent)))];
    parents.forEach(visit);
    if (!parents.length && (plan.isAmendment || /\bamendment\b/i.test(plan.title || ''))) issues.push('The EIP amendment must be linked to its full original plan.');
    if (!isEffectiveEip(plan, now)) {
      issues.push(`${plan.title || 'EIP'}: approval and effectiveness must be recorded before sending.`);
    } else if (/\bdraft\b/i.test(plan.title || '') || /^\s*\**(?:DRAFT\s*[-–—:]?\s*(?:FOR REVIEW|NOT APPROVED)|.*UNSIGNED AND NOT EFFECTIVE)/im.test(plan.content || '')) {
      issues.push(`${plan.title || 'EIP'}: the approval record conflicts with draft wording. Reconcile the saved document and approval evidence before a new send.`);
    } else if (!plan.content?.trim()) {
      issues.push(`${plan.title || 'EIP'}: the full document text is missing.`);
    } else {
      selected.set(plan.id, plan);
    }
    visiting.delete(id);
    visited.add(id);
  };
  visit(active.id);
  return {documents: [...selected.values()], issues: [...new Set(issues)]};
}
