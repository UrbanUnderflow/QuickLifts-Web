import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  assignSharedRanks,
  countFinalizedLeaderWins,
  current14DaySprint,
  dateKeyInTimeZone,
  hasEveningCheckIn,
  hasMorningCheckIn,
  hasVerifiedOvernightData,
  isSkillAssignmentDueToday,
  isShowingUpLeaderboardEnabled,
  resolveTimeZone,
  scoreShowingUpDay,
} from './utils/teamShowingUpScore';

const DAILY_SCORE_COLLECTION = 'pulsecheck-team-showing-up-daily-scores';
const SPRINT_COLLECTION = 'pulsecheck-team-showing-up-sprints';
const SCORE_VERSION = 'showing-up-v2';

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ActiveMembership = {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  title?: string;
  grantedAt?: unknown;
};

type AvailableTeam = {
  teamId: string;
  teamName: string;
  leaderboardEnabled: boolean;
};

const loadFinalizedLeaderWinsByAthlete = async (
  db: admin.firestore.Firestore,
  teamId: string,
): Promise<Map<string, number>> => {
  const snapshot = await db.collection(SPRINT_COLLECTION)
    .where('teamId', '==', teamId)
    .get();
  // Day 14 remains live until the window has closed. Only the scheduled
  // next-day capture finalizes the result and awards the profile win.
  return countFinalizedLeaderWins(snapshot.docs.map((document) => document.data() || {}));
};

const verifyAuth = async (authHeader?: string): Promise<{ uid: string } | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
};

const normalizedString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const isActiveAthleteMembership = (data: Record<string, any>): boolean => {
  const status = normalizedString(data.status).toLowerCase();
  const role = normalizedString(data.role).toLowerCase();
  const revoked = data.revokedAt !== undefined && data.revokedAt !== null;
  return role === 'athlete' && !revoked && (!status || status === 'active');
};

const profileImageURL = (data: Record<string, any>): string | undefined => {
  const nested = normalizedString(data.profileImage?.profileImageURL);
  if (nested) return nested;
  const direct = normalizedString(data.profileImageURL);
  return direct || undefined;
};

const displayName = (data: Record<string, any>): string => {
  const preferred = normalizedString(data.preferredName);
  if (preferred) return preferred;
  const firstName = normalizedString(data.firstName);
  if (firstName) return firstName;
  const username = normalizedString(data.username);
  if (username) return username;
  return 'Teammate';
};

const timestampMillis = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const safeDocumentIdPart = (value: string): string => encodeURIComponent(value);

const resolveSprintAnchor = async (
  db: admin.firestore.Firestore,
  teamId: string,
  teamData: Record<string, any>,
  timezone: string,
  now: Date,
): Promise<{ anchorDateKey?: string; pilotId?: string }> => {
  const configuredAnchor = normalizedString(
    teamData.showingUpLeaderboard?.anchorDateKey
      || teamData.showingUpSprintStartDate
      || teamData.leaderboardStartDate,
  );
  if (/^\d{4}-\d{2}-\d{2}$/.test(configuredAnchor)) {
    return { anchorDateKey: configuredAnchor };
  }

  const pilotSnapshot = await db.collection('pulsecheck-pilots')
    .where('teamId', '==', teamId)
    .limit(20)
    .get();
  const nowMillis = now.getTime();
  const candidates = pilotSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((pilot) => {
      const status = normalizedString(pilot.status).toLowerCase();
      const start = timestampMillis(pilot.startAt);
      return start !== undefined
        && start <= nowMillis
        && status !== 'draft'
        && status !== 'archived';
    })
    .sort((left, right) => (timestampMillis(right.startAt) || 0) - (timestampMillis(left.startAt) || 0));
  const pilot = candidates[0];
  const startMillis = pilot ? timestampMillis(pilot.startAt) : undefined;
  if (!pilot || !startMillis) return {};
  return {
    anchorDateKey: dateKeyInTimeZone(new Date(startMillis), timezone),
    pilotId: pilot.id,
  };
};

