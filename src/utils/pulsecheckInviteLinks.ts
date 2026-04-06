const PULSE_WEB_ORIGIN = 'https://fitwithpulse.ai';
const APPS_FLYER_SUBDOMAIN = 'pulsecheckapp.onelink.me';
const APPS_FLYER_TEMPLATE_ID = 'uT14';
const APPS_FLYER_DEEP_LINK_VALUE = 'pulsecheck_team_invite';
const DEFAULT_INVITE_PREVIEW_IMAGE = `${PULSE_WEB_ORIGIN}/round-preview.png`;

export interface PulseCheckInviteLinkDiagnostic {
  status: 'valid' | 'warning';
  summary: string;
  details: string[];
  fallbackUrl: string | null;
  fallbackHost: string | null;
}

const toAbsoluteUrl = (pathOrUrl?: string | null): string => {
  const value = String(pathOrUrl || '').trim();
  if (!value) {
    return DEFAULT_INVITE_PREVIEW_IMAGE;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `${PULSE_WEB_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
};

export const resolvePulseCheckInvitePreviewImage = (teamImageUrl?: string | null, organizationImageUrl?: string | null) =>
  toAbsoluteUrl(teamImageUrl || organizationImageUrl || DEFAULT_INVITE_PREVIEW_IMAGE);

export const isPulseCheckInviteOneLink = (url?: string | null) => {
  const value = String(url || '').trim();
  return value.includes(`${APPS_FLYER_SUBDOMAIN}/${APPS_FLYER_TEMPLATE_ID}`);
};

export const buildPulseCheckTeamInviteWebUrl = (token: string, siteOrigin?: string | null) => {
  const normalizedToken = String(token || '').trim();
  const normalizedOrigin = String(siteOrigin || PULSE_WEB_ORIGIN).trim().replace(/\/+$/, '') || PULSE_WEB_ORIGIN;
  return `${normalizedOrigin}/PulseCheck/team-invite/${encodeURIComponent(normalizedToken)}`;
};

export const buildPulseCheckTeamInviteOneLink = ({
  token,
  fallbackPath,
  role,
  pilotName,
  teamName,
  organizationName,
  cohortName,
  imageUrl,
}: {
  token: string;
  fallbackPath: string;
  role: string;
  pilotName?: string | null;
  teamName?: string | null;
  organizationName?: string | null;
  cohortName?: string | null;
  imageUrl?: string | null;
}): string => {
  const baseUrl = `https://${APPS_FLYER_SUBDOMAIN}/${APPS_FLYER_TEMPLATE_ID}`;
  const title = pilotName?.trim()
    ? `You're Invited to Join ${pilotName.trim()}`
    : `You're Invited to Join ${teamName?.trim() || 'PulseCheck'}`;

  const descriptionParts = [
    role ? `${role} access` : '',
    teamName?.trim() ? `for ${teamName.trim()}` : '',
    organizationName?.trim() ? `inside ${organizationName.trim()}` : '',
    cohortName?.trim() ? `with cohort ${cohortName.trim()}` : '',
  ].filter(Boolean);

  const description = descriptionParts.length > 0
    ? `${descriptionParts.join(' ')} on PulseCheck.`
    : 'Join PulseCheck through this invite.';

  const fallbackUrl = toAbsoluteUrl(fallbackPath);
  const ogImageUrl = resolvePulseCheckInvitePreviewImage(imageUrl);
  const pairs = [
    ['pid', encodeURIComponent('pulsecheck_team_invite')],
    ['c', encodeURIComponent(pilotName?.trim() ? 'pulsecheck_pilot_invite' : 'pulsecheck_team_invite')],
    ['deep_link_value', encodeURIComponent(APPS_FLYER_DEEP_LINK_VALUE)],
    ['inviteToken', encodeURIComponent(token)],
    ['af_r', fallbackUrl],
    ['af_og_title', encodeURIComponent(title)],
    ['af_og_description', encodeURIComponent(description)],
    ['af_og_image', encodeURIComponent(ogImageUrl)],
  ];

  return `${baseUrl}?${pairs.map(([key, value]) => `${key}=${value}`).join('&')}`;
};

export const analyzePulseCheckInviteOneLink = (url?: string | null): PulseCheckInviteLinkDiagnostic => {
  const value = String(url || '').trim();
  if (!value) {
    return {
      status: 'warning',
      summary: 'Invite link is empty.',
      details: ['Generate a fresh invite link before testing deep linking or previews.'],
      fallbackUrl: null,
      fallbackHost: null,
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value);
  } catch {
    return {
      status: 'warning',
      summary: 'Invite link is not a valid URL.',
      details: ['The generated share link could not be parsed locally.'],
      fallbackUrl: null,
      fallbackHost: null,
    };
  }

  const warnings: string[] = [];
  const params = parsedUrl.searchParams;
  const fallbackUrl = params.get('af_r');
  let fallbackHost: string | null = null;

  if (parsedUrl.host !== APPS_FLYER_SUBDOMAIN) {
    warnings.push(`OneLink host is ${parsedUrl.host}; expected ${APPS_FLYER_SUBDOMAIN}.`);
  }

  const templateId = parsedUrl.pathname.replace(/\//g, '');
  if (templateId !== APPS_FLYER_TEMPLATE_ID) {
    warnings.push(`Template id is ${templateId || 'missing'}; expected ${APPS_FLYER_TEMPLATE_ID}.`);
  }

  if (params.get('deep_link_value') !== APPS_FLYER_DEEP_LINK_VALUE) {
    warnings.push(`deep_link_value is ${params.get('deep_link_value') || 'missing'}; expected ${APPS_FLYER_DEEP_LINK_VALUE}.`);
  }

  if (!params.get('inviteToken')) {
    warnings.push('inviteToken is missing.');
  }

  if (!fallbackUrl) {
    warnings.push('af_r fallback redirect is missing.');
  } else {
    try {
      const parsedFallback = new URL(fallbackUrl);
      fallbackHost = parsedFallback.host;
      if (parsedFallback.origin !== PULSE_WEB_ORIGIN) {
        warnings.push(`Fallback origin is ${parsedFallback.origin}; expected ${PULSE_WEB_ORIGIN}.`);
      }
    } catch {
      warnings.push('af_r fallback redirect is not a valid URL.');
    }
  }

  const details =
    warnings.length > 0
      ? warnings
      : [
          `Local link structure looks correct for ${APPS_FLYER_SUBDOMAIN}/${APPS_FLYER_TEMPLATE_ID}.`,
          fallbackHost
            ? `AppsFlyer still needs ${fallbackHost} on the redirect allowlist for af_r to work in production.`
            : 'AppsFlyer still needs the fallback host on the redirect allowlist for af_r to work in production.',
        ];

  return {
    status: warnings.length > 0 ? 'warning' : 'valid',
    summary:
      warnings.length > 0
        ? 'This share link has local structure warnings before AppsFlyer is even considered.'
        : 'This share link looks locally valid. If it still fails, the remaining issue is most likely AppsFlyer template or redirect-allowlist configuration.',
    details,
    fallbackUrl,
    fallbackHost,
  };
};
