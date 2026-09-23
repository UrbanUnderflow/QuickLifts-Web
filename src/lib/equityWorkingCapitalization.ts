import type { Timestamp } from 'firebase/firestore';

export interface WorkingAllocation {
  id: string;
  name: string;
  kind: 'options' | 'vesting_shares' | 'warrant' | 'other';
  percentage: number | null;
  shares: number | null;
  notes: string;
}

export interface WorkingCapitalization {
  founderShares: number | null;
  strategicReserve: number | null;
  allocations: WorkingAllocation[];
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface WorkingCapitalizationHistory extends WorkingCapitalization {
  sourcePlanId?: string;
  replacedAt: Timestamp;
  replacedBy: string;
}

export interface WorkingCapitalizationRecord {
  documentType?: string;
  createdAt?: Timestamp;
  sourcePlanId?: string;
  workingCapitalization?: WorkingCapitalization;
  workingCapitalizationHistory?: WorkingCapitalizationHistory[];
}

export const workingSetupBaseline = (value?: WorkingCapitalization) => JSON.stringify(value || null);

export function validateWorkingCapitalization(setup: WorkingCapitalization): void {
  const validShares = (value: number | null) => value === null || (Number.isSafeInteger(value) && value >= 0);
  const ids = new Set(setup.allocations.map(row => row.id));
  if (!validShares(setup.founderShares) || !validShares(setup.strategicReserve) || ids.size !== setup.allocations.length || setup.allocations.some(row =>
    !row.id || !row.name.trim() || !['options', 'vesting_shares', 'warrant', 'other'].includes(row.kind) || !validShares(row.shares)
    || (row.percentage !== null && (!Number.isFinite(row.percentage) || row.percentage < 0 || row.percentage > 100)))) {
    throw new Error('Enter a name for each allocation, whole nonnegative share counts, and percentages from 0 to 100.');
  }
}

export function restoreWorkingCapitalization(entry: WorkingCapitalization): WorkingCapitalization {
  return {
    founderShares: entry.founderShares,
    strategicReserve: entry.strategicReserve,
    allocations: entry.allocations.map(row => ({ id: row.id, name: row.name, kind: row.kind, percentage: row.percentage, shares: row.shares, notes: row.notes })),
  };
}

/** Returns only working-record fields. The caller writes to the separate setup document. */
export function buildWorkingCapitalizationSave(options: {
  current?: WorkingCapitalizationRecord;
  baseline: string;
  setup: WorkingCapitalization;
  sourcePlanId: string;
  sourcePlan: { documentType?: string; status?: string } | undefined;
  uid: string;
  now: Timestamp;
}) {
  const { current, setup, sourcePlanId, sourcePlan, uid, now } = options;
  if (!uid) throw new Error('Sign in before saving the working setup.');
  if (!sourcePlanId || sourcePlan?.status !== 'completed' || sourcePlan.documentType !== 'eip') throw new Error('This completed plan is no longer available.');
  if (current && current.documentType !== 'capitalization_working_setup') throw new Error('The working setup record needs review.');
  if (workingSetupBaseline(current?.workingCapitalization) !== options.baseline) {
    throw new Error('The working setup changed while you were editing. Close and reopen it to load the latest entries.');
  }
  validateWorkingCapitalization(setup);
  const priorHistory = current?.workingCapitalizationHistory || [];
  const history = current?.workingCapitalization
    ? [...priorHistory, { ...current.workingCapitalization, ...(current.sourcePlanId ? { sourcePlanId: current.sourcePlanId } : {}), replacedAt: now, replacedBy: uid }]
    : [...priorHistory];
  return {
    documentType: 'capitalization_working_setup', title: 'Working capitalization', status: 'completed',
    requiresSignature: false, content: '', createdAt: current?.createdAt || now, updatedAt: now, sourcePlanId,
    workingCapitalization: {
      ...restoreWorkingCapitalization(setup),
      allocations: restoreWorkingCapitalization(setup).allocations.map(row => ({ ...row, name: row.name.trim(), notes: row.notes.trim() })),
      updatedAt: now, updatedBy: uid,
    },
    workingCapitalizationHistory: history,
  };
}
