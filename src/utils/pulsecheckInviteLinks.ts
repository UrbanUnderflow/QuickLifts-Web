const PULSE_WEB_ORIGIN = 'https://fitwithpulse.ai';
const APPS_FLYER_SUBDOMAIN = 'fitwithpulse.onelink.me';
const APPS_FLYER_TEMPLATE_ID = 'yffD';
const DEFAULT_INVITE_PREVIEW_IMAGE = `${PULSE_WEB_ORIGIN}/round-preview.png`;

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

  const params = new URLSearchParams({
    pid: 'pulsecheck_team_invite',
    c: pilotName?.trim() ? 'pulsecheck_pilot_invite' : 'pulsecheck_team_invite',
    deep_link_value: 'pulsecheck_team_invite',
    inviteToken: token,
    af_r: encodeURIComponent(toAbsoluteUrl(fallbackPath)),
    af_og_title: title,
    af_og_description: description,
    af_og_image: resolvePulseCheckInvitePreviewImage(imageUrl),
  });

  return `${baseUrl}?${params.toString()}`;
};
