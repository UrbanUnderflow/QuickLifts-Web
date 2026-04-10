export const CURRENT_TERMS_VERSION = '2026-04-08';
export const CURRENT_PRIVACY_VERSION = '2026-04-08';
export const TERMS_PATH = '/terms';
export const PRIVACY_POLICY_PATH = '/privacy';
const LEGAL_ACCEPTANCE_CACHE_PREFIX = 'pulse-current-legal-acceptance:';

export interface LegalAcceptanceRecord {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: Date | null;
  acceptanceMethod: string;
  termsPath: string;
  privacyPath: string;
}

const normalizeAcceptedAt = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value < 10_000_000_000 ? value * 1000 : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const isCurrentAcceptanceRecord = (
  legalAcceptance?: Partial<LegalAcceptanceRecord> | null
): boolean =>
  Boolean(
    normalizeAcceptedAt(legalAcceptance?.acceptedAt) &&
      legalAcceptance?.termsVersion === CURRENT_TERMS_VERSION &&
      legalAcceptance?.privacyVersion === CURRENT_PRIVACY_VERSION
  );

const resolveAcceptanceCacheKey = (userId: string) =>
  `${LEGAL_ACCEPTANCE_CACHE_PREFIX}${userId}`;

const canUseBrowserStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

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

export const readCachedLegalAcceptance = (
  userId: string | null | undefined
): LegalAcceptanceRecord | null => {
  if (!userId || !canUseBrowserStorage()) return null;

  try {
    const raw = window.localStorage.getItem(resolveAcceptanceCacheKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LegalAcceptanceRecord> & {
      acceptedAt?: string | number | Date | null;
    };
    return {
      termsVersion: parsed.termsVersion ?? '',
      privacyVersion: parsed.privacyVersion ?? '',
      acceptedAt: normalizeAcceptedAt(parsed.acceptedAt),
      acceptanceMethod: parsed.acceptanceMethod ?? '',
      termsPath: parsed.termsPath ?? TERMS_PATH,
      privacyPath: parsed.privacyPath ?? PRIVACY_POLICY_PATH,
    };
  } catch (error) {
    console.warn('[legalAcceptance] Failed to read cached legal acceptance', error);
    return null;
  }
};

export const cacheLegalAcceptance = (
  userId: string | null | undefined,
  legalAcceptance: Partial<LegalAcceptanceRecord> | null | undefined
) => {
  if (!userId || !legalAcceptance || !canUseBrowserStorage()) return;

  const normalizedAcceptedAt = normalizeAcceptedAt(legalAcceptance.acceptedAt);
  if (!normalizedAcceptedAt) return;

  try {
    window.localStorage.setItem(
      resolveAcceptanceCacheKey(userId),
      JSON.stringify({
        termsVersion: legalAcceptance.termsVersion ?? '',
        privacyVersion: legalAcceptance.privacyVersion ?? '',
        acceptedAt: normalizedAcceptedAt.toISOString(),
        acceptanceMethod: legalAcceptance.acceptanceMethod ?? '',
        termsPath: legalAcceptance.termsPath ?? TERMS_PATH,
        privacyPath: legalAcceptance.privacyPath ?? PRIVACY_POLICY_PATH,
      })
    );
  } catch (error) {
    console.warn('[legalAcceptance] Failed to cache legal acceptance', error);
  }
};

export const cacheCurrentLegalAcceptance = (
  userId: string | null | undefined,
  acceptanceMethod: string,
  acceptedAt: Date = new Date()
) => {
  cacheLegalAcceptance(userId, buildCurrentLegalAcceptance(acceptanceMethod, acceptedAt));
};

export const hasAnyRecordedLegalAcceptance = (
  user: { id?: string; legalAcceptance?: Partial<LegalAcceptanceRecord> | null } | null | undefined,
  options?: { userId?: string | null; includeLocalCache?: boolean }
): boolean => {
  const userId = options?.userId ?? user?.id ?? null;
  const includeLocalCache = options?.includeLocalCache ?? true;

  if (normalizeAcceptedAt(user?.legalAcceptance?.acceptedAt)) {
    return true;
  }

  if (!includeLocalCache) {
    return false;
  }

  return Boolean(normalizeAcceptedAt(readCachedLegalAcceptance(userId)?.acceptedAt));
};

export const hasAcceptedCurrentLegal = (
  user: { id?: string; legalAcceptance?: Partial<LegalAcceptanceRecord> | null } | null | undefined,
  options?: { userId?: string | null; includeLocalCache?: boolean }
): boolean => {
  const userId = options?.userId ?? user?.id ?? null;
  const includeLocalCache = options?.includeLocalCache ?? true;

  if (isCurrentAcceptanceRecord(user?.legalAcceptance)) {
    return true;
  }

  if (!includeLocalCache) {
    return false;
  }

  return isCurrentAcceptanceRecord(readCachedLegalAcceptance(userId));
};
