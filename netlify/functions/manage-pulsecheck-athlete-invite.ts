import type { Handler } from '@netlify/functions';
import {
  buildPulseCheckAthleteOfferWebUrl,
  buildPulseCheckTeamInviteOneLink,
  buildPulseCheckTeamInviteWebUrl,
} from '../../src/utils/pulsecheckInviteLinks';
import {
  isPulseCheckCoachPricedAthleteOfferActive,
  isPulseCheckSponsoredTeamPlanActive,
} from '../../src/utils/pulsecheckCommercialization';

const { admin, isDevMode } = require('./config/firebase');
const {
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');
const {
  isActiveMembership,
  resolveCapabilities,
} = require('./lib/pulsecheck-invite-email-auth');

const INVITES_COLLECTION = 'pulsecheck-invite-links';
const MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-PulseCheck-Firebase-Mode, X-PulseCheck-Dev-Firebase, X-PulseCheck-Firebase-Project-Id',
  'Content-Type': 'application/json',
};

type InviteAction = 'create' | 'update' | 'revoke';
type InviteMode = 'general' | 'single-use';
type AthleteTrack = 'team-default' | 'rookie' | 'junior' | 'pro';

type NormalizedInviteFields = {
  recipientName: string;
  email: string;
  athleteAge: number | null;
  athleteTrack: AthleteTrack;
  notifyCoachOnAccept: boolean;
};

type RequestBody = {
  action: InviteAction;
  teamId: string;
  inviteId?: string;
  mode?: InviteMode;
  recipientName?: string;
  email?: string;
  athleteAge?: number | null;
  athleteTrack?: AthleteTrack;
  notifyCoachOnAccept?: boolean;
  senderName?: string;
};

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeEmail = (value: unknown) =>
  normalizeString(value).toLowerCase();

const requestError = (message: string, statusCode = 400) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const isValidDocumentId = (value: string) =>
  value.length > 0 && value.length <= 240 && !value.includes('/');

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

const normalizeAction = (value: unknown): InviteAction => {
  const action = normalizeString(value);
  if (action === 'create' || action === 'update' || action === 'revoke') {
    return action;
  }
  throw requestError('Choose create, update, or revoke.');
};

const normalizeMode = (value: unknown): InviteMode => {
  const mode = normalizeString(value);
  if (mode === 'general' || mode === 'single-use') {
    return mode;
  }
  throw requestError('Choose a general or single-use athlete invite.');
};

const normalizeInviteFields = (
  body: Record<string, unknown>,
  mode: InviteMode
): NormalizedInviteFields => {
  const recipientName = normalizeString(body.recipientName);
  const email = normalizeEmail(body.email);

  if (mode === 'single-use' && !recipientName) {
    throw requestError("Add the athlete's name.");
  }
  if (recipientName.length > 120) {
    throw requestError('Keep the athlete name under 120 characters.');
  }
  if (email && !isValidEmail(email)) {
    throw requestError('Enter a valid email address.');
  }

  let athleteAge: number | null = null;
  if (body.athleteAge !== undefined && body.athleteAge !== null) {
    if (
      typeof body.athleteAge !== 'number'
      || !Number.isInteger(body.athleteAge)
      || body.athleteAge < 1
      || body.athleteAge > 120
    ) {
      throw requestError('Enter a whole-number age between 1 and 120.');
    }
    athleteAge = body.athleteAge;
  }

  const rawTrack = body.athleteTrack === undefined
    ? 'team-default'
    : normalizeString(body.athleteTrack);
  const validTracks = new Set<AthleteTrack>([
    'team-default',
    'rookie',
    'junior',
    'pro',
  ]);
  if (!validTracks.has(rawTrack as AthleteTrack)) {
    throw requestError('Choose a valid athlete track.');
  }

  if (
    body.notifyCoachOnAccept !== undefined
    && typeof body.notifyCoachOnAccept !== 'boolean'
  ) {
    throw requestError('The acceptance notification setting must be true or false.');
  }

  if (
    mode === 'general'
    && (
      recipientName
      || email
      || athleteAge !== null
      || rawTrack !== 'team-default'
      || body.notifyCoachOnAccept === true
    )
  ) {
    throw requestError('A reusable team link cannot include one athlete’s details.');
  }

  return {
    recipientName,
    email,
    athleteAge,
    athleteTrack: rawTrack as AthleteTrack,
    notifyCoachOnAccept: body.notifyCoachOnAccept === true,
  };
};

