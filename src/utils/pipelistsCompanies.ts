export const APPLICABLE_COMPANIES = ['PIL', 'AthleticMind', 'ATHLeda', 'AuntEdna'] as const;
export type ApplicableCompany = typeof APPLICABLE_COMPANIES[number];

/** Explicit assignments only: legacy, malformed and unknown values are unassigned. */
export function normalizeApplicableCompanies(value: unknown): ApplicableCompany[] {
  if (!Array.isArray(value)) return [];
  return APPLICABLE_COMPANIES.filter(company => value.includes(company));
}

export function matchesApplicableCompany(value: unknown, filter: string): boolean {
  const companies = normalizeApplicableCompanies(value);
  return !filter || (filter === 'unassigned' ? companies.length === 0 : companies.some(company => company === filter));
}
