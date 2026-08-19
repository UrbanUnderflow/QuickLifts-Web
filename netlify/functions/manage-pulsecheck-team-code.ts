import type { Handler } from '@netlify/functions';
import { getOrCreateTeamCode, regenerateTeamCode } from '../../src/api/firebase/pulsecheckProvisioning/teamCode';

const { admin } = require('./config/firebase');
const { verifyFirebaseUser } = require('./lib/pulsecheck-coach-services');
const { isActiveMembership, resolveCapabilities } = require('./lib/pulsecheck-invite-email-auth');

const TEAMS_COLLECTION = 'pulsecheck-teams';
const MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const ADMIN_COLLECTION = 'admin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-PulseCheck-Firebase-Mode, X-PulseCheck-Dev-Firebase, X-PulseCheck-Firebase-Project-Id',
  'Content-Type': 'application/json',
};

type TeamCodeAction = 'get' | 'regenerate';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value: unknown) => normalizeString(value).toLowerCase();

const requestError = (message: string, statusCode = 400) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const isValidDocumentId = (value: string) =>
  value.length > 0 && value.length <= 240 && !value.includes('/');

const normalizeAction = (value: unknown): TeamCodeAction => {
  const action = normalizeString(value);
  if (action === 'get' || action === 'regenerate') return action;
  throw requestError('Choose get or regenerate.');
};

const isPlatformAdmin = async ({ database, decoded }: { database: any; decoded: any }) => {
  if (decoded?.admin === true) return true;
  const email = normalizeEmail(decoded?.email);
  if (!email) return false;
  const snapshot = await database.collection(ADMIN_COLLECTION).doc(email).get();
  return snapshot.exists;
};

/** Any active, non-athlete membership on the team can view the code; only
 *  admin/coaching capability can regenerate it (a more consequential action —
 *  it invalidates the old code for everyone who had it). */
const authorizeTeamCodeAccess = async ({
  database,
  userId,
  decoded,
  teamId,
  action,
}: {
  database: any;
  userId: string;
  decoded: any;
  teamId: string;
  action: TeamCodeAction;
}) => {
  if (await isPlatformAdmin({ database, decoded })) return;

  const snapshot = await database
    .collection(MEMBERSHIPS_COLLECTION)
    .where('userId', '==', userId)
    .get();
  const staffMemberships = snapshot.docs
    .map((document: any) => document.data() || {})
    .filter(
      (membership: any) =>
        normalizeString(membership.teamId) === teamId
        && normalizeString(membership.role).toLowerCase() !== 'athlete'
        && isActiveMembership(membership)
    );

  if (staffMemberships.length === 0) {
    throw requestError('Active staff access to the selected team is required.', 403);
  }
  if (action === 'get') return;

  const canRegenerate = staffMemberships.some((membership: any) => {
    const capabilities = resolveCapabilities(membership);
    return capabilities.has('admin') || capabilities.has('coaching');
  });
  if (!canRegenerate) {
    throw requestError('Coach or team admin access is required to regenerate the team code.', 403);
  }
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

    const action = normalizeAction(parsedBody.action);
    const teamId = normalizeString(parsedBody.teamId);
    if (!isValidDocumentId(teamId)) {
      throw requestError('Choose a valid team.');
    }

    const authenticated = await verifyFirebaseUser(event, {
      authErrorMessage: 'Sign in is required to manage a team code.',
    });
    const database = authenticated.app.firestore();

    const teamSnapshot = await database.collection(TEAMS_COLLECTION).doc(teamId).get();
    if (!teamSnapshot.exists) {
      throw requestError('The selected team could not be found.', 404);
    }

    await authorizeTeamCodeAccess({
      database,
      userId: authenticated.userId,
      decoded: authenticated.decoded,
      teamId,
      action,
    });

    const fieldValue = admin.firestore.FieldValue;
    const result =
      action === 'get'
        ? await getOrCreateTeamCode({ database, fieldValue, teamId })
        : { code: await regenerateTeamCode({ database, fieldValue, teamId }), created: true };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, teamCode: result.code }),
    };
  } catch (error: any) {
    console.error('[manage-pulsecheck-team-code] Error:', error);
    return {
      statusCode: Number(error?.statusCode) || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'The team code request could not be completed.',
      }),
    };
  }
};
