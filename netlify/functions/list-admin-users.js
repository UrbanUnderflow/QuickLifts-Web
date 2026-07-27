const { getFirebaseAdminApp, headers } = require('./config/firebase');

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

const ORIGIN_VALUES = {
  fit_with_pulse: [
    'fit_with_pulse',
    'fit-with-pulse',
    'fitwithpulse',
    'fwp',
    'quicklifts',
    'quicklifts_web',
    'quicklifts-ios',
    'quicklifts_ios',
  ],
  macra: ['macra'],
  pulse_check: ['pulse_check', 'pulse-check', 'pulsecheck'],
  pulse_ritual: ['pulse_ritual', 'pulse-ritual', 'pulseritual', 'ritual'],
  athletic_council: [
    'athletic_council',
    'athletic-council',
    'athleticcouncil',
    'athletic_mind',
    'athletic-mind',
    'athleticmind',
    'athletic_mind_council',
    'athletic-mind-council',
  ],
};

const ORIGIN_TAB_KEYS = {
  originFitWithPulse: 'fit_with_pulse',
  originMacra: 'macra',
  originPulseCheck: 'pulse_check',
  originPulseRitual: 'pulse_ritual',
  originAthleticCouncil: 'athletic_council',
  originUnknown: 'unknown',
};

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    ...headers,
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store',
  },
  body: JSON.stringify(body),
});

const normalizeString = (value) => String(value || '').trim();
const normalizeSearch = (value) => normalizeString(value).toLowerCase();

const normalizeOrigin = (value) => {
  const normalized = normalizeSearch(value).replace(/\s+/g, '_');
  for (const [key, values] of Object.entries(ORIGIN_VALUES)) {
    if (values.includes(normalized)) return key;
  }
  return 'unknown';
};

const serialize = (value) => {
  if (value == null) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serialize(entry)]),
    );
  }
  return value;
};

const bearerToken = (event) => {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  return value.replace(/^Bearer\s+/i, '').trim();
};

const verifyAdmin = async ({ db, auth, event }) => {
  const token = bearerToken(event);
  if (!token) {
    const error = new Error('Sign in is required.');
    error.statusCode = 401;
    throw error;
  }

  const decoded = await auth.verifyIdToken(token);
  if (decoded.admin === true || decoded.isAdmin === true || decoded.role === 'admin') {
    return decoded;
  }

  const email = normalizeSearch(decoded.email);
  const [adminDoc, userDoc] = await Promise.all([
    email ? db.collection('admin').doc(email).get() : Promise.resolve({ exists: false }),
    db.collection('users').doc(decoded.uid).get(),
  ]);
  if (!adminDoc.exists && userDoc.data()?.isAdmin !== true) {
    const error = new Error('Admin access is required.');
    error.statusCode = 403;
    throw error;
  }
  return decoded;
};

const matchesSearch = (id, user, query) => {
  if (!query) return true;
  const values = [
    id,
    user.email,
    user.displayName,
    user.username,
    ...(Array.isArray(user.signInEmails) ? user.signInEmails : []),
    user.registrationEntryPoint,
    user.macraLatestPaywallCancelFeedback?.reason,
    user.macraLatestPaywallCancelFeedback?.trigger,
  ];
  return values.some((value) => normalizeSearch(value).includes(query));
};

const matchesTab = (user, tab, adminEmails) => {
  if (tab === 'admins') return adminEmails.has(normalizeSearch(user.email));
  if (tab === 'creators') return Number(user.videoCount || 0) > 0;
  const originKey = ORIGIN_TAB_KEYS[tab];
  if (originKey) return normalizeOrigin(user.registrationEntryPoint) === originKey;
  return true;
};

const countQuery = async (query) => {
  const snapshot = await query.count().get();
  return Number(snapshot.data().count || 0);
};

const loadCounts = async ({ db, usersRef, adminSnapshot }) => {
  const [total, creators, originEntries] = await Promise.all([
    countQuery(usersRef),
    countQuery(usersRef.where('videoCount', '>', 0)).catch(() => 0),
    Promise.all(
      Object.entries(ORIGIN_VALUES).map(async ([key, values]) => [
        key,
        await countQuery(usersRef.where('registrationEntryPoint', 'in', values)),
      ]),
    ),
  ]);
  const originCounts = Object.fromEntries(originEntries);
  const knownOriginTotal = Object.values(originCounts).reduce((sum, count) => sum + count, 0);

  return {
    total,
    admins: adminSnapshot.size,
    creators,
    origins: {
      ...originCounts,
      unknown: Math.max(0, total - knownOriginTotal),
    },
  };
};

const timestampMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const sortDocuments = (documents, direction) => [...documents].sort((left, right) => {
  const leftTime = timestampMillis(left.data()?.createdAt);
  const rightTime = timestampMillis(right.data()?.createdAt);
  if (leftTime == null && rightTime == null) return left.id.localeCompare(right.id);
  if (leftTime == null) return 1;
  if (rightTime == null) return -1;
  return direction === 'asc' ? leftTime - rightTime : rightTime - leftTime;
});

const enrichUsers = async ({ db, documents, adminEmails }) => Promise.all(
  documents.map(async (document) => {
    const data = document.data() || {};
    const user = {
      id: document.id,
      ...serialize(data),
      adminVerified: adminEmails.has(normalizeSearch(data.email)),
    };

    const shouldLoadMacra =
      normalizeOrigin(data.registrationEntryPoint) === 'macra'
      || Boolean(data.hasCompletedMacraOnboarding)
      || Boolean(data.macraOnboardingCompletedAt)
      || Boolean(data.macra)
      || Boolean(data.macraNotificationPreferences)
      || Boolean(data.macraEmailPreferences)
      || Boolean(data.athleteSport || data.athleteSportName || data.athleteSportPosition);

    if (!shouldLoadMacra) return user;

    try {
      const profile = await db.collection('users').doc(document.id).collection('macra').doc('profile').get();
      return {
        ...user,
        macraProfile: profile.exists ? serialize(profile.data()) : null,
        macraProfileLoaded: true,
      };
    } catch (error) {
      return {
        ...user,
        macraProfile: null,
        macraProfileLoaded: false,
        macraProfileLoadError: error instanceof Error ? error.message : 'Failed to load Macra profile',
      };
    }
  }),
);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });

  try {
    const app = getFirebaseAdminApp(event);
    const auth = app.auth();
    const db = app.firestore();
    await verifyAdmin({ db, auth, event });

    const params = event.queryStringParameters || {};
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.parseInt(params.limit, 10) || DEFAULT_LIMIT),
    );
    const search = normalizeSearch(params.q);
    const tab = normalizeString(params.tab) || 'all';
    const direction = params.direction === 'asc' ? 'asc' : 'desc';
    const cursorId = normalizeString(params.cursor);
    const usersRef = db.collection('users');
    const adminSnapshot = await db.collection('admin').get();
    const adminEmails = new Set(
      adminSnapshot.docs.map((document) => normalizeSearch(document.id)),
    );

    let documents;
    let hasMore = false;
    let nextCursor = null;

    if (search || tab !== 'all') {
      const snapshot = await usersRef.get();
      const matches = sortDocuments(snapshot.docs, direction).filter((document) => {
        const user = document.data() || {};
        return matchesSearch(document.id, user, search)
          && matchesTab(user, tab, adminEmails);
      });
      documents = matches.slice(0, limit);
      hasMore = matches.length > limit;
    } else {
      let pageQuery = usersRef.orderBy('createdAt', direction).limit(limit + 1);
      if (cursorId) {
        const cursorSnapshot = await usersRef.doc(cursorId).get();
        if (cursorSnapshot.exists) pageQuery = pageQuery.startAfter(cursorSnapshot);
      }
      const snapshot = await pageQuery.get();
      hasMore = snapshot.size > limit;
      documents = snapshot.docs.slice(0, limit);
      nextCursor = hasMore && documents.length
        ? documents[documents.length - 1].id
        : null;
    }

    const [users, counts] = await Promise.all([
      enrichUsers({ db, documents, adminEmails }),
      params.counts === 'false'
        ? Promise.resolve(null)
        : loadCounts({ db, usersRef, adminSnapshot }),
    ]);

    return json(200, {
      users,
      counts,
      page: {
        limit,
        returned: users.length,
        hasMore,
        nextCursor,
        searchMode: Boolean(search),
      },
    });
  } catch (error) {
    console.error('[list-admin-users]', error);
    return json(error.statusCode || 500, {
      error: error instanceof Error ? error.message : 'Users could not be loaded.',
    });
  }
};

exports.__test = {
  matchesSearch,
  matchesTab,
  normalizeOrigin,
  sortDocuments,
};
