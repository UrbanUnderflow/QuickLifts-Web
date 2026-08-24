export const TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS = {
  METHOD_NOT_ALLOWED: {
    statusCode: 405,
    message: 'This request is not supported.',
    retryable: false,
  },
  AUTH_REQUIRED: {
    statusCode: 401,
    message: 'Sign in before accepting this team invite.',
    retryable: true,
  },
  AUTH_INVALID: {
    statusCode: 401,
    message: 'Your sign-in session expired. Sign in again, then reopen this invite.',
    retryable: true,
  },
  AUTH_EMAIL_REQUIRED: {
    statusCode: 400,
    message: 'Your signed-in account needs an email address before you can join this team.',
    retryable: false,
  },
  INVITE_TOKEN_REQUIRED: {
    statusCode: 400,
    message: 'This invite link is missing its invite code. Ask your coach or team admin for the current QR code or link.',
    retryable: false,
  },
  INVITE_TOKEN_INVALID: {
    statusCode: 400,
    message: 'This invite code is not valid. Ask your coach or team admin for the current QR code or link.',
    retryable: false,
  },
  INVITE_NOT_FOUND: {
    statusCode: 404,
    message: 'This invite could not be found. Ask your coach or team admin for the current QR code or link.',
    retryable: false,
  },
  INVITE_TYPE_INVALID: {
    statusCode: 409,
    message: 'This link is not an athlete team invite. Ask your coach or team admin for the correct QR code or link.',
    retryable: false,
  },
  INVITE_REVOKED: {
    statusCode: 410,
    message: 'This invite was turned off and can no longer be used. Ask your coach or team admin for the current QR code or link.',
    retryable: false,
  },
  INVITE_EXPIRED: {
    statusCode: 410,
    message: 'This invite has expired. Ask your coach or team admin for the current QR code or link.',
    retryable: false,
  },
  INVITE_INACTIVE: {
    statusCode: 410,
    message: 'This invite is no longer active. Ask your coach or team admin for the current QR code or link.',
    retryable: false,
  },
  INVITE_ALREADY_REDEEMED: {
    statusCode: 409,
    message: 'This one-person invite has already been used. Ask your coach or team admin for the team QR code or a new invite.',
    retryable: false,
  },
  INVITE_EMAIL_MISMATCH: {
    statusCode: 403,
    message: 'Sign in with the account this invite was sent to, then try again.',
    retryable: false,
  },
  INVITE_EMAIL_UNVERIFIED: {
    statusCode: 403,
    message: 'Verify the email address on your account, then reopen this invite.',
    retryable: true,
  },
  INVITE_CONTEXT_INVALID: {
    statusCode: 409,
    message: 'This invite is missing its team information. Ask your coach or team admin for the current QR code or link.',
    retryable: false,
  },
  ORGANIZATION_NOT_FOUND: {
    statusCode: 404,
    message: 'The organization for this invite could not be found. Ask your team admin to check the invite setup.',
    retryable: false,
  },
  ORGANIZATION_ACTIVATION_REQUIRED: {
    statusCode: 409,
    message: 'This organization and team are still waiting for admin activation. Ask the organization owner to finish the PulseCheck activation link before athletes join.',
    retryable: false,
  },
  ORGANIZATION_INACTIVE: {
    statusCode: 403,
    message: 'This organization is not accepting new members right now. Ask an organization admin to reactivate it.',
    retryable: false,
  },
  TEAM_NOT_FOUND: {
    statusCode: 404,
    message: 'The team for this invite could not be found. Ask your coach or team admin for the current QR code or link.',
    retryable: false,
  },
  TEAM_ACTIVATION_REQUIRED: {
    statusCode: 409,
    message: 'This team is still waiting for admin activation. Ask the team admin to finish the PulseCheck activation link before athletes join.',
    retryable: false,
  },
  TEAM_INACTIVE: {
    statusCode: 403,
    message: 'This team is not accepting new members right now. Ask a team admin to reactivate the team.',
    retryable: false,
  },
  TEAM_SCOPE_MISMATCH: {
    statusCode: 409,
    message: 'This invite no longer matches its organization. Ask your team admin to replace the QR code or link.',
    retryable: false,
  },
  PILOT_NOT_FOUND: {
    statusCode: 404,
    message: 'The pilot for this invite could not be found. Ask the pilot owner for the current QR code or link.',
    retryable: false,
  },
  PILOT_INACTIVE: {
    statusCode: 409,
    message: 'This pilot is closed and is not accepting new athletes. Ask the pilot owner to reopen enrollment, then try again.',
    retryable: false,
  },
  PILOT_SCOPE_MISMATCH: {
    statusCode: 409,
    message: 'This invite no longer matches its pilot and team. Ask the pilot owner to replace the QR code or link.',
    retryable: false,
  },
  PILOT_ENROLLMENT_NOT_STARTED: {
    statusCode: 409,
    message: 'Enrollment for this pilot has not started yet. Try again after the pilot start date or ask the pilot owner to change it.',
    retryable: true,
  },
  PILOT_ENROLLMENT_ENDED: {
    statusCode: 409,
    message: 'Enrollment for this pilot has ended. Ask the pilot owner to extend the end date and reopen enrollment.',
    retryable: false,
  },
  PILOT_SCHEDULE_INVALID: {
    statusCode: 409,
    message: 'This pilot cannot accept athletes because its enrollment dates are invalid. Ask the pilot owner to correct the schedule.',
    retryable: false,
  },
  COHORT_NOT_FOUND: {
    statusCode: 404,
    message: 'The cohort for this invite could not be found. Ask the pilot owner for the current QR code or link.',
    retryable: false,
  },
  COHORT_INACTIVE: {
    statusCode: 409,
    message: 'This cohort is not accepting new athletes right now. Ask the pilot owner to reactivate it or share the correct QR code.',
    retryable: false,
  },
  COHORT_SCOPE_MISMATCH: {
    statusCode: 409,
    message: 'This invite no longer matches its pilot cohort. Ask the pilot owner to replace the QR code or link.',
    retryable: false,
  },
  ENROLLMENT_COHORT_CONFLICT: {
    statusCode: 409,
    message: 'You are already enrolled in another cohort for this pilot. Ask a team admin to move you before using this QR code.',
    retryable: false,
  },
  ATHLETE_APP_ACCESS_REQUIRED: {
    statusCode: 402,
    message: 'This team requires active PulseCheck app access before you can join. Complete the subscription step, then try this invite again.',
    retryable: true,
  },
  REDEMPTION_FAILED: {
    statusCode: 500,
    message: "We couldn't complete this team join because of a server problem. Please try again. If it continues, ask your coach or team admin for help.",
    retryable: true,
  },
} as const;

