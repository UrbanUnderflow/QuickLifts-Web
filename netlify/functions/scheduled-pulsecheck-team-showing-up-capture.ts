import { schedule } from '@netlify/functions';
import { calculateAndPersistTeamStandings } from './get-pulsecheck-team-standings';
import { getFirestore, initAdmin } from './utils/getServiceAccount';

const normalizedString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

export const runPulseCheckTeamShowingUpCapture = async (now = new Date()) => {
  await initAdmin();
  const db = await getFirestore();
  const membershipSnapshot = await db.collection('pulsecheck-team-memberships').get();
  const teamIds = [...new Set(membershipSnapshot.docs
    .map((document) => document.data() || {})
    .filter((membership) => {
      const status = normalizedString(membership.status).toLowerCase();
      const role = normalizedString(membership.role).toLowerCase();
      return role === 'athlete'
        && membership.revokedAt == null
        && (!status || status === 'active');
    })
    .map((membership) => normalizedString(membership.teamId))
    .filter(Boolean))];

  const capturedTeams: string[] = [];
  const closedSprints: string[] = [];
  const failures: Array<{ teamId: string; error: string }> = [];

  for (const teamId of teamIds) {
    try {
      const current = await calculateAndPersistTeamStandings({ db, teamId, now });
      if (!current) continue;
      capturedTeams.push(teamId);

      // On day one of a new sprint, recalculate yesterday once more. This
      // captures the completed day 14 before the live board moves to its fresh
      // 14-day window.
      if (current.daysElapsed === 1) {
        const previousDay = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const previous = await calculateAndPersistTeamStandings({
          db,
          teamId,
          now: previousDay,
        });
        if (previous?.sprintId && previous.sprintId !== current.sprintId) {
          closedSprints.push(previous.sprintId);
        }
      }
    } catch (error: any) {
      failures.push({
        teamId,
        error: error?.message || String(error),
      });
    }
  }

  return {
    success: failures.length === 0,
    capturedAt: now.toISOString(),
    capturedTeams,
    closedSprints,
    failures,
  };
};

export const handler = schedule('0 12 * * *', async () => {
  try {
    const result = await runPulseCheckTeamShowingUpCapture();
    return {
      statusCode: result.success ? 200 : 207,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'PulseCheck team score capture failed.',
      }),
    };
  }
});
