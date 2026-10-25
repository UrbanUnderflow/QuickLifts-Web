export type InstitutionOnboardingPolicy = { institutionalEmailRequired: boolean; approvedEmailDomains: string[]; audience: 'coaches' | 'coaches-and-athletes' };
export const defaultInstitutionPolicy: InstitutionOnboardingPolicy = { institutionalEmailRequired: false, approvedEmailDomains: [], audience: 'coaches' };
export function validateInstitutionPolicy(value: unknown): InstitutionOnboardingPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Choose valid onboarding settings.');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['institutionalEmailRequired','approvedEmailDomains','audience'].includes(k)) || typeof v.institutionalEmailRequired !== 'boolean' || !Array.isArray(v.approvedEmailDomains) || !['coaches','coaches-and-athletes'].includes(String(v.audience))) throw Error('Choose valid onboarding settings.');
  if (v.approvedEmailDomains.length > 20) throw Error('Use up to 20 approved email domains.');
  const domains = [...new Set(v.approvedEmailDomains.map(raw => {
    if (typeof raw !== 'string') throw Error('Enter email domains, such as school.edu.');
    const domain=raw.trim().toLowerCase();
    if (domain.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) throw Error('Use exact email domains, without @, wildcard, or web addresses.');
    return domain;
  }))];
  if (v.institutionalEmailRequired && !domains.length) throw Error('Add at least one approved institutional email domain.');
  return { institutionalEmailRequired: v.institutionalEmailRequired, approvedEmailDomains: domains, audience: v.audience as InstitutionOnboardingPolicy['audience'] };
}
export function policyApplies(policy: InstitutionOnboardingPolicy, role: string) {
  return policy.institutionalEmailRequired && (role === 'coach' || (policy.audience === 'coaches-and-athletes' && role === 'athlete'));
}
export class InstitutionPolicyError extends Error { readonly statusCode = 403; }
// Claims must come from a verified Firebase ID token, never profile/request fields.
export function enforceInstitutionPolicy(policy: InstitutionOnboardingPolicy, role: string, claims: {email?: string; email_verified?: boolean; phone_number?: string; firebase?: { sign_in_provider?: string }}) {
  if (!policyApplies(policy, role)) return;
  if (claims.firebase?.sign_in_provider === 'google.com') throw new InstitutionPolicyError('This institution requires institutional email and verified phone onboarding. Continue with your linked phone sign-in.');
  const email=(claims.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || !policy.approvedEmailDomains.includes(email.split('@')[1])) throw new InstitutionPolicyError('Use an email from an approved institutional domain.');
  if (claims.email_verified !== true) throw new InstitutionPolicyError('Verify ownership of your institutional email before joining.');
  if (!/^\+[1-9]\d{7,14}$/.test(claims.phone_number || '')) throw new InstitutionPolicyError('Verify your phone number on this same account before joining.');
}
