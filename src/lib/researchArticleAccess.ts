import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const COOKIE_NAME_PREFIX = 'pc_research_access_';

const PROTECTED_RESEARCH_ARTICLES: Record<string, { passwordEnvVar: string; fallbackPassword: string }> = {
  'ai-supported-escalation-human-clinical-handoff-and-return-to-training-pathways': {
    passwordEnvVar: 'AUNTEDNA_PIL_WHITE_PAPER_PASSWORD',
    fallbackPassword: 'AUNTEDNA-PIL-2026',
  },
};

const getConfiguredArticlePassword = (config: { passwordEnvVar: string; fallbackPassword: string }) =>
  process.env[config.passwordEnvVar] ||
  (process.env.NODE_ENV === 'production' ? '' : config.fallbackPassword);

const getCookieSecret = (slug: string) => {
  const config = getResearchArticleAccessConfig(slug);
  return (
    process.env.RESEARCH_ARTICLE_ACCESS_COOKIE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (config ? process.env[config.passwordEnvVar] : '') ||
    (process.env.NODE_ENV === 'production' ? '' : 'development-research-article-access-secret')
  );
};

const normalizePassword = (value: string) => value.trim();

const signValue = (slug: string, value: string) => {
  const cookieSecret = getCookieSecret(slug);
  if (!cookieSecret) return '';
  return createHmac('sha256', cookieSecret).update(value).digest('hex');
};

const safeCookieSlug = (slug: string) =>
  slug
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 110);

const timingSafeStringEqual = (actual: string, expected: string) => {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(new Uint8Array(actualBuffer), new Uint8Array(expectedBuffer));
};

export const getResearchArticleAccessConfig = (slug: string) =>
  PROTECTED_RESEARCH_ARTICLES[slug] || null;

export const isResearchArticlePasswordProtected = (slug: string) =>
  Boolean(getResearchArticleAccessConfig(slug));

export const verifyResearchArticlePassword = (slug: string, password: string) => {
  const config = getResearchArticleAccessConfig(slug);
  if (!config) return false;

  const expectedPassword = getConfiguredArticlePassword(config);
  if (!expectedPassword) return false;

  return timingSafeStringEqual(normalizePassword(password), normalizePassword(expectedPassword));
};

export const getResearchArticleAccessCookieName = (slug: string) =>
  `${COOKIE_NAME_PREFIX}${safeCookieSlug(slug)}`;

export const createResearchArticleAccessCookieValue = (slug: string) => {
  const expiresAt = `${Date.now() + COOKIE_MAX_AGE_SECONDS * 1000}`;
  const signature = signValue(slug, `${slug}.${expiresAt}`);
  if (!signature) return null;
  return `${expiresAt}.${signature}`;
};

export const verifyResearchArticleAccessCookieValue = (slug: string, cookieValue?: string) => {
  if (!cookieValue) return false;

  const [expiresAt, signature] = cookieValue.split('.');
  if (!expiresAt || !signature) return false;

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const expectedSignature = signValue(slug, `${slug}.${expiresAt}`);
  if (!expectedSignature) return false;

  return timingSafeStringEqual(signature, expectedSignature);
};

export const serializeResearchArticleAccessCookie = (slug: string, value: string) => {
  const parts = [
    `${getResearchArticleAccessCookieName(slug)}=${encodeURIComponent(value)}`,
    `Path=/research/${slug}`,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
};