const persistShowingUpRecords = async (
  db: admin.firestore.Firestore,
  input: {
    teamId: string;
    teamName: string;
    pilotId?: string;
    timezone: string;
    sprintId: string;
    sprintNumber: number;
    sprintStartDate: string;
    sprintEndDate: string;
    throughDate: string;
    isFinalized: boolean;
    members: Array<Record<string, any>>;
  },
): Promise<void> => {
  const writes: Array<{ reference: admin.firestore.DocumentReference; data: Record<string, any> }> = [];
  for (const member of input.members) {
    for (const day of member.days || []) {
      const id = [input.teamId, day.dateKey, member.userId]
        .map((part) => safeDocumentIdPart(String(part)))
        .join('__');
      writes.push({
        reference: db.collection(DAILY_SCORE_COLLECTION).doc(id),
        data: {
          teamId: input.teamId,
          teamName: input.teamName,
          pilotId: input.pilotId || null,
          athleteId: member.userId,
          displayName: member.displayName,
          membershipTitle: member.title || null,
          dateKey: day.dateKey,
          timezone: input.timezone,
          sprintId: input.sprintId,
          sprintNumber: input.sprintNumber,
          sprintStartDate: input.sprintStartDate,
          sprintEndDate: input.sprintEndDate,
          skillTraining: day.skillTraining === true,
          morningCheckIn: day.morningCheckIn === true,
          eveningCheckIn: day.eveningCheckIn === true,
          checkIn: admin.firestore.FieldValue.delete(),
          wearable: day.wearable === true,
          points: Number(day.points) || 0,
          maxPoints: 4,
          finalized: day.dateKey < input.throughDate,
          scoreVersion: SCORE_VERSION,
          computedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    }
  }

  const sprintDocumentId = [input.teamId, input.sprintStartDate]
    .map((part) => safeDocumentIdPart(part))
    .join('__');
  writes.push({
    reference: db.collection(SPRINT_COLLECTION).doc(sprintDocumentId),
    data: {
      teamId: input.teamId,
      teamName: input.teamName,
      pilotId: input.pilotId || null,
      timezone: input.timezone,
      sprintId: input.sprintId,
      sprintNumber: input.sprintNumber,
      sprintStartDate: input.sprintStartDate,
      sprintEndDate: input.sprintEndDate,
      throughDate: input.throughDate,
      isComplete: input.throughDate >= input.sprintEndDate,
      isFinalized: input.isFinalized,
      ...(input.isFinalized
        ? { finalizedAt: admin.firestore.FieldValue.serverTimestamp() }
        : {}),
      scoreVersion: SCORE_VERSION,
      members: input.members.map((member) => ({
        athleteId: member.userId,
        displayName: member.displayName,
        totalPoints: member.totalPoints,
        maxPoints: member.maxPoints,
        rank: member.rank,
      })),
      winnerAthleteIds: input.members
        .filter((member) => member.rank === 1)
        .map((member) => member.userId),
      computedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  });

  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + 400)) {
      batch.set(write.reference, write.data, { merge: true });
    }
    await batch.commit();
  }
};

const loadSkillTrainingDays = async (
  db: admin.firestore.Firestore,
  athleteId: string,
  teamId: string,
  dateKeys: string[],
  timezone: string,
): Promise<Set<string>> => {
  const dateKeySet = new Set(dateKeys);
  // Read one extra day so Monday completions are included for teams whose
  // local midnight falls before UTC midnight. We still assign every result
  // to a team-local date below.
  const startSeconds = (Date.parse(`${dateKeys[0]}T00:00:00.000Z`) / 1000) - (24 * 60 * 60);
  const [assignmentSnapshot, completionSnapshot] = await Promise.all([
    db.collection('pulsecheck-daily-assignments')
      .where('athleteId', '==', athleteId)
      .limit(100)
      .get(),
    db.collection('mental-exercise-completions')
      .doc(athleteId)
      .collection('completions')
      .where('completedAt', '>=', startSeconds)
      .limit(250)
      .get(),
  ]);

  const assignmentsByDate = new Map<string, Array<Record<string, any>>>();
  for (const document of assignmentSnapshot.docs) {
    const data = document.data();
    const sourceDate = normalizedString(data.sourceDate);
    const assignmentTeamId = normalizedString(data.teamId);
    if (!dateKeySet.has(sourceDate)) continue;
    if (assignmentTeamId && assignmentTeamId !== teamId) continue;
    if (!isSkillAssignmentDueToday(data)) continue;
    const existing = assignmentsByDate.get(sourceDate) || [];
    existing.push(data);
    assignmentsByDate.set(sourceDate, existing);
  }

  const completionDays = new Set<string>();
  for (const document of completionSnapshot.docs) {
    const completedAt = timestampMillis(document.data().completedAt);
    if (!completedAt) continue;
    const dateKey = dateKeyInTimeZone(new Date(completedAt), timezone);
    if (dateKeySet.has(dateKey)) completionDays.add(dateKey);
  }

  const earnedDays = new Set<string>();
  for (const dateKey of dateKeys) {
    const assignments = assignmentsByDate.get(dateKey) || [];
    if (assignments.length > 0) {
      const allAssignedWorkCompleted = assignments.every((assignment) => (
        normalizedString(assignment.status).toLowerCase() === 'completed'
      ));
      if (allAssignedWorkCompleted) earnedDays.add(dateKey);
      continue;
    }
    if (completionDays.has(dateKey)) earnedDays.add(dateKey);
  }
  return earnedDays;
};

const resolveActiveMemberships = async (
  db: admin.firestore.Firestore,
  userId: string,
): Promise<ActiveMembership[]> => {
  const snapshot = await db.collection('pulsecheck-team-memberships')
    .where('userId', '==', userId)
    .get();
  const active = snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((membership) => isActiveAthleteMembership(membership))
    .sort((left, right) => (timestampMillis(right.grantedAt) || 0) - (timestampMillis(left.grantedAt) || 0))
    .map((membership) => ({
      id: membership.id,
      teamId: normalizedString(membership.teamId),
      userId: normalizedString(membership.userId),
      role: normalizedString(membership.role),
      title: normalizedString(membership.title) || undefined,
      grantedAt: membership.grantedAt,
    }))
    .filter((membership) => membership.teamId);

  const seenTeamIds = new Set<string>();
  return active.filter((membership) => {
    if (seenTeamIds.has(membership.teamId)) return false;
    seenTeamIds.add(membership.teamId);
    return true;
  });
};

const resolveAvailableTeams = async (
  db: admin.firestore.Firestore,
  memberships: ActiveMembership[],
): Promise<AvailableTeam[]> => {
  const references = memberships.map((membership) => (
    db.collection('pulsecheck-teams').doc(membership.teamId)
  ));
  const documents = references.length > 0 ? await db.getAll(...references) : [];
  const teamDataById = new Map(documents.map((document) => [
    document.id,
    { exists: document.exists, data: document.data() || {} },
  ]));

  return memberships.flatMap((membership) => {
    const team = teamDataById.get(membership.teamId);
    const status = normalizedString(team?.data.status).toLowerCase();
    if (!team?.exists || status === 'archived' || status === 'inactive') return [];
    return [{
      teamId: membership.teamId,
      teamName: normalizedString(team.data.displayName) || 'Your Team',
      leaderboardEnabled: isShowingUpLeaderboardEnabled(team.data),
    }];
  });
};

export const calculateAndPersistTeamStandings = async (input: {
  db: admin.firestore.Firestore;
  teamId: string;
  currentUserId?: string;
  timezoneOverride?: string;
  now?: Date;
  finalizeWindow?: boolean;
}): Promise<Record<string, any> | null> => {
  const { db, teamId, currentUserId, timezoneOverride } = input;
  const now = input.now || new Date();
  const teamSnapshot = await db.collection('pulsecheck-teams').doc(teamId).get();
  const teamData = teamSnapshot.data() || {};
  const teamStatus = normalizedString(teamData.status).toLowerCase();
  if (!teamSnapshot.exists || teamStatus === 'archived' || teamStatus === 'inactive') {
    return null;
  }

  const timezone = resolveTimeZone(teamData.timezone || timezoneOverride || 'UTC');
  const sprintAnchor = await resolveSprintAnchor(db, teamId, teamData, timezone, now);
  const sprint = current14DaySprint(now, timezone, sprintAnchor.anchorDateKey);
  const { throughDate, dateKeys } = sprint;
  const membershipSnapshot = await db.collection('pulsecheck-team-memberships')
    .where('teamId', '==', teamId)
    .get();
  const activeAthletes = membershipSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((membership) => isActiveAthleteMembership(membership))
    .map((membership) => ({
      id: membership.id,
      teamId: normalizedString(membership.teamId),
      userId: normalizedString(membership.userId),
      role: normalizedString(membership.role),
      title: normalizedString(membership.title) || undefined,
    }))
    .filter((membership) => membership.userId);

  const userReferences = activeAthletes.map((membership) => db.collection('users').doc(membership.userId));
  const userDocuments = userReferences.length > 0 ? await db.getAll(...userReferences) : [];
  const userDataById = new Map(userDocuments.map((document) => [document.id, document.data() || {}]));

  const checkInReferences = activeAthletes.flatMap((membership) => (
    dateKeys.map((dateKey) => db.collection('pulsecheck-morning-checkins').doc(`${membership.userId}_${dateKey}`))
  ));
  const snapshotReferences = activeAthletes.flatMap((membership) => (
    dateKeys.map((dateKey) => db.collection('health-context-snapshots').doc(`${membership.userId}_daily_${dateKey}`))
  ));
  const [checkInDocuments, healthDocuments, skillDaysByAthlete] = await Promise.all([
    checkInReferences.length > 0 ? db.getAll(...checkInReferences) : Promise.resolve([]),
    snapshotReferences.length > 0 ? db.getAll(...snapshotReferences) : Promise.resolve([]),
    Promise.all(activeAthletes.map(async (membership) => ([
      membership.userId,
      await loadSkillTrainingDays(db, membership.userId, teamId, dateKeys, timezone),
    ] as const))),
  ]);
  const checkInById = new Map(checkInDocuments.map((document) => [document.id, document]));
  const healthById = new Map(healthDocuments.map((document) => [document.id, document]));
  const skillDays = new Map(skillDaysByAthlete);

  const unrankedMembers = activeAthletes.map((membership) => {
    const userData = userDataById.get(membership.userId) || {};
    const days = dateKeys.map((dateKey) => {
      const checkInDocument = checkInById.get(`${membership.userId}_${dateKey}`);
      const checkInData = checkInDocument?.exists
        ? checkInDocument.data() as Record<string, any>
        : undefined;
      const healthDocument = healthById.get(`${membership.userId}_daily_${dateKey}`);
      return scoreShowingUpDay({
        dateKey,
        skillTraining: skillDays.get(membership.userId)?.has(dateKey) === true,
        morningCheckIn: hasMorningCheckIn(checkInData),
        eveningCheckIn: hasEveningCheckIn(checkInData),
        wearable: healthDocument?.exists === true
          && hasVerifiedOvernightData(healthDocument.data() as Record<string, any>),
      });
    });
    return {
      userId: membership.userId,
      displayName: displayName(userData),
      profileImageURL: profileImageURL(userData),
      title: membership.title,
      totalPoints: days.reduce((total, day) => total + day.points, 0),
      maxPoints: dateKeys.length * 4,
      days,
      isCurrentUser: membership.userId === currentUserId,
    };
  });

  const rankedMembers = assignSharedRanks(unrankedMembers);
  const teamName = normalizedString(teamData.displayName) || 'Your Team';
  const sprintId = `${teamId}_${sprint.sprintStartDate}`;
  await persistShowingUpRecords(db, {
    teamId,
    teamName,
    pilotId: sprintAnchor.pilotId,
    timezone,
    sprintId,
    sprintNumber: sprint.sprintNumber,
    sprintStartDate: sprint.sprintStartDate,
    sprintEndDate: sprint.sprintEndDate,
    throughDate,
    isFinalized: input.finalizeWindow === true,
    members: rankedMembers,
  });
  const leaderWinsByAthlete = await loadFinalizedLeaderWinsByAthlete(db, teamId);
  const members = rankedMembers.map((member) => ({
    ...member,
    leaderWins: leaderWinsByAthlete.get(member.userId) || 0,
  }));
  const currentUser = members.find((member) => member.userId === currentUserId) || null;

  return {
    teamId,
    teamName,
    timezone,
    pilotId: sprintAnchor.pilotId || null,
    sprintId,
    sprintNumber: sprint.sprintNumber,
    sprintStartDate: sprint.sprintStartDate,
    sprintEndDate: sprint.sprintEndDate,
    throughDate,
    daysElapsed: sprint.daysElapsed,
    daysRemaining: sprint.daysRemaining,
    maxPoints: dateKeys.length * 4,
    sprintMaxPoints: 14 * 4,
    scoring: {
      pointsPerDay: 4,
      skillTrainingPoints: 1,
      morningCheckInPoints: 1,
      eveningCheckInPoints: 1,
      wearablePoints: 1,
    },
    members,
    currentUser,
    privacySummary: 'The board counts completion. Check-in answers and health values stay private.',
  };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'method_not_allowed' }),
    };
  }

  await initAdmin();
  const db = await getFirestore();
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const auth = await verifyAuth(authHeader);
  if (!auth) {
    return {
      statusCode: 401,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'unauthenticated' }),
    };
  }

  let body: { teamId?: string; timezone?: string } = {};
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as any) || {};
  } catch {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'invalid_json' }),
    };
  }

  const requestedTeamId = normalizedString(body.teamId);
  const activeMemberships = await resolveActiveMemberships(db, auth.uid);
  if (requestedTeamId && !activeMemberships.some((membership) => membership.teamId === requestedTeamId)) {
    return {
      statusCode: 403,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'active_team_membership_required' }),
    };
  }
  const availableTeams = await resolveAvailableTeams(db, activeMemberships);
  const enabledTeams = availableTeams.filter((team) => team.leaderboardEnabled);
  const leaderWinsByTeam = new Map(await Promise.all(availableTeams.map(async (team) => {
    const wins = await loadFinalizedLeaderWinsByAthlete(db, team.teamId);
    return [team.teamId, wins.get(auth.uid) || 0] as const;
  })));
  const leaderTrackerTeams = availableTeams.map(({ teamId, teamName }) => ({
    teamId,
    teamName,
    leaderWins: leaderWinsByTeam.get(teamId) || 0,
  }));
  const leaderWinsTotal = [...leaderWinsByTeam.values()].reduce((total, wins) => total + wins, 0);
  const requestedEnabledTeam = enabledTeams.find((team) => team.teamId === requestedTeamId);
  const selectedTeamId = requestedEnabledTeam?.teamId || enabledTeams[0]?.teamId;
  if (!selectedTeamId) {
    return {
      statusCode: activeMemberships.length > 0 ? 200 : 403,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ...(activeMemberships.length > 0
          ? {
              leaderboardEnabled: false,
              availableTeams: [],
              leaderWinsTotal,
              leaderTrackerTeams,
            }
          : { error: 'active_team_membership_required' }),
      }),
    };
  }

  const standings = await calculateAndPersistTeamStandings({
    db,
    teamId: selectedTeamId,
    currentUserId: auth.uid,
    timezoneOverride: body.timezone,
  });
  if (!standings) {
    return {
      statusCode: 404,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'active_team_required' }),
    };
  }
  return {
    statusCode: 200,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      ...standings,
      leaderboardEnabled: true,
      leaderWinsTotal,
      leaderTrackerTeams,
      availableTeams: enabledTeams.map(({ teamId, teamName }) => ({
        teamId,
        teamName,
        leaderWins: leaderWinsByTeam.get(teamId) || 0,
      })),
    }),
  };
};
