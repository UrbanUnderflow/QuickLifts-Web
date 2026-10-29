import { resolveActiveSchoolPilotAccess } from '../../src/lib/server/pulsecheck/pilotAccess';
const { headers } = require('./config/firebase');
const { verifyFirebaseUser } = require('./lib/pulsecheck-coach-services');
const { loadTeamBilling } = require('./lib/pulsecheck-team-billing');
export const handler = async (event: any) => {
  const responseHeaders = { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: responseHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: responseHeaders, body: '{}' };
  try {
    const auth = await verifyFirebaseUser(event);
    const body = JSON.parse(event.body || '{}');
    const context = await loadTeamBilling({ database: auth.app.firestore(), userId: auth.userId, teamId: body.teamId });
    const { isTeamAthlete, team, price, status, commercialModel } = context;
    const pilotAccessGranted = await resolveActiveSchoolPilotAccess(auth.app.firestore(), auth.userId, context);
    const dev = auth.app.name === 'pulsecheck-dev-admin';
    const canManagePayment = team && status !== 'team_inactive' && commercialModel === 'athlete-pay'
      && context.rawTeam?.commercialConfig?.athleteAppSubscriptionEnabled === true;
    const paymentUrl = canManagePayment ? `https://fitwithpulse.ai/PulseCheck/team-billing?teamId=${encodeURIComponent(team.id)}${dev ? '&devFirebase=1' : ''}` : null;
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ isTeamAthlete, team, price, status, commercialModel, paymentUrl, pilotAccessGranted }) };
  } catch (caught) {
    const error = caught as any;
    return { statusCode: error.statusCode || 500, headers: responseHeaders, body: JSON.stringify({ message: error.statusCode ? error.message : 'Your team billing details could not be loaded. Please try again.' }) };
  }
};
