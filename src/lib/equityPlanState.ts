import { EipVersionReference, isApprovedEip } from './eipVersions';

export interface PlanDocument extends EipVersionReference {
  title?: string;
  content?: string;
  effectiveAt?: unknown;
  createdAt?: unknown;
}

function time(value: any): number {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds !== undefined) return value.seconds * 1000;
  return value ? new Date(value).getTime() : NaN;
}

export function isEffectiveEip(plan: PlanDocument, now = Date.now()): boolean {
  if (!isApprovedEip(plan)) return false;
  // Preserve legacy adopted plans. New versions require a recorded effective date.
  if (!plan.approvalStatus && !plan.originalDocumentId && (plan.autoSigned || plan.autoSignedAt)) return true;
  const effective = time(plan.effectiveAt);
  return Number.isFinite(effective) && effective <= now;
}

export function readPlanReserve(content = ''): number | null {
  const text = content.replace(/^\s*>\s?/gm, '').replace(/\*\*/g, '');
  const section = text.match(/^#{1,6}\s+3\.1\s+Share Reserve\s*$([\s\S]*?)(?=^#{1,6}\s|$(?![\s\S]))/m)?.[1];
  if (!section) return null;
  const matches = [...section.matchAll(/maximum number of shares[\s\S]*?shall be\s+([\d,]+)\s+shares/gi)];
  if (matches.length !== 1) return null;
  const count = Number(matches[0][1].replace(/,/g, ''));
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function resolveEquityPlan(documents: PlanDocument[], now = Date.now()) {
  const plans = documents.filter(d => d.documentType === 'eip' && d.status === 'completed');
  const effective = plans.filter(d => isEffectiveEip(d, now)).sort((a, b) =>
    (time(b.effectiveAt) || 0) - (time(a.effectiveAt) || 0) || (b.versionNumber || 1) - (a.versionNumber || 1));
  const active = effective[0];
  const pending = plans.filter(d => !isEffectiveEip(d, now)).sort((a, b) =>
    (time(b.createdAt) || 0) - (time(a.createdAt) || 0) || (b.versionNumber || 1) - (a.versionNumber || 1))[0];
  const reserve = active ? readPlanReserve(active.content) : null;
  const issue = !active ? 'No effective EIP is recorded.' : reserve === null
    ? 'The effective EIP reserve needs review. Open the plan before allocating more awards.' : null;
  return { active, pending, reserve, proposedReserve: pending ? readPlanReserve(pending.content) : null, issue };
}

export interface WorkingEquityPlan {
  plan: PlanDocument | undefined;
  reserve: number | null;
  isEffective: boolean;
}

/** Latest saved setup for planning displays. Issuance must use resolveEquityPlan. */
export function resolveWorkingEquityPlan(documents: PlanDocument[], now = Date.now()): WorkingEquityPlan {
  const timestamp = (value: unknown) => {
    const result = time(value);
    return Number.isFinite(result) ? result : 0;
  };
  const plan = documents.filter(d => d.documentType === 'eip' && d.status === 'completed')
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)
      || (b.versionNumber || 1) - (a.versionNumber || 1)
      || a.id.localeCompare(b.id))[0];
  return {
    plan,
    reserve: plan ? readPlanReserve(plan.content) : null,
    isEffective: plan ? isEffectiveEip(plan, now) : false,
  };
}

export interface EquityHolding {
  type: string;
  sharesOwned?: number;
  totalShares?: number;
  optionsGranted?: number;
  optionsExercised?: number;
  isReservedPool?: boolean;
  grants?: Array<{ numberOfShares: number; equityType: string; status: string; reserveSource?: string; exercisedShares?: number; releasedShares?: number }>;
}

export function issuedShares(holder: EquityHolding): number {
  if (holder.isReservedPool) return 0;
  if (holder.sharesOwned !== undefined) return holder.sharesOwned;
  return ['founder', 'investor'].includes(holder.type) ? holder.totalShares || 0 : holder.optionsExercised || 0;
}

export function deriveEquityBalances(holders: EquityHolding[], reserve: number | null, exercised: number, authorized: number) {
  const issued = holders.reduce((sum, h) => sum + issuedShares(h), 0);
  const participants = holders.filter(h => !h.isReservedPool && ['advisor', 'employee', 'contractor'].includes(h.type));
  const recordedCommitments = participants.reduce((sum, h) => {
    const grants = h.grants?.filter(g => g.reserveSource !== 'strategic');
    return sum + (h.grants?.length ? (grants || []).reduce((n, g) => n +
      (g.numberOfShares - Math.min(Math.max(0, g.releasedShares || 0), Math.max(0, g.numberOfShares - (g.exercisedShares || 0)))), 0)
      : (h.optionsGranted ?? h.totalShares ?? 0));
  }, 0);
  const recordedPlanIssued = participants.reduce((sum, h) => {
    const stockAwards = h.grants?.filter(g => g.reserveSource !== 'strategic' && !['iso', 'nso'].includes(g.equityType))
      .reduce((n, g) => n + g.numberOfShares, 0) || 0;
    return sum + Math.min(issuedShares(h), (h.optionsExercised || 0) + stockAwards);
  }, 0);
  const planIssued = Math.max(exercised, recordedPlanIssued);
  const committed = Math.max(recordedCommitments, planIssued);
  // optionsGranted is cumulative. Exercise consumes the same award, not another allocation.
  const outstanding = Math.max(0, committed - planIssued);
  const available = reserve === null ? null : reserve - committed;
  const unissuedReserve = reserve === null ? null : Math.max(0, reserve - planIssued);
  const unallocated = unissuedReserve === null ? null : authorized - issued - unissuedReserve;
  return { issued, committed, outstanding, available, unissuedReserve, unallocated, planIssued };
}
