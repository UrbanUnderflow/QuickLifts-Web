import QRCode from 'qrcode';
import type { PulseCheckInviteLink } from '../api/firebase/pulsecheckProvisioning/types';
import { buildPulseCheckTeamInviteWebUrl } from './pulsecheckInviteLinks';

const normalizeValue = (value?: string | null) => String(value || '').trim();
const toTimestampMillis = (value: unknown) => {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') {
    const candidate = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof candidate.toDate === 'function') return candidate.toDate().getTime();
    const seconds = Number(candidate.seconds ?? candidate._seconds);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  return 0;
};

export interface PilotInviteScope {
  organizationId: string;
  teamId: string;
  pilotId: string;
  cohortId?: string | null;
}

export const resolvePilotInviteShareUrl = (
  invite?: PulseCheckInviteLink | null,
  siteOrigin?: string | null
) => {
  if (!invite) return '';

  const activationUrl = normalizeValue(invite.activationUrl);
  if (activationUrl) {
    try {
      return new URL(activationUrl).toString();
    } catch {
      const normalizedOrigin = normalizeValue(siteOrigin).replace(/\/+$/, '');
      if (normalizedOrigin) {
        try {
          return new URL(activationUrl, `${normalizedOrigin}/`).toString();
        } catch {
          // Fall through to the canonical token route below.
        }
      }
    }
  }

  return buildPulseCheckTeamInviteWebUrl(invite.token || invite.id, siteOrigin);
};

export const isActiveAthleteInviteInScope = (
  invite: PulseCheckInviteLink,
  scope: PilotInviteScope
) =>
  invite.inviteType === 'team-access' &&
  invite.teamMembershipRole === 'athlete' &&
  invite.status === 'active' &&
  normalizeValue(invite.organizationId) === normalizeValue(scope.organizationId) &&
  normalizeValue(invite.teamId) === normalizeValue(scope.teamId) &&
  normalizeValue(invite.pilotId) === normalizeValue(scope.pilotId) &&
  normalizeValue(invite.cohortId) === normalizeValue(scope.cohortId);

export const selectActiveReusableAthleteInvite = (
  invites: PulseCheckInviteLink[],
  scope: PilotInviteScope
) => {
  const candidates = invites
    .filter(
      (invite) =>
      isActiveAthleteInviteInScope(invite, scope) &&
      invite.redemptionMode === 'general' &&
      !normalizeValue(invite.targetEmail)
    )
    .sort((left, right) => {
      const createdAtDifference = toTimestampMillis(right.createdAt) - toTimestampMillis(left.createdAt);
      return createdAtDifference || right.id.localeCompare(left.id);
    });

  return candidates[0] || null;
};

export const PILOT_INVITE_QR_RENDER_OPTIONS = {
  errorCorrectionLevel: 'M',
  margin: 4,
  width: 720,
  color: {
    dark: '#09111e',
    light: '#ffffff',
  },
} as const;

export type PilotInviteQrRenderer = (
  value: string,
  options: typeof PILOT_INVITE_QR_RENDER_OPTIONS
) => Promise<string>;

export const renderPilotInviteQrDataUrl = (
  shareUrl: string,
  renderer: PilotInviteQrRenderer = QRCode.toDataURL as PilotInviteQrRenderer
) => renderer(shareUrl, PILOT_INVITE_QR_RENDER_OPTIONS);