export type TeamInviteRedemptionErrorCode =
  keyof typeof TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS;

export type TeamInviteRedemptionErrorResponse = {
  code: TeamInviteRedemptionErrorCode;
  message: string;
  /** Backward-compatible alias for clients that still read `error`. */
  error: string;
  retryable: boolean;
};

export class TeamInviteRedemptionError extends Error {
  readonly code: TeamInviteRedemptionErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: TeamInviteRedemptionErrorCode) {
    const definition = TEAM_INVITE_REDEMPTION_ERROR_DEFINITIONS[code];
    super(definition.message);
    this.name = 'TeamInviteRedemptionError';
    this.code = code;
    this.statusCode = definition.statusCode;
    this.retryable = definition.retryable;
  }
}

export const teamInviteRedemptionError = (
  code: TeamInviteRedemptionErrorCode
) => new TeamInviteRedemptionError(code);

const firebaseAuthErrorCodes = new Set([
  'auth/argument-error',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-argument',
  'auth/invalid-id-token',
]);

export const normalizeTeamInviteRedemptionError = (
  error: unknown
): TeamInviteRedemptionError => {
  if (error instanceof TeamInviteRedemptionError) return error;

  const externalCode =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '').trim().toLowerCase()
      : '';
  if (firebaseAuthErrorCodes.has(externalCode)) {
    return teamInviteRedemptionError('AUTH_INVALID');
  }

  return teamInviteRedemptionError('REDEMPTION_FAILED');
};

export const serializeTeamInviteRedemptionError = (
  error: TeamInviteRedemptionError
): TeamInviteRedemptionErrorResponse => ({
  code: error.code,
  message: error.message,
  error: error.message,
  retryable: error.retryable,
});
