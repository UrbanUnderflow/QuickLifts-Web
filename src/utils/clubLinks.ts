const PULSE_WEB_ORIGIN = 'https://fitwithpulse.ai';
const APPS_FLYER_SUBDOMAIN = 'fitwithpulse.onelink.me';
const APPS_FLYER_TEMPLATE_ID = 'yffD';

const toAbsoluteUrl = (pathOrUrl: string): string => {
  if (pathOrUrl.startsWith('http')) {
    return pathOrUrl;
  }

  return `${PULSE_WEB_ORIGIN}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
};

export const buildClubPath = (clubId: string): string => {
  return `/club/${encodeURIComponent(clubId)}`;
};

export const buildClubInstallPath = (
  clubId: string,
  options?: {
    sharedBy?: string | null;
    eventId?: string | null;
    web?: boolean;
  }
): string => {
  const path = `${buildClubPath(clubId)}/install`;
  const query = new URLSearchParams();

  if (options?.sharedBy) {
    query.set('sharedBy', options.sharedBy);
  }

  if (options?.eventId) {
    query.set('eventId', options.eventId);
  }

  if (options?.web) {
    query.set('web', '1');
  }

  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export const buildClubCanonicalUrl = (
  clubId: string,
  options?: {
    sharedBy?: string | null;
    eventId?: string | null;
  }
): string => {
  const path = buildClubPath(clubId);
  const query = new URLSearchParams();

  if (options?.sharedBy) {
    query.set('sharedBy', options.sharedBy);
  }

  if (options?.eventId) {
    query.set('eventId', options.eventId);
  }

  const queryString = query.toString();
  return toAbsoluteUrl(queryString ? `${path}?${queryString}` : path);
};

export const buildClubWebFallbackUrl = (
  clubId: string,
  options?: {
    sharedBy?: string | null;
    eventId?: string | null;
  }
): string => {
  const fallbackUrl = new URL(buildClubCanonicalUrl(clubId, options));
  fallbackUrl.searchParams.set('web', '1');
  return fallbackUrl.toString();
};

export const buildClubCheckInPath = (clubId: string, eventId?: string | null): string => {
  const basePath = `${buildClubPath(clubId)}/check-in`;
  if (!eventId) {
    return basePath;
  }

  const query = new URLSearchParams({ eventId });
  return `${basePath}?${query.toString()}`;
};

export const buildClubAppDeepLink = (
  clubId: string,
  options?: {
    sharedBy?: string | null;
    eventId?: string | null;
  }
): string => {
  const deepLinkParams = new URLSearchParams({ clubId });

  if (options?.sharedBy) {
    deepLinkParams.set('sharedBy', options.sharedBy);
  }

  if (options?.eventId) {
    deepLinkParams.set('eventId', options.eventId);
  }

  return `pulse://club?${deepLinkParams.toString()}`;
};

export const buildClubOneLink = ({
  clubId,
  fallbackPath,
  eventId,
  sharedBy,
  pid = 'event_checkin',
  campaign = 'club_event_checkin',
  title,
  description,
  imageUrl,
}: {
  clubId: string;
  fallbackPath?: string | null;
  eventId?: string | null;
  sharedBy?: string | null;
  pid?: string;
  campaign?: string;
  title?: string;
  description?: string;
  imageUrl?: string | null;
}): string => {
  const baseUrl = `https://${APPS_FLYER_SUBDOMAIN}/${APPS_FLYER_TEMPLATE_ID}`;
  const fallbackUrl =
    fallbackPath === null
      ? null
      : fallbackPath
        ? toAbsoluteUrl(fallbackPath)
        : buildClubCanonicalUrl(clubId, { sharedBy, eventId });
  const deepLinkUrl = buildClubAppDeepLink(clubId, { sharedBy, eventId });
  const params = new URLSearchParams({
    pid,
    c: campaign,
    deep_link_value: 'club',
    clubId,
    af_force_deeplink: 'true',
    af_dp: deepLinkUrl,
  });

  if (fallbackUrl) {
    params.set('af_r', fallbackUrl);
  }

  if (sharedBy) {
    params.set('af_referrer_customer_id', sharedBy);
    params.set('sharedBy', sharedBy);
  }

  if (eventId) {
    params.set('eventId', eventId);
  }

  if (title) {
    params.set('af_og_title', title);
  }

  if (description) {
    params.set('af_og_description', description);
  }

  if (imageUrl) {
    params.set('af_og_image', toAbsoluteUrl(imageUrl));
  }

  return `${baseUrl}?${params.toString()}`;
};

export const pulseWebOrigin = PULSE_WEB_ORIGIN;
