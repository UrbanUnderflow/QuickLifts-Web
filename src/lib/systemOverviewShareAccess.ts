import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const PASSCODE_KEY_LENGTH = 64;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const COOKIE_NAME_PREFIX = 'pc_so_share_';

const getCookieSecret = () =>
  process.env.SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'development-system-overview-share-secret';

const normalizePasscode = (value: string) => value.trim().toUpperCase();

const signValue = (value: string) =>
  createHmac('sha256', getCookieSecret()).update(value).digest('hex');

export const getSystemOverviewShareCookieName = (token: string) => `${COOKIE_NAME_PREFIX}${token}`;

export const createPasscodeHash = (passcode: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(normalizePasscode(passcode), salt, PASSCODE_KEY_LENGTH).toString('hex');
  return { salt, hash };
};

export const verifyPasscodeHash = (passcode: string, salt: string, expectedHash: string) => {
  if (!salt || !expectedHash) return false;

  const computed = new Uint8Array(scryptSync(normalizePasscode(passcode), salt, PASSCODE_KEY_LENGTH));
  const expected = new Uint8Array(Buffer.from(expectedHash, 'hex'));
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
};

export const createSystemOverviewShareAccessCookieValue = (token: string) => {
  const expiresAt = `${Date.now() + COOKIE_MAX_AGE_SECONDS * 1000}`;
  const signature = signValue(`${token}.${expiresAt}`);
  return `${expiresAt}.${signature}`;
};

export const verifySystemOverviewShareAccessCookieValue = (token: string, cookieValue?: string) => {
  if (!cookieValue) return false;

  const [expiresAt, signature] = cookieValue.split('.');
  if (!expiresAt || !signature) return false;

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const expectedSignature = signValue(`${token}.${expiresAt}`);
  const actualBuffer = new Uint8Array(Buffer.from(signature));
  const expectedBuffer = new Uint8Array(Buffer.from(expectedSignature));
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
};

export const serializeSystemOverviewShareAccessCookie = (token: string, value: string) => {
  const parts = [
    `${getSystemOverviewShareCookieName(token)}=${encodeURIComponent(value)}`,
    'Path=/shared/system-overview',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
};

export const serializeClearedSystemOverviewShareAccessCookie = (token: string) => {
  const parts = [
    `${getSystemOverviewShareCookieName(token)}=`,
    'Path=/shared/system-overview',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
};
