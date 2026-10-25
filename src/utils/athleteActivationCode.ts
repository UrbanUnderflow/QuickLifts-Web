/** Public team code is separate from the internal invitation identifier. */
export function athleteActivationCode(invite: { activationAliases?: unknown; activationCode?: unknown }): string {
  const aliases = Array.isArray(invite.activationAliases) ? invite.activationAliases : [];
  const valid = (value: unknown): value is string => typeof value === 'string' && /^[A-Z0-9_-]{4,32}$/i.test(value);
  const alias = aliases.find(valid);
  return alias ? alias.toUpperCase() : valid(invite.activationCode) ? invite.activationCode.toUpperCase() : '';
}
export function athleteActivationQrUrl(code: string, origin = 'https://fitwithpulse.ai'): string {
  if (!/^[A-Z0-9_-]{4,32}$/i.test(code)) throw new Error('A valid team activation code is required.');
  return `${origin.replace(/\/+$/, '')}/PulseCheck/team-invite/${encodeURIComponent(code.toUpperCase())}`;
}
