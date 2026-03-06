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

export const buildClubCheckInPath = (clubId: string, eventId?: string | null): string => {
  const basePath = `${buildClubPath(clubId)}/check-in`;
  if (!eventId) {
    return basePath;
  }

  const query = new URLSearchParams({ eventId });
  return `${basePath}?${query.toString()}`;
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
  fallbackPath?: string;
  eventId?: string | null;
  sharedBy?: string | null;
  pid?: string;
  campaign?: string;
  title?: string;
  description?: string;
  imageUrl?: string | null;
}): string => {
  const baseUrl = `https://${APPS_FLYER_SUBDOMAIN}/${APPS_FLYER_TEMPLATE_ID}`;
  const fallbackUrl = toAbsoluteUrl(fallbackPath || buildClubPath(clubId));
  const params = new URLSearchParams({
    pid,
    c: campaign,
    deep_link_value: 'club',
    clubId,
    af_r: encodeURIComponent(fallbackUrl),
  });

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
