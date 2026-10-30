const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const email = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value)) ? text(value).toLowerCase() : '';
const phone = (value: unknown) => /^\+[1-9]\d{7,14}$/.test(text(value)) ? text(value) : '';
/** Auth claims were verified server-side; membership must come from the validated assignment scope. */
export function baselineAccountIdentity(auth: any, profile: any, member?: any) {
  return {
    name: text(member?.athleteOnboarding?.entryOnboardingName) || text(profile?.preferredName) || text(profile?.displayName) || text(auth?.name),
    email: email(auth?.email),
    phone: phone(auth?.phone_number),
  };
}
export function bindBaselineAccountIdentity(input: any, identity: ReturnType<typeof baselineAccountIdentity>) {
  return { ...input, name: identity.name || input?.name, email: identity.email || (identity.phone ? '' : input?.email), phone: identity.phone };
}
