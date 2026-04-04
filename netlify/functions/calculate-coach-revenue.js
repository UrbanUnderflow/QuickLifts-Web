/**
 * Recalculate PulseCheck team and coach-led organization revenue summaries.
 *
 * This replaces the legacy coach revenue calculator that depended on
 * `coachAthletes`, `coachReferrals`, and `revenue-calculations`.
 */

const { admin, db, headers } = require('./config/firebase');
const {
  recalculatePulseCheckRevenueSummaries,
  TEAM_REVENUE_SUMMARIES_COLLECTION,
  USER_REVENUE_SUMMARIES_COLLECTION,
} = require('./utils/pulsecheck-revenue');

const buildOverview = (teamSummaries, userSummaries) => ({
  totalTeams: teamSummaries.length,
  totalRecipients: userSummaries.length,
  athleteSubscriptionMrrCents: teamSummaries.reduce((sum, team) => sum + (team.athleteSubscriptionMrrCents || 0), 0),
  teamPlanBillingMrrCents: teamSummaries.reduce((sum, team) => sum + (team.teamPlanBillingMrrCents || 0), 0),
  grossMrrCents: teamSummaries.reduce((sum, team) => sum + (team.totalGrossMrrCents || 0), 0),
  estimatedPayoutMrrCents: teamSummaries.reduce((sum, team) => sum + (team.recipientPayoutMrrCents || 0), 0),
  platformNetMrrCents: teamSummaries.reduce((sum, team) => sum + (team.platformNetMrrCents || 0), 0),
  activeAthleteSubscribers: teamSummaries.reduce((sum, team) => sum + (team.activeAthleteSubscriberCount || 0), 0),
  coveredAthletes: teamSummaries.reduce((sum, team) => sum + (team.coveredAthleteCount || 0), 0),
});

const calculateAllCoachRevenues = async () => {
  const { teamSummaries, userSummaries } = await recalculatePulseCheckRevenueSummaries({
    db,
    admin,
  });

  return {
    teams: teamSummaries,
    recipients: userSummaries,
    summary: buildOverview(teamSummaries, userSummaries),
  };
};

const handler = async (event) => {
  console.log(`[PulseCheckRevenueCalc] Received ${event.httpMethod} request.`);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const revenueData = await calculateAllCoachRevenues();

    await db.collection('pulsecheck-revenue-summary-runs').add({
      summary: revenueData.summary,
      teamSummaryCollection: TEAM_REVENUE_SUMMARIES_COLLECTION,
      userSummaryCollection: USER_REVENUE_SUMMARIES_COLLECTION,
      calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'PulseCheck revenue summaries recalculated successfully',
        summary: revenueData.summary,
        calculatedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('[PulseCheckRevenueCalc] Error in calculation handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: error.message || 'Failed to recalculate PulseCheck revenue summaries.',
      }),
    };
  }
};

module.exports = { handler, calculateAllCoachRevenues };
