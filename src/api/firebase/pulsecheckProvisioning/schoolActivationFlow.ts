/** Use persisted organization scope, never the installed app brand or caller flags. */
export const SCHOOL_ACTIVATION_FLOW_VERSION = 'school-activation-v1' as const;
export function resolveSchoolActivationFlow(input: { productBrand?: unknown; role?: unknown }): boolean {
  return input.productBrand === 'athleticmind' && input.role === 'athlete';
}

/** Contact details are collected separately from the account's sign-in identity. */
export function validInstitutionalEmail(value: unknown): boolean {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('@privaterelay.appleid.com');
}
export function schoolContactComplete(value: { institutionalEmail?: unknown; phone?: unknown }): boolean {
  return validInstitutionalEmail(value.institutionalEmail) && typeof value.phone === 'string' && /^\+[1-9]\d{9,14}$/.test(value.phone.trim());
}
