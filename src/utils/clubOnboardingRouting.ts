import type { ParsedUrlQuery } from 'querystring';

const MOBILE_USER_AGENT_RE = /iphone|ipad|ipod|android|webos|blackberry|windows phone|mobile/i;

export const isMobileClubRequest = ({
  userAgent,
  secChUaMobile,
}: {
  userAgent?: string | null;
  secChUaMobile?: string | null;
}): boolean => {
  const normalizedUserAgent = String(userAgent || '');
  if (!normalizedUserAgent) {
    return false;
  }

  if (secChUaMobile === '?1') {
    return true;
  }

  return MOBILE_USER_AGENT_RE.test(normalizedUserAgent);
};

export const buildClubInstallRedirectUrl = (id: string, query: ParsedUrlQuery): string => {
  const installPath = `/club/${encodeURIComponent(id)}/install`;
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (key === 'id' || key === 'web') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string' && entry) {
          params.append(key, entry);
        }
      });
      return;
    }

    if (typeof value === 'string' && value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `${installPath}?${queryString}` : installPath;
};
