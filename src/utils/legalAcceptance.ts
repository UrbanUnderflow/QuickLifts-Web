export const CURRENT_TERMS_VERSION = '2026-04-08';
export const CURRENT_PRIVACY_VERSION = '2026-04-08';
export const TERMS_PATH = '/terms';
export const PRIVACY_POLICY_PATH = '/privacy';

export interface LegalAcceptanceRecord {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: Date | null;
  acceptanceMethod: string;
  termsPath: string;
  privacyPath: string;
}

export const buildCurrentLegalAcceptance = (
  acceptanceMethod: string,
  acceptedAt: Date = new Date()
): LegalAcceptanceRecord => ({
  termsVersion: CURRENT_TERMS_VERSION,
  privacyVersion: CURRENT_PRIVACY_VERSION,
  acceptedAt,
  acceptanceMethod,
  termsPath: TERMS_PATH,
  privacyPath: PRIVACY_POLICY_PATH,
});

export const hasAcceptedCurrentLegal = (
  user: { legalAcceptance?: Partial<LegalAcceptanceRecord> | null } | null | undefined
): boolean => {
  const legalAcceptance = user?.legalAcceptance;

  return Boolean(
    legalAcceptance?.acceptedAt &&
      legalAcceptance.termsVersion === CURRENT_TERMS_VERSION &&
      legalAcceptance.privacyVersion === CURRENT_PRIVACY_VERSION
  );
};
