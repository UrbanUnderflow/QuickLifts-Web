import { createHash, randomBytes } from 'node:crypto';

export const NATIVE_ATHLETE_INVITE_HANDOFFS_COLLECTION =
  'pulsecheck-native-athlete-invite-handoffs';
export const NATIVE_ATHLETE_INVITE_HANDOFF_TTL_SECONDS = 5 * 60;

type AthleteInviteIdentity = {
  uid: string;
  email?: unknown;
  emailVerified?: unknown;
};

export class NativeAthleteInviteHandoffError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'NativeAthleteInviteHandoffError';
    this.statusCode = statusCode;
  }
}

export const normalizeNativeHandoffString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeEmail = (value: unknown) =>
  normalizeNativeHandoffString(value).toLowerCase();

const timestampToEpochSeconds = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'number') {
    return value > 10_000_000_000
      ? Math.floor(value / 1000)
      : Math.floor(value);
  }
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === 'object') {
    const timestamp = value as {
      seconds?: unknown;
      _seconds?: unknown;
      toMillis?: () => number;
      toDate?: () => Date;
    };
    if (typeof timestamp.seconds === 'number') return Math.floor(timestamp.seconds);
    if (typeof timestamp._seconds === 'number') return Math.floor(timestamp._seconds);
    if (typeof timestamp.toMillis === 'function') {
      return Math.floor(timestamp.toMillis() / 1000);
    }
    if (typeof timestamp.toDate === 'function') {
      return Math.floor(timestamp.toDate().getTime() / 1000);
    }
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? 0
    : Math.floor(parsed.getTime() / 1000);
};

export const generateNativeAthleteInviteHandoffCode = () =>
  randomBytes(32).toString('base64url');

export const hashNativeAthleteInviteHandoffCode = (code: string) =>
  createHash('sha256').update(code, 'utf8').digest('hex');

export const validateNativeAthleteInviteBinding = (
  invite: Record<string, unknown> | null | undefined,
  identity: AthleteInviteIdentity,
  nowEpochSeconds = Math.floor(Date.now() / 1000)
) => {
  if (!invite) {
    throw new NativeAthleteInviteHandoffError('Athlete invite not found.', 404);
  }
  if (normalizeNativeHandoffString(invite.inviteType) !== 'team-access') {
    throw new NativeAthleteInviteHandoffError('Invite type is invalid.', 400);
  }
  if (normalizeNativeHandoffString(invite.teamMembershipRole) !== 'athlete') {
    throw new NativeAthleteInviteHandoffError(
      'This handoff is only available for athlete invites.',
      403
    );
  }

  const organizationId = normalizeNativeHandoffString(invite.organizationId);
  const teamId = normalizeNativeHandoffString(invite.teamId);
  if (!organizationId || !teamId) {
    throw new NativeAthleteInviteHandoffError('Invite team binding is invalid.', 400);
  }

  const expiresAt = timestampToEpochSeconds(
    invite.expiresAt || invite.expirationDate
  );
  if (
    invite.revokedAt != null ||
    invite.archivedAt != null ||
    invite.deletedAt != null ||
    (expiresAt > 0 && expiresAt <= nowEpochSeconds)
  ) {
    throw new NativeAthleteInviteHandoffError(
      'Athlete invite is no longer active.',
      410
    );
  }

  const uid = normalizeNativeHandoffString(identity.uid);
  const status = normalizeNativeHandoffString(invite.status);
  const redemptionMode =
    normalizeNativeHandoffString(invite.redemptionMode) === 'general'
      ? 'general'
      : 'single-use';
  const isUsable =
    redemptionMode === 'general'
      ? status === 'active' || status === 'redeemed'
      : status === 'active' ||
        (status === 'redeemed' &&
          normalizeNativeHandoffString(invite.redeemedByUserId) === uid);
  if (!isUsable) {
    throw new NativeAthleteInviteHandoffError(
      'Athlete invite is no longer active.',
      410
    );
  }

  const email = normalizeEmail(identity.email);
  if (!uid || !email) {
    throw new NativeAthleteInviteHandoffError(
      'The signed-in athlete account must have an email address.',
      400
    );
  }

  const targetEmail = normalizeEmail(invite.targetEmail);
  if (targetEmail && targetEmail !== email) {
    throw new NativeAthleteInviteHandoffError(
      'Sign in with the account this athlete invite was sent to.',
      403
    );
  }
  if (targetEmail && identity.emailVerified !== true) {
    throw new NativeAthleteInviteHandoffError(
      'Verify the invited email address before continuing.',
      403
    );
  }

  return {
    uid,
    email,
    emailVerified: identity.emailVerified === true,
    organizationId,
    teamId,
  };
};

export const nativeAthleteInviteHandoffErrorResponse = (error: unknown) => {
  if (error instanceof NativeAthleteInviteHandoffError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  return {
    statusCode: 500,
    message: 'Unable to complete the secure app handoff.',
  };
};
