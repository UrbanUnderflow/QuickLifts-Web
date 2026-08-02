import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import { aggregateOverallStandings } from './utils/teamShowingUpScore';

const DAILY_SCORE_COLLECTION = 'pulsecheck-team-showing-up-daily-scores';
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const normalizedString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const validDateKey = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T12:00:00.000Z`));

const verifyAuth = async (authHeader?: string): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice('Bearer '.length).trim());
    return decoded.uid;
  } catch {
    return null;
  }
};

const canReadTeamHistory = async (
  db: admin.firestore.Firestore,
  userId: string,
  teamId: string,
): Promise<boolean> => {
  const snapshot = await db.collection('pulsecheck-team-memberships')
    .where('userId', '==', userId)
    .get();
  return snapshot.docs.some((document) => {
    const data = document.data();
    const status = normalizedString(data.status).toLowerCase();
    return normalizedString(data.teamId) === teamId
      && data.revokedAt == null
      && (!status || status === 'active');
  });
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
  const userId = await verifyAuth(event.headers?.authorization || event.headers?.Authorization);
  if (!userId) {
    return {
      statusCode: 401,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'unauthenticated' }),
    };
  }

  let body: { teamId?: string; startDate?: string; endDate?: string } = {};
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as any) || {};
  } catch {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'invalid_json' }),
    };
  }

  const teamId = normalizedString(body.teamId);
  const startDate = normalizedString(body.startDate);
  const endDate = normalizedString(body.endDate);
  if (!teamId || !validDateKey(startDate) || !validDateKey(endDate) || startDate > endDate) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'valid_team_and_date_range_required' }),
    };
  }
  const rangeDays = Math.floor(
    (Date.parse(`${endDate}T12:00:00.000Z`) - Date.parse(`${startDate}T12:00:00.000Z`))
      / (24 * 60 * 60 * 1000),
  ) + 1;
  if (rangeDays > 3650) {
    return {
      statusCode: 400,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'date_range_exceeds_ten_year_limit' }),
    };
  }
  if (!await canReadTeamHistory(db, userId, teamId)) {
    return {
      statusCode: 403,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'active_team_membership_required' }),
    };
  }

  const scoreSnapshot = await db.collection(DAILY_SCORE_COLLECTION)
    .where('teamId', '==', teamId)
    .where('dateKey', '>=', startDate)
    .where('dateKey', '<=', endDate)
    .get();
  const records = scoreSnapshot.docs.map((document) => {
    const data = document.data();
    return {
      userId: normalizedString(data.athleteId),
      displayName: normalizedString(data.displayName) || 'Teammate',
      dateKey: normalizedString(data.dateKey),
      points: Number(data.points) || 0,
    };
  }).filter((record) => record.userId && validDateKey(record.dateKey));
  const standings = aggregateOverallStandings(records);
  const scoredDateKeys = [...new Set(records.map((record) => record.dateKey))].sort();
  const teamDocument = await db.collection('pulsecheck-teams').doc(teamId).get();
  const teamName = normalizedString(teamDocument.data()?.displayName)
    || normalizedString(scoreSnapshot.docs[0]?.data()?.teamName)
    || 'Your Team';

  return {
    statusCode: 200,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      teamId,
      teamName,
      startDate,
      endDate,
      requestedDays: rangeDays,
      recordedDays: scoredDateKeys.length,
      firstRecordedDate: scoredDateKeys[0] || null,
      lastRecordedDate: scoredDateKeys[scoredDateKeys.length - 1] || null,
      standings,
      winnerAthleteIds: standings.filter((member) => member.rank === 1).map((member) => member.userId),
      scoring: {
        pointsPerDay: 4,
        source: DAILY_SCORE_COLLECTION,
      },
    }),
  };
};