const serializeInvite = (id: string, data: Record<string, any>) => {
  const rawTrack = normalizeString(data.athleteTrackOverride);
  const athleteTrack: AthleteTrack =
    rawTrack === 'rookie' || rawTrack === 'junior' || rawTrack === 'pro'
      ? rawTrack
      : 'team-default';
  const mode: InviteMode =
    normalizeString(data.redemptionMode) === 'general'
      ? 'general'
      : 'single-use';

  return {
    id,
    token: normalizeString(data.token) || id,
    recipientName: normalizeString(data.recipientName),
    email: normalizeEmail(data.targetEmail),
    mode,
    activationUrl: normalizeString(data.activationUrl)
      || buildPulseCheckTeamInviteWebUrl(normalizeString(data.token) || id),
    athleteAge:
      Number.isInteger(data.athleteAge) && data.athleteAge >= 1
        ? data.athleteAge
        : null,
    athleteTrack,
    notifyCoachOnAccept: data.notifyCoachOnAccept === true,
    prefilledProfileImageUrl: normalizeString(data.prefilledProfileImageUrl),
    lastEmailStatus: normalizeString(data.lastEmailStatus),
    emailSendCount: Math.max(0, Number(data.emailSendCount) || 0),
    status: normalizeString(data.status),
  };
};

const inviteFieldPayload = (fields: NormalizedInviteFields) => ({
  targetEmail: fields.email,
  recipientName: fields.recipientName,
  athleteAge: fields.athleteAge,
  athleteTrackOverride:
    fields.athleteTrack === 'team-default' ? null : fields.athleteTrack,
  notifyCoachOnAccept: fields.notifyCoachOnAccept,
});

const activeAthleteInvite = (
  snapshot: any,
  teamId: string,
  organizationId: string
) => {
  const data = snapshot.data() || {};
  return (
    snapshot.exists
    && normalizeString(data.inviteType) === 'team-access'
    && normalizeString(data.status) === 'active'
    && !data.revokedAt
    && normalizeString(data.teamId) === teamId
    && normalizeString(data.organizationId) === organizationId
    && normalizeString(data.teamMembershipRole).toLowerCase() === 'athlete'
  );
};

const canMutate = (capabilities: Set<string>, action: InviteAction) => {
  if (action === 'revoke') {
    return capabilities.has('admin');
  }
  return (
    capabilities.has('admin')
    || capabilities.has('coaching')
    || capabilities.has('administrative')
  );
};

const resolveActiveMembership = async ({
  database,
  userId,
  teamId,
  action,
}: {
  database: any;
  userId: string;
  teamId: string;
  action: InviteAction;
}) => {
  const snapshot = await database
    .collection(MEMBERSHIPS_COLLECTION)
    .where('userId', '==', userId)
    .get();
  const teamMemberships = snapshot.docs.filter((document: any) => {
    const membership = document.data() || {};
    return (
      normalizeString(membership.teamId) === teamId
      && normalizeString(membership.role).toLowerCase() !== 'athlete'
      && isActiveMembership(membership)
    );
  });

  if (teamMemberships.length === 0) {
    throw requestError('Active staff access to the selected team is required.', 403);
  }

  const authorized = teamMemberships.find((document: any) =>
    canMutate(resolveCapabilities(document.data() || {}), action)
  );
  if (!authorized) {
    const message = action === 'revoke'
      ? 'Team admin access is required to revoke athlete invites.'
      : 'Coach or manager access is required to manage athlete invites.';
    throw requestError(message, 403);
  }

  return {
    id: authorized.id,
    data: authorized.data() || {},
  };
};

const resolveTeamContext = async ({
  database,
  teamId,
  membership,
}: {
  database: any;
  teamId: string;
  membership: Record<string, any>;
}) => {
  const teamSnapshot = await database.collection(TEAMS_COLLECTION).doc(teamId).get();
  if (!teamSnapshot.exists) {
    throw requestError('The selected team could not be found.', 404);
  }

  const team = teamSnapshot.data() || {};
  if (!isActiveMembership(team)) {
    throw requestError('The selected team is inactive.', 403);
  }
  const teamOrganizationId = normalizeString(team.organizationId);
  const membershipOrganizationId = normalizeString(membership.organizationId);
  if (!teamOrganizationId || membershipOrganizationId !== teamOrganizationId) {
    throw requestError('The selected team access record is inconsistent.', 403);
  }
  const organizationId = teamOrganizationId;

  const organizationSnapshot = await database
    .collection(ORGANIZATIONS_COLLECTION)
    .doc(organizationId)
    .get();
  if (!organizationSnapshot.exists) {
    throw requestError('The selected team organization could not be found.', 404);
  }
  const organization = organizationSnapshot.data() || {};
  if (!isActiveMembership(organization)) {
    throw requestError('The selected team organization is inactive.', 403);
  }

  return {
    organizationId,
    team,
    organization,
  };
};

