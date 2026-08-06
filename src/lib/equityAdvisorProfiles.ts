export interface ManagedAdvisorEquityProfile {
  canonicalName: string;
  numberOfOptions: number;
  fallbackExercisePrice: number;
}

const MANAGED_ADVISOR_EQUITY_PROFILES: Record<string, ManagedAdvisorEquityProfile> = {
  'valerie alexander': {
    canonicalName: 'Valerie Alexander',
    numberOfOptions: 25_000,
    fallbackExercisePrice: 0.05,
  },
  'marques zak': {
    canonicalName: 'Marques Zak',
    numberOfOptions: 25_000,
    fallbackExercisePrice: 0.05,
  },
};

export const normalizeAdvisorName = (name?: string | null) =>
  (name || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const getManagedAdvisorEquityProfile = (
  name?: string | null,
): ManagedAdvisorEquityProfile | null =>
  MANAGED_ADVISOR_EQUITY_PROFILES[normalizeAdvisorName(name)] || null;
