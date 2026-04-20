import type { User } from './types';

export const ROOT_USER_PROTECTED_FIELDS = [
  'id',
  'email',
  'username',
  'displayName',
  'birthdate',
  'createdAt',
  'profileImage',
  'registrationComplete',
  'didCompleteProfileQuiz',
  'legalAcceptance',
  'lifetimePulsePoints',
  'categoryPoints',
  'level',
  'creator',
] as const;

export type RootUserProtectedField = typeof ROOT_USER_PROTECTED_FIELDS[number];

export type UserWritePatch = Record<string, unknown>;

type DictionaryLike = {
  toDictionary?: () => Record<string, unknown>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

export const isUserDictionaryLike = (value: unknown): value is User | DictionaryLike => {
  return !!value && typeof value === 'object' && typeof (value as DictionaryLike).toDictionary === 'function';
};

const stripUndefinedDeep = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined);
  }

  if (value instanceof Date) {
    return value;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    const sanitized = stripUndefinedDeep(entry);
    if (sanitized !== undefined) {
      acc[key] = sanitized;
    }
    return acc;
  }, {});
};

export const normalizeUserCreatePayload = (value: User | UserWritePatch): Record<string, unknown> => {
  const rawPayload = isUserDictionaryLike(value)
    ? (value as DictionaryLike).toDictionary?.() ?? {}
    : value;

  return stripUndefinedDeep(rawPayload) as Record<string, unknown>;
};

export const normalizeUserPatch = (patch: UserWritePatch): Record<string, unknown> => {
  return stripUndefinedDeep(patch) as Record<string, unknown>;
};