const findReusableOrMatchingInvite = async ({
  database,
  teamId,
  organizationId,
  mode,
  fields,
}: {
  database: any;
  teamId: string;
  organizationId: string;
  mode: InviteMode;
  fields: NormalizedInviteFields;
}) => {
  const snapshot = await database
    .collection(INVITES_COLLECTION)
    .where('teamId', '==', teamId)
    .get();

  return snapshot.docs.find((document: any) => {
    if (!activeAthleteInvite(document, teamId, organizationId)) {
      return false;
    }
    const data = document.data() || {};
    const storedMode = normalizeString(data.redemptionMode) === 'general'
      ? 'general'
      : 'single-use';
    if (storedMode !== mode) {
      return false;
    }
    if (mode === 'general') {
      return !normalizeEmail(data.targetEmail);
    }
    if (fields.email) {
      return normalizeEmail(data.targetEmail) === fields.email;
    }
    return (
      !normalizeEmail(data.targetEmail)
      && normalizeString(data.recipientName).toLowerCase()
        === fields.recipientName.toLowerCase()
    );
  }) || null;
};

const createInvite = async ({
  database,
  fieldValue,
  authenticated,
  membershipId,
  teamId,
  organizationId,
  team,
  organization,
  mode,
  fields,
  senderName,
  forceDevFirebase,
}: {
  database: any;
  fieldValue: any;
  authenticated: any;
  membershipId: string;
  teamId: string;
  organizationId: string;
  team: Record<string, any>;
  organization: Record<string, any>;
  mode: InviteMode;
  fields: NormalizedInviteFields;
  senderName: string;
  forceDevFirebase: boolean;
}) => {
  const commercialConfig = team.commercialConfig || {};
  const requiresAthleteWebCheckout =
    !isPulseCheckSponsoredTeamPlanActive(commercialConfig)
    && isPulseCheckCoachPricedAthleteOfferActive(commercialConfig);
  const buildActivationUrl = (token: string) => {
    if (requiresAthleteWebCheckout) {
      return buildPulseCheckAthleteOfferWebUrl(
        token,
        process.env.URL || process.env.SITE_URL,
        forceDevFirebase
      );
    }

    const fallbackPath = `/PulseCheck/team-invite/${encodeURIComponent(token)}`;
    try {
      return buildPulseCheckTeamInviteOneLink({
        token,
        fallbackPath,
        role: 'athlete',
        teamName: normalizeString(team.displayName),
        organizationName: normalizeString(organization.displayName),
        imageUrl:
          normalizeString(team.invitePreviewImageUrl)
          || normalizeString(organization.invitePreviewImageUrl),
      });
    } catch (_error) {
      return buildPulseCheckTeamInviteWebUrl(token);
    }
  };

  const existing = await findReusableOrMatchingInvite({
    database,
    teamId,
    organizationId,
    mode,
    fields,
  });
  if (existing) {
    const existingData = existing.data() || {};
    const existingToken = normalizeString(existingData.token) || existing.id;
    const activationUrl = buildActivationUrl(existingToken);
    if (
      mode === 'single-use'
      || normalizeString(existingData.activationUrl) !== activationUrl
    ) {
      const updates = {
        ...(mode === 'single-use' ? inviteFieldPayload(fields) : {}),
        activationUrl,
        updatedByUserId: authenticated.userId,
        updatedAt: fieldValue.serverTimestamp(),
      };
      await existing.ref.update(updates);
      return {
        id: existing.id,
        data: { ...existingData, ...updates },
      };
    }
    return { id: existing.id, data: existingData };
  }

  const token = crypto.randomUUID().toLowerCase();
  const activationUrl = buildActivationUrl(token);

  const actorEmail = normalizeEmail(authenticated.decoded?.email);
  const actorName =
    normalizeString(senderName)
    || normalizeString(authenticated.decoded?.name)
    || actorEmail.split('@')[0]
    || 'Coach';
  const payload = {
    inviteType: 'team-access',
    status: 'active',
    redemptionMode: mode,
    redemptionCount: 0,
    organizationId,
    teamId,
    teamMembershipRole: 'athlete',
    staffCapabilities: [],
    ...inviteFieldPayload(fields),
    invitedTitle: '',
    token,
    activationUrl,
    createdByUserId: authenticated.userId,
    createdByEmail: actorEmail,
    createdByName: actorName,
    issuedByMembershipId: membershipId,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp(),
  };
  const reference = database.collection(INVITES_COLLECTION).doc(token);
  await reference.set(payload);
  return { id: token, data: payload };
};

