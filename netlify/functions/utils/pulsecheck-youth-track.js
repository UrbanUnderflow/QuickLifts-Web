/**
 * Server-side mirror of the PulseCheck iOS youth track resolver
 * (PulseCheck/Services/PulseCheckYouthTrackService.swift). Keep the two in step.
 *
 * - Athlete memberships: pulsecheck-team-memberships where userId == uid and role == 'athlete'.
 * - Per-athlete invite override: membership.athleteTrackOverride (pro | junior | rookie), keyed by teamId.
 * - Team default: pulsecheck-teams/{teamId}.commercialConfig.youthTrack, missing or invalid is junior.
 * - Each team resolves to override ?? team default. Paused and archived teams are ineligible.
 * - The effective track is the most permissive eligible track (pro > junior > rookie), junior when none.
 * - A failed membership query means no teams (junior). A failed team read is an ineligible candidate.
 */

const YOUTH_TRACKS = ['pro', 'junior', 'rookie'];
const DEFAULT_YOUTH_TRACK = 'junior';

function parseYouthTrack(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return YOUTH_TRACKS.includes(normalized) ? normalized : null;
}

function isEligibleTeamStatus(status) {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return normalized !== 'paused' && normalized !== 'archived';
}

function effectiveYouthTrack(candidates) {
  const eligibleTracks = (candidates || []).filter((candidate) => isEligibleTeamStatus(candidate.teamStatus)).map((candidate) => candidate.track);
  if (eligibleTracks.includes('pro')) return 'pro';
  if (eligibleTracks.includes('junior')) return 'junior';
  if (eligibleTracks.includes('rookie')) return 'rookie';
  return DEFAULT_YOUTH_TRACK;
}

function allowsDirectNoraChat(track) {
  return track === 'pro';
}

async function readAthleteMemberships(db, userId) {
  try {
    const snapshot = await db
      .collection('pulsecheck-team-memberships')
      .where('userId', '==', userId)
      .where('role', '==', 'athlete')
      .get();
    const teamIds = new Set();
    const overrides = {};
    for (const doc of snapshot.docs || []) {
      const data = doc.data() || {};
      const teamId = typeof data.teamId === 'string' ? data.teamId.trim() : '';
      if (!teamId) continue;
      teamIds.add(teamId);
      const override = parseYouthTrack(data.athleteTrackOverride);
      if (override) overrides[teamId] = override;
    }
    return { teamIds: [...teamIds], overrides };
  } catch (error) {
    console.warn('[youth-track] Failed to read athlete memberships', { userId, error: error?.message || String(error) });
    return { teamIds: [], overrides: {} };
  }
}

async function readTeamCandidate(db, teamId, athleteOverride) {
  try {
    const snapshot = await db.collection('pulsecheck-teams').doc(teamId).get();
    const teamData = (snapshot.exists ? snapshot.data() : null) || {};
    const teamTrack = parseYouthTrack(teamData.commercialConfig?.youthTrack) || DEFAULT_YOUTH_TRACK;
    return {
      teamId,
      track: athleteOverride || teamTrack,
      teamStatus: typeof teamData.status === 'string' ? teamData.status : '',
    };
  } catch (error) {
    console.warn('[youth-track] Failed to read team config', { teamId, error: error?.message || String(error) });
    return { teamId, track: DEFAULT_YOUTH_TRACK, teamStatus: 'archived' };
  }
}

/** Returns { track, candidates } for the user. Never throws; failures resolve toward junior, as on iOS. */
async function resolvePulseCheckYouthTrack(db, userId) {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  if (!normalizedUserId) return { track: DEFAULT_YOUTH_TRACK, candidates: [] };
  const { teamIds, overrides } = await readAthleteMemberships(db, normalizedUserId);
  const candidates = await Promise.all(teamIds.map((teamId) => readTeamCandidate(db, teamId, overrides[teamId])));
  return { track: effectiveYouthTrack(candidates), candidates };
}

module.exports = {
  YOUTH_TRACKS,
  DEFAULT_YOUTH_TRACK,
  parseYouthTrack,
  isEligibleTeamStatus,
  effectiveYouthTrack,
  allowsDirectNoraChat,
  resolvePulseCheckYouthTrack,
};
