import { questionCustodian, validateSubmission } from './cau';

// Delivery and retention are separate decisions. This list never changes the
// clinical payload or the questionnaire's section membership.
export const RETENTION_VERSION = 'cau-private-retention-v1';
const operational = new Set([1,2,3,5,9,11,34,35,36,37,50,51,52,53,54,55,56,59,60,61]);
const externalOnly = new Set([12,13,19,20,26,30,39,49,57,58,62]);
export function retentionClass(id: string) {
  if (!/^cau-operational-\d{2}$/.test(id)) throw Error('Unknown question.');
  const n = Number(id.slice(-2));
  if (n < 1 || n > 62 || n === 4) throw Error('Unknown question.');
  return externalOnly.has(n) ? 'external-only' : operational.has(n) ? 'operational' : 'private-wellness';
}
// Invoke only server-side after choosing the policy. The browser cannot enable it.
export function retainedPrivateCopy(input: any, enabled: boolean) {
  if (!enabled) return {};
  const { fields } = validateSubmission(input);
  const retained = Object.fromEntries(Object.entries(fields).filter(([id]) =>
    questionCustodian(id) === 'auntEDNA' && retentionClass(id) !== 'external-only'));
  return { privateBaseline: {
    retentionVersion: RETENTION_VERSION,
    access: 'restricted-athlete-support',
    fields: retained,
  } };
}
export function liveRetentionEnabled(assignment: any, enabled: string | undefined) {
  return enabled === 'true' && assignment?.retentionPolicyVersion === RETENTION_VERSION;
}