const updateInvite = async ({
  database,
  fieldValue,
  authenticated,
  inviteId,
  teamId,
  organizationId,
  fields,
}: {
  database: any;
  fieldValue: any;
  authenticated: any;
  inviteId: string;
  teamId: string;
  organizationId: string;
  fields: NormalizedInviteFields;
}) => {
  const reference = database.collection(INVITES_COLLECTION).doc(inviteId);
  const snapshot = await reference.get();
  if (!activeAthleteInvite(snapshot, teamId, organizationId)) {
    throw requestError('This athlete invite is no longer available.', 404);
  }
  const current = snapshot.data() || {};
  if (normalizeString(current.redemptionMode) === 'general') {
    throw requestError('Reusable team links keep team-wide settings.', 409);
  }

  const updates = {
    ...inviteFieldPayload(fields),
    updatedByUserId: authenticated.userId,
    updatedAt: fieldValue.serverTimestamp(),
  };
  await reference.update(updates);
  return { id: snapshot.id, data: { ...current, ...updates } };
};

const revokeInvite = async ({
  database,
  fieldValue,
  authenticated,
  inviteId,
  teamId,
  organizationId,
}: {
  database: any;
  fieldValue: any;
  authenticated: any;
  inviteId: string;
  teamId: string;
  organizationId: string;
}) => {
  const reference = database.collection(INVITES_COLLECTION).doc(inviteId);
  const snapshot = await reference.get();
  if (!activeAthleteInvite(snapshot, teamId, organizationId)) {
    throw requestError('This athlete invite is no longer available.', 404);
  }
  const updates = {
    status: 'revoked',
    revokedAt: fieldValue.serverTimestamp(),
    revokedByUserId: authenticated.userId,
    updatedAt: fieldValue.serverTimestamp(),
  };
  await reference.update(updates);
  return { id: snapshot.id, data: { ...(snapshot.data() || {}), ...updates } };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Method not allowed.' }),
    };
  }

  try {
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(event.body || '{}');
    } catch (_error) {
      throw requestError('The request body must be valid JSON.');
    }
    if (!parsedBody || Array.isArray(parsedBody)) {
      throw requestError('The request body must be a JSON object.');
    }

    const action = normalizeAction(parsedBody.action);
    const teamId = normalizeString(parsedBody.teamId);
    if (!isValidDocumentId(teamId)) {
      throw requestError('Choose a valid team.');
    }
    const inviteId = normalizeString(parsedBody.inviteId);
    if (action !== 'create' && !isValidDocumentId(inviteId)) {
      throw requestError('Choose a valid athlete invite.');
    }

    const mode = action === 'create'
      ? normalizeMode(parsedBody.mode)
      : 'single-use';
    const fields = action === 'revoke'
      ? null
      : normalizeInviteFields(parsedBody, mode);
    const senderName = normalizeString(parsedBody.senderName);
    if (senderName.length > 120) {
      throw requestError('Keep the sender name under 120 characters.');
    }

    const authenticated = await verifyFirebaseUser(event, {
      authErrorMessage: 'Sign in is required to manage athlete invites.',
    });
    const database = authenticated.app.firestore();
    const membership = await resolveActiveMembership({
      database,
      userId: authenticated.userId,
      teamId,
      action,
    });
    const teamContext = await resolveTeamContext({
      database,
      teamId,
      membership: membership.data,
    });
    const fieldValue = admin.firestore.FieldValue;

    let result: { id: string; data: Record<string, any> };
    if (action === 'create') {
      result = await createInvite({
        database,
        fieldValue,
        authenticated,
        membershipId: membership.id,
        teamId,
        organizationId: teamContext.organizationId,
        team: teamContext.team,
        organization: teamContext.organization,
        mode,
        fields: fields as NormalizedInviteFields,
        senderName,
        forceDevFirebase: isDevMode(event),
      });
    } else if (action === 'update') {
      result = await updateInvite({
        database,
        fieldValue,
        authenticated,
        inviteId,
        teamId,
        organizationId: teamContext.organizationId,
        fields: fields as NormalizedInviteFields,
      });
    } else {
      result = await revokeInvite({
        database,
        fieldValue,
        authenticated,
        inviteId,
        teamId,
        organizationId: teamContext.organizationId,
      });
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        invite: serializeInvite(result.id, result.data),
      }),
    };
  } catch (error: any) {
    console.error('[manage-pulsecheck-athlete-invite] Error:', error);
    return {
      statusCode: Number(error?.statusCode) || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'The athlete invite request could not be completed.',
      }),
    };
  }
};
