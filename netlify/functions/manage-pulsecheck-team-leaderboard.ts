import type { Handler } from '@netlify/functions';

const { admin } = require('./config/firebase');
const { verifyFirebaseUser } = require('./lib/pulsecheck-coach-services');
const {
  isActiveMembership,
  resolveCapabilities,
} = require('./lib/pulsecheck-invite-email-auth');

const MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const TEAMS_COLLECTION = 'pulsecheck-teams';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-PulseCheck-Firebase-Mode, X-PulseCheck-Dev-Firebase, X-PulseCheck-Firebase-Project-Id',
  'Content-Type': 'application/json',
};

const normalizedString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const requestError = (message: string, statusCode = 400) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const validDocumentId = (value: string): boolean => (
  value.length > 0 && value.length <= 240 && !value.includes('/')
);

const canManageLeaderboard = (membership: Record<string, any>): boolean => {
  const capabilities = resolveCapabilities(membership);
  return capabilities.has('admin')
    || capabilities.has('coaching')
    || capabilities.has('administrative');
};

const resolveStaffMembership = async (
  database: any,
  userId: string,
  teamId: string,
): Promise<Record<string, any>> => {
  const snapshot = await database
    .collection(MEMBERSHIPS_COLLECTION)
    .where('userId', '==', userId)
    .get();
  const membership = snapshot.docs
    .map((document: any) => ({ id: document.id, ...(document.data() || {}) }))
    .find((candidate: Record<string, any>) => (
      normalizedString(candidate.teamId) === teamId
      && normalizedString(candidate.role).toLowerCase() !== 'athlete'
      && isActiveMembership(candidate)
    ));
  if (!membership) {
    throw requestError('Active staff access to this team is required.', 403);
  }
  return membership;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed.' }),
    };
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      throw requestError('The request body must be valid JSON.');
    }
    const action = normalizedString(body.action) || 'read';
    if (action !== 'read' && action !== 'update') {
      throw requestError('Choose read or update.');
    }
    const teamId = normalizedString(body.teamId);
    if (!validDocumentId(teamId)) {
      throw requestError('Choose a valid team.');
    }
    if (action === 'update' && typeof body.enabled !== 'boolean') {
      throw requestError('The leaderboard setting must be on or off.');
    }

    const authenticated = await verifyFirebaseUser(event, {
      authErrorMessage: 'Sign in is required to manage the team leaderboard.',
    });
    const database = authenticated.app.firestore();
    const membership = await resolveStaffMembership(
      database,
      authenticated.userId,
      teamId,
    );
    const teamReference = database.collection(TEAMS_COLLECTION).doc(teamId);
    const teamSnapshot = await teamReference.get();
    if (!teamSnapshot.exists || !isActiveMembership(teamSnapshot.data() || {})) {
      throw requestError('The selected team is unavailable.', 404);
    }
    const team = teamSnapshot.data() || {};
    if (
      normalizedString(team.organizationId)
      !== normalizedString(membership.organizationId)
    ) {
      throw requestError('The selected team access record is inconsistent.', 403);
    }

    let enabled = team.showingUpLeaderboard?.enabled !== false;
    if (action === 'update') {
      if (!canManageLeaderboard(membership)) {
        throw requestError('Coach or manager access is required to change this setting.', 403);
      }
      enabled = body.enabled as boolean;
      await teamReference.update({
        'showingUpLeaderboard.enabled': enabled,
        'showingUpLeaderboard.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        'showingUpLeaderboard.updatedByUserId': authenticated.userId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        teamId,
        enabled,
      }),
    };
  } catch (error: any) {
    console.error('[manage-pulsecheck-team-leaderboard] Error:', error);
    return {
      statusCode: Number(error?.statusCode) || 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'The leaderboard setting could not be saved.',
      }),
    };
  }
};
